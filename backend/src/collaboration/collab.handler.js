/**
 * Collaboration Socket Handlers
 * 
 * WebSocket event handlers for real-time document collaboration.
 * Handles document join/leave, real-time sync, cursor positions,
 * and revision-based conflict resolution.
 */

const Document = require('../models/Document');
const { createNotification } = require('../notifications/notification.service');
const { mergeTextWithConflicts } = require('./merge.service');
const { logActivity } = require('../activity/activity.service');
const { applyCrdtOperation, loadCrdtState } = require('./crdt.service');

/**
 * In-memory cursor positions per document.
 * Maps: docId -> Map(userId -> { line, ch, userName })
 */
const cursors = new Map();

/**
 * Register all document collaboration event handlers on a socket.
 * Handles: join, leave, update, sync-request, cursor updates.
 */
function registerCollabHandlers(io, socket) {
  // Join a document room
  socket.on('doc:join', async (docId) => {
    const doc = await Document.findOne({ _id: docId, collaborators: socket.user.id });
    if (!doc) {
      socket.emit('error', { message: 'Document not found' });
      return;
    }

    socket.join(`doc:${docId}`);
    const syncMode = doc.syncMode === 'crdt' ? 'crdt' : 'legacy';
    const crdtState = syncMode === 'crdt' ? loadCrdtState(docId, doc) : null;
    socket.emit('doc:sync', {
      docId,
      title: doc.title,
      content: syncMode === 'crdt' ? crdtState.content : (doc.content || ''),
      revision: syncMode === 'crdt' ? crdtState.version : (doc.revision || 0),
      syncMode,
    });

    // Send current cursors
    if (cursors.has(docId)) {
      socket.emit('doc:cursors', Object.fromEntries(cursors.get(docId)));
    }

    // Notify others
    socket.to(`doc:${docId}`).emit('doc:user-joined', {
      userId: socket.user.id,
      userName: socket.user.name,
    });
  });

  // Leave a document room
  socket.on('doc:leave', (docId) => {
    socket.leave(`doc:${docId}`);
    if (cursors.has(docId)) {
      cursors.get(docId).delete(socket.user.id);
    }
    socket.to(`doc:${docId}`).emit('doc:user-left', {
      userId: socket.user.id,
    });
  });

  // Document update with revision-aware merge fallback.
  socket.on('doc:update', async (data) => {
    try {
      const { docId, content, title, baseRevision = 0, baseContent = '' } = data;
      const doc = await Document.findOne({ _id: docId, collaborators: socket.user.id });
      if (!doc) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }
      if (doc.syncMode === 'crdt') {
        socket.emit('error', { message: 'Legacy sync disabled for this document' });
        return;
      }

      const nextTitle = typeof title === 'string' ? title.trim() || doc.title : doc.title;
      const currentRevision = doc.revision || 0;

      let nextContent = typeof content === 'string' ? content : doc.content || '';
      let merged = false;
      let conflict = false;

      if (baseRevision !== currentRevision) {
        const mergedResult = mergeTextWithConflicts(baseContent, doc.content || '', nextContent);
        nextContent = mergedResult.content;
        merged = mergedResult.merged;
        conflict = mergedResult.conflict;
      }

      const nextRevision = currentRevision + 1;

      // Persist update
      await Document.findByIdAndUpdate(docId, {
        title: nextTitle,
        content: nextContent,
        revision: nextRevision,
        updatedAt: Date.now(),
        $push: {
          versions: {
            content: nextContent,
            editedBy: socket.user.id,
            revision: nextRevision,
            timestamp: Date.now(),
          },
        },
      });

      socket.emit('doc:ack', {
        docId,
        title: nextTitle,
        content: nextContent,
        revision: nextRevision,
        merged,
        conflict,
      });

      // Broadcast to other editors
      socket.to(`doc:${docId}`).emit('doc:update', {
        docId,
        title: nextTitle,
        content: nextContent,
        revision: nextRevision,
        merged,
        conflict,
        editedBy: socket.user.id,
        editorName: socket.user.name,
      });
      await logActivity(io, {
        actorId: socket.user.id,
        type: 'document_realtime_updated',
        message: `Edited document "${nextTitle}"`,
        meta: { docId, revision: nextRevision, conflict },
      });

      // Notify collaborators
      const others = doc.collaborators.filter((c) => c.toString() !== socket.user.id);
      for (const userId of others) {
        await createNotification(
          io,
          userId.toString(),
          'doc_edit',
          `${socket.user.name} edited "${nextTitle}"`,
          { docId }
        );
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('doc:op', async (data) => {
    try {
      const { docId, op, baseVersion = 0, title } = data || {};
      const doc = await Document.findOne({ _id: docId, collaborators: socket.user.id });
      if (!doc) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }
      if (doc.syncMode !== 'crdt') {
        socket.emit('error', { message: 'CRDT sync not enabled for this document' });
        return;
      }

      const nextTitle = typeof title === 'string' ? title.trim() || doc.title : doc.title;
      const result = applyCrdtOperation(docId, doc, {
        ...op,
        clientId: socket.id,
      }, baseVersion);

      await Document.findByIdAndUpdate(docId, {
        title: nextTitle,
        content: result.content,
        revision: result.version,
        'crdtState.content': result.content,
        'crdtState.version': result.version,
        updatedAt: Date.now(),
        $push: {
          versions: {
            content: result.content,
            editedBy: socket.user.id,
            revision: result.version,
            timestamp: Date.now(),
          },
        },
      });

      socket.emit('doc:ack', {
        docId,
        title: nextTitle,
        content: result.content,
        revision: result.version,
        syncMode: 'crdt',
        clientOpId: op?.clientOpId || '',
      });

      socket.to(`doc:${docId}`).emit('doc:remote-op', {
        docId,
        title: nextTitle,
        content: result.content,
        revision: result.version,
        syncMode: 'crdt',
        editedBy: socket.user.id,
        editorName: socket.user.name,
      });

      await logActivity(io, {
        actorId: socket.user.id,
        type: 'document_realtime_updated',
        message: `Edited document "${nextTitle}"`,
        meta: { docId, revision: result.version, syncMode: 'crdt' },
      });

      const others = doc.collaborators.filter((c) => c.toString() !== socket.user.id);
      for (const userId of others) {
        await createNotification(
          io,
          userId.toString(),
          'doc_edit',
          `${socket.user.name} edited "${nextTitle}"`,
          { docId, syncMode: 'crdt' }
        );
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('doc:sync-request', async (docId) => {
    try {
      const doc = await Document.findOne({ _id: docId, collaborators: socket.user.id });
      if (!doc) return;
      socket.emit('doc:sync', {
        docId,
        title: doc.title,
        content: doc.syncMode === 'crdt'
          ? loadCrdtState(docId, doc).content
          : (doc.content || ''),
        revision: doc.syncMode === 'crdt'
          ? loadCrdtState(docId, doc).version
          : (doc.revision || 0),
        syncMode: doc.syncMode === 'crdt' ? 'crdt' : 'legacy',
      });
    } catch {
      // no-op
    }
  });

  // Cursor position updates
  socket.on('doc:cursor', (data) => {
    const { docId, line, ch } = data;
    if (!cursors.has(docId)) cursors.set(docId, new Map());
    cursors.get(docId).set(socket.user.id, {
      line, ch,
      userName: socket.user.name,
      userId: socket.user.id,
    });
    socket.to(`doc:${docId}`).emit('doc:cursor', {
      userId: socket.user.id,
      userName: socket.user.name,
      line, ch,
    });
  });
}

module.exports = { registerCollabHandlers };
