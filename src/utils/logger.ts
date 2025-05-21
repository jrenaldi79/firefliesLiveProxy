import { config } from '@/config/environment';

const logLevels = ['error', 'warn', 'info', 'debug'] as const;
type LogLevel = (typeof logLevels)[number];

class Logger {
  private readonly level: number;
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
    this.level = logLevels.indexOf(
      (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info'
    );
  }

  private shouldLog(level: LogLevel): boolean {
    return logLevels.indexOf(level) <= this.level;
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level: level.toUpperCase(),
      name: this.name,
      message,
    };

    if (meta) {
      logEntry.meta = meta;
    }

    const logString = JSON.stringify(logEntry);
    
    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'debug':
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  }

  error(message: string, meta?: unknown): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: unknown): void {
    this.log('debug', message, meta);
  }
}

export const logger = new Logger('app');

export const createLogger = (name: string): Logger => {
  return new Logger(name);
};
