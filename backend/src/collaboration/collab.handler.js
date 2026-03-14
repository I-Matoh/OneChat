const Document = require('../models/Document');
const { createNotification } = require('../notifications/notification.service');

// In-memory cursor positions per document
const cursors = new Map(); // docId -> Map(userId -> { line, ch, userName })

function registerCollabHandlers(io, socket) {
  // Join a document room
  socket.on('doc:join', async (docId) => {
    socket.join(`doc:${docId}`);

    // Add user as collaborator if not already
    await Document.findByIdAndUpdate(docId, {
      $addToSet: { collaborators: socket.user.id },
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

  // Document update (LWW merge for MVP)
  socket.on('doc:update', async (data) => {
    try {
      const { docId, content } = data;

      // Persist update
      await Document.findByIdAndUpdate(docId, {
        content,
        updatedAt: Date.now(),
        $push: {
          versions: {
            content,
            editedBy: socket.user.id,
            timestamp: Date.now(),
          },
        },
      });

      // Broadcast to other editors
      socket.to(`doc:${docId}`).emit('doc:update', {
        docId,
        content,
        editedBy: socket.user.id,
        editorName: socket.user.name,
      });

      // Notify collaborators
      const doc = await Document.findById(docId);
      if (doc) {
        const others = doc.collaborators.filter((c) => c.toString() !== socket.user.id);
        for (const userId of others) {
          createNotification(io, userId.toString(), 'doc_edit', `${socket.user.name} edited "${doc.title}"`);
        }
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
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
