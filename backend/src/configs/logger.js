// logger.js
const bunyan = require('bunyan');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { CONSTANTS } = require('./constants');

class Logger {
  constructor() {
    // Ensure logs directory exists
    this.logsDir = path.join(process.cwd(), 'logs');
    this._ensureLogsDirectory();

    const streams = this._setupStreams();

    this.logger = bunyan.createLogger({
      name: process.env.APP_NAME || 'payschool-be-platform',
      streams,
      serializers: {
        err: bunyan.stdSerializers.err,
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res,
      },
      fields: {
        environment: process.env.NODE_ENV || 'STAGING',
        version: process.env.APP_VERSION || '1.0.0',
      },
    });
  }

  _ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  _setupStreams() {
    const streams = [];

    // Console stream for staging
    if (process.env.NODE_ENV !== CONSTANTS.Environments.PRODUCTION) {
      streams.push({
        level: 'debug',
        stream: process.stdout,
      });
    }

    // File streams with absolute paths
    streams.push(
      {
        level: 'error',
        path: path.join(this.logsDir, 'error.log'),
        type: 'rotating-file',
        period: '1d', // daily rotation
        count: 7, // keep 7 days of logs
      },
      {
        level: 'info',
        path: path.join(this.logsDir, 'combined.log'),
        type: 'rotating-file',
        period: '1d', // daily rotation
        count: 14, // keep 14 days of logs
      }
    );

    return streams;
  }

  child(options) {
    return this.logger.child(options);
  }

  error(message, type, subtype, error, meta = {}) {
    this.logger.error(
      {
        type,
        subtype,
        ...meta,
        err: error,
      },
      message
    );
  }

  warn(message, type, subtype, meta = {}) {
    this.logger.warn(
      {
        type,
        subtype,
        ...meta,
      },
      message
    );
  }

  info(message, type, subtype, meta = {}) {
    this.logger.info(
      {
        type,
        subtype,
        ...meta,
      },
      message
    );
  }

  debug(message, type, subtype, meta = {}) {
    this.logger.debug(
      {
        type,
        subtype,
        ...meta,
      },
      message
    );
  }

  requestIdMiddleware() {
    return (req, res, next) => {
      req.id = req.headers['x-request-id'] || uuidv4();
      res.setHeader('x-request-id', req.id);
      next();
    };
  }

  requestLogger() {
    return (req, res, next) => {
      const startTime = process.hrtime();

      req.log = this.child({
        reqId: req.id,
        component: 'http',
      });

      req.log.info(
        {
          type: 'HTTP',
          subtype: 'REQUEST_START',
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: req.query,
          ip: req.ip,
        },
        'Request started'
      );

      const originalEnd = res.end;
      res.end = (...args) => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);

        req.log.info(
          {
            type: 'HTTP',
            subtype: 'REQUEST_END',
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            responseHeaders: res.getHeaders(),
          },
          'Request completed'
        );

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  errorLogger() {
    return (err, req, res, next) => {
      (req.log || this.logger).error(
        {
          type: 'HTTP',
          timestamp: new Date().toISOString(),
          errorName: err.name,
          statusCode: err.statusCode || err.status || 500,
          // Include operational error specific details
          ...(err.isOperational && {
            isOperational: true,
            context: err.context,
            internalCode: err.internalCode,
          }),
          // Include validation error specific details
          ...(err instanceof ValidationError && {
            validationDetails: err.details,
          }),
          errorMessage: err.message,
          stackTrace: err.stack,
          subtype: 'ERROR',
          err: err,
          method: req.method,
          url: req.url,
          ip: req.ip,
          reqId: req.id,
          request: {
            body: req.body,
            query: req.query,
            params: req.params,
            headers: {
              ...req.headers,
              authorization: req.headers.authorization
                ? '[REDACTED]'
                : undefined,
            },
            userId: req.user?.id,
          },
        },
        'Request error occurred'
      );

      next(err);
    };
  }
}

// Create singleton instance
const logger = new Logger();
module.exports = logger;
