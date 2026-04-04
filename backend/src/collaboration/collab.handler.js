const Document = require('../models/Document');
const { createNotification } = require('../notifications/notification.service');
const { mergeTextWithConflicts } = require('./merge.service');
const { logActivity } = require('../activity/activity.service');

// In-memory cursor positions per document
const cursors = new Map(); // docId -> Map(userId -> { line, ch, userName })

function registerCollabHandlers(io, socket) {
  // Join a document room
  socket.on('doc:join', async (docId) => {
    const doc = await Document.findOne({ _id: docId, collaborators: socket.user.id });
    if (!doc) {
      socket.emit('error', { message: 'Document not found' });
      return;
    }

    socket.join(`doc:${docId}`);
    socket.emit('doc:sync', {
      docId,
      title: doc.title,
      content: doc.content || '',
      revision: doc.revision || 0,
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

  socket.on('doc:sync-request', async (docId) => {
    try {
      const doc = await Document.findOne({ _id: docId, collaborators: socket.user.id });
      if (!doc) return;
      socket.emit('doc:sync', {
        docId,
        title: doc.title,
        content: doc.content || '',
        revision: doc.revision || 0,
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
