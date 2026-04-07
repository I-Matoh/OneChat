const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Document = require('../src/models/Document');
const Workspace = require('../src/models/Workspace');
const Page = require('../src/models/Page');
const Task = require('../src/models/Task');
const User = require('../src/models/User');
const { apiRequest, createQueryResult, createToken, startServer } = require('./helpers/http');
const { clearModules } = require('./helpers/module');

test('chat, docs, workspace, page, member, and task APIs cover the critical path', async () => {
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

  Conversation.find = () => createQueryResult(state.conversations);
  Conversation.findOne = ({ _id }) => Promise.resolve(
    state.conversations.find((item) => item._id === _id) || null
  );
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
  Document.findOne = ({ _id }) => {
    const doc = state.documents.find((item) => item._id === _id) || null;
    return {
      async populate() {
        return doc ? { ...doc, collaborators: state.users } : null;
      },
    };
  };
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
  Workspace.create = async ({ name, ownerId, members }) => ({
    _id: 'ws-2',
    name,
    ownerId,
    members,
  });
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

  clearModules([
    '../src/app',
    '../src/chat/chat.routes',
    '../src/collaboration/collab.routes',
    '../src/workspace/workspace.routes',
    '../src/tasks/task.routes',
  ]);
  const { createApp } = require('../src/app');
  const handle = await startServer(createApp());
  const token = createToken({ id: 'user-1', name: 'Ada', email: 'ada@example.com' });

  const conversationResponse = await apiRequest(handle.baseUrl, '/chat/conversations', {
    method: 'POST',
    token,
    body: { participantIds: ['user-2'], name: 'Roadmap' },
  });
  assert.equal(conversationResponse.status, 201);
  assert.equal(conversationResponse.body.name, 'Roadmap');

  const messagesResponse = await apiRequest(handle.baseUrl, '/chat/conversations/conv-1/messages', { token });
  assert.equal(messagesResponse.status, 200);
  assert.equal(messagesResponse.body[0].content, 'Hello team');

  const docCreateResponse = await apiRequest(handle.baseUrl, '/docs', {
    method: 'POST',
    token,
    body: { title: 'Spec', content: 'Draft' },
  });
  assert.equal(docCreateResponse.status, 201);

  const docGetResponse = await apiRequest(handle.baseUrl, '/docs/doc-1', { token });
  assert.equal(docGetResponse.status, 200);
  assert.equal(docGetResponse.body.title, 'Spec');

  const docPatchResponse = await apiRequest(handle.baseUrl, '/docs/doc-1', {
    method: 'PATCH',
    token,
    body: { title: 'Updated Doc', content: 'Updated content' },
  });
  assert.equal(docPatchResponse.status, 200);
  assert.equal(docPatchResponse.body.title, 'Updated Doc');

  const workspacesResponse = await apiRequest(handle.baseUrl, '/workspaces', { token });
  assert.equal(workspacesResponse.status, 200);
  assert.equal(workspacesResponse.body[0].name, 'Product');

  const workspaceCreateResponse = await apiRequest(handle.baseUrl, '/workspaces', {
    method: 'POST',
    token,
    body: { name: 'Design' },
  });
  assert.equal(workspaceCreateResponse.status, 201);

  const pageCreateResponse = await apiRequest(handle.baseUrl, '/workspaces/ws-1/pages', {
    method: 'POST',
    token,
    body: { title: 'Launch Plan', content: 'Outline' },
  });
  assert.equal(pageCreateResponse.status, 201);

  const pageListResponse = await apiRequest(handle.baseUrl, '/workspaces/ws-1/pages', { token });
  assert.equal(pageListResponse.status, 200);
  assert.equal(pageListResponse.body[0].title, 'Launch Plan');

  const pagePatchResponse = await apiRequest(handle.baseUrl, '/workspaces/pages/page-1', {
    method: 'PATCH',
    token,
    body: { title: 'Launch Plan v2' },
  });
  assert.equal(pagePatchResponse.status, 200);
  assert.equal(pagePatchResponse.body.title, 'Launch Plan v2');

  const membersResponse = await apiRequest(handle.baseUrl, '/workspaces/ws-1/members', { token });
  assert.equal(membersResponse.status, 200);
  assert.equal(membersResponse.body[0].user.name, 'Ada');

  const taskCreateResponse = await apiRequest(handle.baseUrl, '/tasks', {
    method: 'POST',
    token,
    body: { workspaceId: 'ws-1', title: 'Ship beta', status: 'todo' },
  });
  assert.equal(taskCreateResponse.status, 201);

  const taskListResponse = await apiRequest(handle.baseUrl, '/tasks?workspaceId=ws-1', { token });
  assert.equal(taskListResponse.status, 200);
  assert.equal(taskListResponse.body[0].title, 'Ship beta');

  const taskPatchResponse = await apiRequest(handle.baseUrl, '/tasks/task-1', {
    method: 'PATCH',
    token,
    body: { status: 'done' },
  });
  assert.equal(taskPatchResponse.status, 200);
  assert.equal(taskPatchResponse.body.status, 'done');

  await handle.close();

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
});
