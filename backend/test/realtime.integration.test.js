const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';

const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Document = require('../src/models/Document');
const { clearModules } = require('./helpers/module');

function waitForEvent(socket, eventName) {
  return new Promise((resolve) => socket.once(eventName, resolve));
}

test('socket chat status flow and doc sync-ack flow emit expected events', async () => {
  const originals = {
    conversationFindOne: Conversation.findOne,
    conversationFindByIdAndUpdate: Conversation.findByIdAndUpdate,
    messageFind: Message.find,
    messageCreate: Message.create,
    messageFindByIdAndUpdate: Message.findByIdAndUpdate,
    messageUpdateMany: Message.updateMany,
    documentFindOne: Document.findOne,
    documentFindByIdAndUpdate: Document.findByIdAndUpdate,
  };

  Conversation.findOne = () => ({
    populate() {
      return Promise.resolve({
        _id: 'conv-1',
        name: 'Roadmap',
        participants: [
          { _id: 'user-1', name: 'Ada' },
          { _id: 'user-2', name: 'Grace' },
        ],
      });
    },
  });
  Conversation.findByIdAndUpdate = async () => ({ acknowledged: true });
  Message.find = () => ({
    select() {
      return Promise.resolve([{ _id: 'msg-seen-1' }]);
    },
  });
  Message.create = async () => ({
    _id: 'msg-1',
    createdAt: '2026-04-07T10:04:00.000Z',
  });
  Message.findByIdAndUpdate = async () => ({ acknowledged: true });
  Message.updateMany = async () => ({ acknowledged: true });
  Document.findOne = async ({ _id }) => {
    if (_id !== 'doc-1') return null;
    return {
      _id: 'doc-1',
      title: 'Spec',
      content: 'Original content',
      revision: 0,
      collaborators: ['user-1', 'user-2'],
    };
  };
  Document.findByIdAndUpdate = async () => ({ acknowledged: true });

  const notificationPath = require.resolve('../src/notifications/notification.service');
  const activityPath = require.resolve('../src/activity/activity.service');
  require.cache[notificationPath] = { exports: { createNotification: async () => null } };
  require.cache[activityPath] = { exports: { logActivity: async () => null } };

  clearModules(['../src/chat/chat.handler', '../src/collaboration/collab.handler']);
  const { registerChatHandlers } = require('../src/chat/chat.handler');
  const { registerCollabHandlers } = require('../src/collaboration/collab.handler');

  const httpServer = http.createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  io.use((socket, next) => {
    try {
      socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(err);
    }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    registerChatHandlers(io, socket);
    registerCollabHandlers(io, socket);
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  const url = `http://127.0.0.1:${port}`;
  const alice = Client(url, {
    auth: { token: jwt.sign({ id: 'user-1', name: 'Ada', email: 'ada@example.com' }, process.env.JWT_SECRET) },
    transports: ['websocket'],
  });
  const bob = Client(url, {
    auth: { token: jwt.sign({ id: 'user-2', name: 'Grace', email: 'grace@example.com' }, process.env.JWT_SECRET) },
    transports: ['websocket'],
  });

  await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

  alice.emit('chat:join', 'conv-1');
  bob.emit('chat:join', 'conv-1');
  const statusPromise = waitForEvent(alice, 'message:status');
  alice.emit('message:send', { conversationId: 'conv-1', content: 'Hi @Grace' });
  const status = await statusPromise;
  assert.equal(status.status, 'seen');

  alice.emit('doc:join', 'doc-1');
  const sync = await waitForEvent(alice, 'doc:sync');
  assert.equal(sync.revision, 0);

  const ackPromise = waitForEvent(alice, 'doc:ack');
  alice.emit('doc:update', {
    docId: 'doc-1',
    title: 'Spec v2',
    content: 'Updated content',
    baseRevision: 0,
    baseContent: 'Original content',
  });
  const ack = await ackPromise;
  assert.equal(ack.revision, 1);
  assert.equal(ack.content, 'Updated content');

  alice.disconnect();
  bob.disconnect();
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));

  Conversation.findOne = originals.conversationFindOne;
  Conversation.findByIdAndUpdate = originals.conversationFindByIdAndUpdate;
  Message.find = originals.messageFind;
  Message.create = originals.messageCreate;
  Message.findByIdAndUpdate = originals.messageFindByIdAndUpdate;
  Message.updateMany = originals.messageUpdateMany;
  Document.findOne = originals.documentFindOne;
  Document.findByIdAndUpdate = originals.documentFindByIdAndUpdate;
});
