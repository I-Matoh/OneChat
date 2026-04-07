const http = require('http');
const jwt = require('jsonwebtoken');

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    },
  };
}

async function apiRequest(baseUrl, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function createToken(user = { id: 'user-1', name: 'Test User', email: 'test@example.com' }) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function createQueryResult(initialValue) {
  let value = initialValue;
  const query = {
    populate() {
      return query;
    },
    select() {
      return query;
    },
    sort(sortShape) {
      if (Array.isArray(value) && sortShape?.updatedAt === -1) {
        value = [...value].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      }
      return query;
    },
    skip(amount) {
      if (Array.isArray(value)) value = value.slice(amount);
      return query;
    },
    limit(amount) {
      if (Array.isArray(value)) value = value.slice(0, amount);
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
}

module.exports = {
  apiRequest,
  createQueryResult,
  createToken,
  startServer,
};
