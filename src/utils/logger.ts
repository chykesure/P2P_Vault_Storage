/**
 * Structured logging utility for the P2P Storage Vault.
 * Provides consistent log formatting and log levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Current minimum log level. Set to 'info' in production. */
const MIN_LOG_LEVEL: LogLevel = __DEV__ ? 'debug' : 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatMessage(level: LogLevel, tag: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
}

export const logger = {
  debug(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', tag, message), ...args);
    }
  },

  info(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('info')) {
      console.info(formatMessage('info', tag, message), ...args);
    }
  },

  warn(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', tag, message), ...args);
    }
  },

  error(tag: string, message: string, error?: unknown) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', tag, message), error);
    }
  },
};
