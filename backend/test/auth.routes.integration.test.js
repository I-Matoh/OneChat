const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const User = require('../src/models/User');
const { apiRequest, createToken, startServer } = require('./helpers/http');
const { clearModules } = require('./helpers/module');

test('auth routes cover register, login, and me', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalFindById = User.findById;

  let storedUser = null;

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

  User.findById = async (id) => (id === 'user-1'
    ? {
      ...storedUser,
      toPublic() {
        return { id: this._id, name: this.name, email: this.email, status: this.status };
      },
    }
    : null);

  clearModules(['../src/app', '../src/auth/auth.routes']);
  const { createApp } = require('../src/app');
  const handle = await startServer(createApp());

  const registerResponse = await apiRequest(handle.baseUrl, '/auth/register', {
    method: 'POST',
    body: { name: 'Ada', email: 'ada@example.com', password: 'supersecret' },
  });
  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.user.name, 'Ada');

  const loginResponse = await apiRequest(handle.baseUrl, '/auth/login', {
    method: 'POST',
    body: { email: 'ada@example.com', password: 'supersecret' },
  });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.user.email, 'ada@example.com');

  const meResponse = await apiRequest(handle.baseUrl, '/auth/me', {
    token: createToken({ id: 'user-1', name: 'Ada', email: 'ada@example.com' }),
  });
  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.user.id, 'user-1');

  await handle.close();
  User.findOne = originalFindOne;
  User.create = originalCreate;
  User.findById = originalFindById;
});
