import pino, { type LoggerOptions } from 'pino';

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
};

if (process.env.NODE_ENV === 'development') {
  options.transport = {
    target: 'pino-pretty',
    options: { colorize: true },
  };
}

export const Logger = pino(options);
