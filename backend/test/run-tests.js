const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const User = require('../src/models/User');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Document = require('../src/models/Document');
const Workspace = require('../src/models/Workspace');
const Page = require('../src/models/Page');
const Task = require('../src/models/Task');
const { register, login, me } = require('../src/auth/auth.controller');
const workspaceAccess = require('../src/workspace/workspace.access');
const { generateAssistantText, extractActionsWithAI } = require('../src/ai/ai.service');
const { createApp } = require('../src/app');
const { clearModules } = require('./helpers/module');
const { apiRequest, createQueryResult, createToken, startServer } = require('./helpers/http');

const results = [];

async function run(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok - ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function callHandler(handler, req, res = createRes()) {
  return new Promise((resolve, reject) => {
    handler(req, res, (err) => (err ? reject(err) : resolve(res)));
  });
}

function waitForEvent(socket, eventName) {
  return new Promise((resolve) => socket.once(eventName, resolve));
}

async function runAuthControllerChecks() {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalFindById = User.findById;

  try {
    User.findOne = async () => null;
    User.create = async ({ name, email }) => ({
      _id: 'user-1',
      name,
      email,
      status: 'offline',
      toPublic() {
        return { id: this._id, name: this.name, email: this.email, status: this.status };
      },
    });

    const registerRes = await callHandler(register, {
      body: { name: 'Ada', email: 'ada@example.com', password: 'supersecret' },
    });
    assert.equal(registerRes.statusCode, 201);
    assert.equal(registerRes.body.user.email, 'ada@example.com');
    assert.equal(typeof registerRes.body.token, 'string');

    User.findOne = async () => ({ comparePassword: async () => false });
    await assert.rejects(
      callHandler(login, { body: { email: 'ada@example.com', password: 'wrong' } }),
      { code: 'INVALID_CREDENTIALS' }
    );

    User.findById = async () => ({
      _id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      status: 'online',
      toPublic() {
        return { id: this._id, name: this.name, email: this.email, status: this.status };
      },
    });

    const meRes = await callHandler(me, { user: { id: 'user-1' } });
    assert.deepEqual(meRes.body.user, {
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      status: 'online',
    });
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    User.findById = originalFindById;
  }
}

async function runWorkspaceAccessChecks() {
  const workspace = {
    ownerId: 'owner-1',
    members: [
      { userId: 'editor-1', role: 'editor' },
      { userId: 'viewer-1', role: 'viewer' },
    ],
  };

  assert.equal(workspaceAccess.normalizeId(42), '42');
  assert.equal(workspaceAccess.getRoleForUser(workspace, 'owner-1'), 'owner');
  assert.equal(workspaceAccess.getRoleForUser(workspace, 'editor-1'), 'editor');
  assert.equal(workspaceAccess.hasRole(workspace, 'editor-1', 'viewer'), true);
  assert.equal(workspaceAccess.hasRole(workspace, 'viewer-1', 'editor'), false);
  assert.deepEqual(workspaceAccess.workspaceFilterForUser('user-9'), {
    $or: [{ ownerId: 'user-9' }, { 'members.userId': 'user-9' }],
  });
}

async function runAiChecks() {
  const originalApiKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  try {
    const summary = await generateAssistantText(
      'Summarize the discussion',
      'Kickoff went well. - Fix onboarding bug by Friday. Review analytics dashboard next week.',
      'chat'
    );
    assert.equal(summary.provider, 'fallback');
    assert.match(summary.text, /Action items:/);

    const actions = await extractActionsWithAI(`
      - Review sprint board
      Next step: ship the release notes
      Follow up with design on the landing page
    `);
    assert.equal(actions.provider, 'fallback');
    assert.equal(actions.actions.length, 3);
  } finally {
    process.env.GROQ_API_KEY = originalApiKey;
  }
}

async function runAuthRouteChecks() {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalFindById = User.findById;

  let storedUser = null;

  try {
    User.findOne = async ({ email }) => {
      if (!storedUser || storedUser.email !== email) return null;
      return {
        ...storedUser,
        comparePassword: async (password) => password === 'supersecret',
        toPublic() {
          return { id: this._id, name: this.name, email: this.email, status: this.status };
        },
      };
    };
    User.create = async ({ name, email }) => {
      storedUser = { _id: 'user-1', name, email, status: 'offline' };
      return {
        ...storedUser,
        toPublic() {
          return { id: this._id, name: this.name, email: this.email, status: this.status };
        },
      };
    };
    User.findById = async () => ({
      ...storedUser,
      toPublic() {
        return { id: this._id, name: this.name, email: this.email, status: this.status };
      },
    });

    clearModules(['../src/auth/auth.routes']);
    const handle = await startServer(createApp());
    try {
      const registerResponse = await apiRequest(handle.baseUrl, '/auth/register', {
        method: 'POST',
        body: { name: 'Ada', email: 'ada@example.com', password: 'supersecret' },
      });
      assert.equal(registerResponse.status, 201);

      const loginResponse = await apiRequest(handle.baseUrl, '/auth/login', {
        method: 'POST',
        body: { email: 'ada@example.com', password: 'supersecret' },
      });
      assert.equal(loginResponse.status, 200);

      const meResponse = await apiRequest(handle.baseUrl, '/auth/me', {
        token: createToken({ id: 'user-1', name: 'Ada', email: 'ada@example.com' }),
      });
      assert.equal(meResponse.status, 200);
      assert.equal(meResponse.body.user.id, 'user-1');
    } finally {
      await handle.close();
    }
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    User.findById = originalFindById;
  }
}

async function runCoreRouteChecks() {
  const originals = {
    conversationCreate: Conversation.create,
    conversationFind: Conversation.find,
    conversationFindOne: Conversation.findOne,
    messageFind: Message.find,
    documentCreate: Document.create,
    documentFind: Document.find,
    documentFindOne: Document.findOne,
    documentFindOneAndUpdate: Document.findOneAndUpdate,
    workspaceFind: Workspace.find,
    workspaceCreate: Workspace.create,
    workspaceFindOne: Workspace.findOne,
    pageFind: Page.find,
    pageFindOne: Page.findOne,
    pageCreate: Page.create,
    pageFindById: Page.findById,
    pageFindByIdAndUpdate: Page.findByIdAndUpdate,
    pageDeleteMany: Page.deleteMany,
    userFind: User.find,
    taskFind: Task.find,
    taskCreate: Task.create,
    taskFindById: Task.findById,
    taskFindByIdAndUpdate: Task.findByIdAndUpdate,
  };

  const state = {
    conversations: [],
    documents: [],
    workspace: {
      _id: 'ws-1',
      name: 'Product',
      ownerId: 'user-1',
      members: [{ userId: 'user-1', role: 'owner' }],
      async save() {
        return this;
      },
    },
    pages: [],
    tasks: [],
    users: [{ _id: 'user-1', name: 'Ada', email: 'ada@example.com', status: 'online' }],
  };

  try {
    Conversation.find = () => createQueryResult(state.conversations);
    Conversation.findOne = ({ _id }) => Promise.resolve(state.conversations.find((item) => item._id === _id) || null);
    Conversation.create = async ({ participants, name }) => {
      const conversation = {
        _id: 'conv-1',
        participants,
        name,
        updatedAt: '2026-04-07T10:00:00.000Z',
        toObject() {
          return { _id: this._id, participants: this.participants, name: this.name, updatedAt: this.updatedAt };
        },
        async populate() {
          return this;
        },
      };
      state.conversations.push(conversation);
      return conversation;
    };
    Message.find = () => createQueryResult([
      {
        _id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Hello team',
        senderId: { _id: 'user-1', name: 'Ada', email: 'ada@example.com' },
        createdAt: '2026-04-07T10:01:00.000Z',
      },
    ]);

    Document.find = () => createQueryResult(state.documents);
    Document.create = async ({ title, content, revision, collaborators }) => {
      const doc = {
        _id: 'doc-1',
        title,
        content,
        revision,
        collaborators,
        updatedAt: '2026-04-07T10:02:00.000Z',
      };
      state.documents = [doc];
      return doc;
    };
    Document.findOne = ({ _id }) => ({
      async populate() {
        const doc = state.documents.find((item) => item._id === _id) || null;
        return doc ? { ...doc, collaborators: state.users } : null;
      },
    });
    Document.findOneAndUpdate = () => ({
      async populate() {
        return {
          ...state.documents[0],
          title: 'Updated Doc',
          content: 'Updated content',
          collaborators: state.users,
        };
      },
    });

    Workspace.find = () => createQueryResult([state.workspace]);
    Workspace.create = async ({ name, ownerId, members }) => ({ _id: 'ws-2', name, ownerId, members });
    Workspace.findOne = async ({ _id }) => (_id === 'ws-1' ? state.workspace : null);

    Page.find = () => createQueryResult(state.pages);
    Page.findOne = () => ({
      sort() {
        return {
          select() {
            return Promise.resolve(state.pages[state.pages.length - 1] || null);
          },
        };
      },
    });
    Page.create = async ({ title, content, parentId, order }) => {
      const page = {
        _id: 'page-1',
        workspaceId: 'ws-1',
        title,
        content,
        parentId,
        order,
        updatedAt: '2026-04-07T10:03:00.000Z',
      };
      state.pages.push(page);
      return page;
    };
    Page.findById = async (id) => state.pages.find((item) => item._id === id) || null;
    Page.findByIdAndUpdate = async (_id, { $set }) => ({ ...state.pages[0], ...$set });
    Page.deleteMany = async () => ({ acknowledged: true });

    User.find = () => ({
      select() {
        return Promise.resolve(state.users);
      },
    });

    Task.find = () => createQueryResult(state.tasks);
    Task.create = async ({ title, workspaceId, status, createdBy }) => {
      const task = {
        _id: 'task-1',
        title,
        workspaceId,
        status,
        createdBy,
        async populate() {
          return this;
        },
      };
      state.tasks.push(task);
      return task;
    };
    Task.findById = async (id) => state.tasks.find((item) => item._id === id) || null;
    Task.findByIdAndUpdate = () => ({
      populate() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({ ...state.tasks[0], status: 'done' }).then(resolve, reject);
      },
    });

    const handle = await startServer(createApp());
    const token = createToken({ id: 'user-1', name: 'Ada', email: 'ada@example.com' });
    try {
      assert.equal((await apiRequest(handle.baseUrl, '/chat/conversations', {
        method: 'POST',
        token,
        body: { participantIds: ['user-2'], name: 'Roadmap' },
      })).status, 201);

      const messagesResponse = await apiRequest(handle.baseUrl, '/chat/conversations/conv-1/messages', { token });
      assert.equal(messagesResponse.status, 200);
      assert.equal(messagesResponse.body[0].content, 'Hello team');

      assert.equal((await apiRequest(handle.baseUrl, '/docs', {
        method: 'POST',
        token,
        body: { title: 'Spec', content: 'Draft' },
      })).status, 201);

      assert.equal((await apiRequest(handle.baseUrl, '/docs/doc-1', { token })).status, 200);
      assert.equal((await apiRequest(handle.baseUrl, '/docs/doc-1', {
        method: 'PATCH',
        token,
        body: { title: 'Updated Doc', content: 'Updated content' },
      })).body.title, 'Updated Doc');

      assert.equal((await apiRequest(handle.baseUrl, '/workspaces', { token })).body[0].name, 'Product');
      assert.equal((await apiRequest(handle.baseUrl, '/workspaces', {
        method: 'POST',
        token,
        body: { name: 'Design' },
      })).status, 201);

      assert.equal((await apiRequest(handle.baseUrl, '/workspaces/ws-1/pages', {
        method: 'POST',
        token,
        body: { title: 'Launch Plan', content: 'Outline' },
      })).status, 201);
      assert.equal((await apiRequest(handle.baseUrl, '/workspaces/ws-1/pages', { token })).body[0].title, 'Launch Plan');
      assert.equal((await apiRequest(handle.baseUrl, '/workspaces/pages/page-1', {
        method: 'PATCH',
        token,
        body: { title: 'Launch Plan v2' },
      })).body.title, 'Launch Plan v2');

      assert.equal((await apiRequest(handle.baseUrl, '/workspaces/ws-1/members', { token })).body[0].user.name, 'Ada');

      assert.equal((await apiRequest(handle.baseUrl, '/tasks', {
        method: 'POST',
        token,
        body: { workspaceId: 'ws-1', title: 'Ship beta', status: 'todo' },
      })).status, 201);
      assert.equal((await apiRequest(handle.baseUrl, '/tasks?workspaceId=ws-1', { token })).body[0].title, 'Ship beta');
      assert.equal((await apiRequest(handle.baseUrl, '/tasks/task-1', {
        method: 'PATCH',
        token,
        body: { status: 'done' },
      })).body.status, 'done');
    } finally {
      await handle.close();
    }
  } finally {
    Conversation.create = originals.conversationCreate;
    Conversation.find = originals.conversationFind;
    Conversation.findOne = originals.conversationFindOne;
    Message.find = originals.messageFind;
    Document.create = originals.documentCreate;
    Document.find = originals.documentFind;
    Document.findOne = originals.documentFindOne;
    Document.findOneAndUpdate = originals.documentFindOneAndUpdate;
    Workspace.find = originals.workspaceFind;
    Workspace.create = originals.workspaceCreate;
    Workspace.findOne = originals.workspaceFindOne;
    Page.find = originals.pageFind;
    Page.findOne = originals.pageFindOne;
    Page.create = originals.pageCreate;
    Page.findById = originals.pageFindById;
    Page.findByIdAndUpdate = originals.pageFindByIdAndUpdate;
    Page.deleteMany = originals.pageDeleteMany;
    User.find = originals.userFind;
    Task.find = originals.taskFind;
    Task.create = originals.taskCreate;
    Task.findById = originals.taskFindById;
    Task.findByIdAndUpdate = originals.taskFindByIdAndUpdate;
  }
}

async function runRealtimeChecks() {
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

  try {
    Conversation.findOne = () => ({
      populate() {
        return Promise.resolve({
          _id: 'conv-1',
          name: 'Roadmap',
          participants: [{ _id: 'user-1', name: 'Ada' }, { _id: 'user-2', name: 'Grace' }],
        });
      },
    });
    Conversation.findByIdAndUpdate = async () => ({ acknowledged: true });
    Message.find = () => ({
      select() {
        return Promise.resolve([{ _id: 'msg-seen-1' }]);
      },
    });
    Message.create = async () => ({ _id: 'msg-1', createdAt: '2026-04-07T10:04:00.000Z' });
    Message.findByIdAndUpdate = async () => ({ acknowledged: true });
    Message.updateMany = async () => ({ acknowledged: true });
    Document.findOne = async ({ _id }) => (_id === 'doc-1'
      ? {
        _id: 'doc-1',
        title: 'Spec',
        content: 'Original content',
        revision: 0,
        collaborators: ['user-1', 'user-2'],
      }
      : null);
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
    const url = `http://127.0.0.1:${httpServer.address().port}`;
    const alice = Client(url, {
      auth: { token: jwt.sign({ id: 'user-1', name: 'Ada', email: 'ada@example.com' }, process.env.JWT_SECRET) },
      transports: ['websocket'],
    });
    const bob = Client(url, {
      auth: { token: jwt.sign({ id: 'user-2', name: 'Grace', email: 'grace@example.com' }, process.env.JWT_SECRET) },
      transports: ['websocket'],
    });

    try {
      await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);
      alice.emit('chat:join', 'conv-1');
      bob.emit('chat:join', 'conv-1');
      const statusPromise = waitForEvent(alice, 'message:status');
      alice.emit('message:send', { conversationId: 'conv-1', content: 'Hi @Grace' });
      assert.equal((await statusPromise).status, 'seen');

      alice.emit('doc:join', 'doc-1');
      assert.equal((await waitForEvent(alice, 'doc:sync')).revision, 0);

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
    } finally {
      alice.disconnect();
      bob.disconnect();
      await new Promise((resolve) => io.close(resolve));
      await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
    }
  } finally {
    Conversation.findOne = originals.conversationFindOne;
    Conversation.findByIdAndUpdate = originals.conversationFindByIdAndUpdate;
    Message.find = originals.messageFind;
    Message.create = originals.messageCreate;
    Message.findByIdAndUpdate = originals.messageFindByIdAndUpdate;
    Message.updateMany = originals.messageUpdateMany;
    Document.findOne = originals.documentFindOne;
    Document.findByIdAndUpdate = originals.documentFindByIdAndUpdate;
  }
}

(async () => {
  await run('auth controller unit checks', runAuthControllerChecks);
  await run('workspace access unit checks', runWorkspaceAccessChecks);
  await run('ai fallback unit checks', runAiChecks);
  await run('auth integration checks', runAuthRouteChecks);
  await run('core route integration checks', runCoreRouteChecks);
  await run('realtime integration checks', runRealtimeChecks);

  const failures = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failures.length}/${results.length} backend checks passed`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
})();
