const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';

const User = require('../src/models/User');
const { register, login, me } = require('../src/auth/auth.controller');
const { AppError } = require('../src/middleware/errors');

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

test('register creates a user and returns a token', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

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

  const req = { body: { name: 'Ada', email: 'ada@example.com', password: 'supersecret' } };
  const res = createRes();

  await new Promise((resolve, reject) => register(req, res, (err) => (err ? reject(err) : resolve())));

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.email, 'ada@example.com');
  assert.equal(typeof res.body.token, 'string');

  User.findOne = originalFindOne;
  User.create = originalCreate;
});

test('login rejects an invalid password', async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => ({
    comparePassword: async () => false,
  });

  const req = { body: { email: 'ada@example.com', password: 'wrong' } };
  const res = createRes();

  await new Promise((resolve) => {
    login(req, res, (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.code, 'INVALID_CREDENTIALS');
      resolve();
    });
  });

  User.findOne = originalFindOne;
});

test('me returns the current public user', async () => {
  const originalFindById = User.findById;
  User.findById = async () => ({
    _id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    status: 'online',
    toPublic() {
      return { id: this._id, name: this.name, email: this.email, status: this.status };
    },
  });

  const req = { user: { id: 'user-1' } };
  const res = createRes();
  await new Promise((resolve, reject) => me(req, res, (err) => (err ? reject(err) : resolve())));

  assert.deepEqual(res.body.user, {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    status: 'online',
  });

  User.findById = originalFindById;
});
