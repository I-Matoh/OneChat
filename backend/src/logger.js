const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'onechat-backend',
  },
});

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  customProps: (req) => ({ requestId: req.id }),
});

function requestIdMiddleware(req, res, next) {
  req.requestId = req.id;
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = {
  logger,
  httpLogger,
  requestIdMiddleware,
};

