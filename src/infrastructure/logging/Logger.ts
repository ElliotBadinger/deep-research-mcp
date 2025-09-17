import pino from 'pino';
import { resolve } from 'path';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private logger: pino.Logger;

  constructor() {
    const logFile = resolve(process.cwd(), 'app.log');
    
    // Always write to file for debug-logs tool access
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info'
    }, pino.destination(logFile));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(context, message);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error({ ...context, error: error?.message, stack: error?.stack }, message);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(context, message);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(context, message);
  }
}

export const logger = new Logger();