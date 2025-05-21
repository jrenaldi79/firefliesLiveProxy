import 'module-alias/register';
import 'dotenv/config';
import { app } from './app';
import { logger } from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // Consider whether to exit the process or not
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider whether to exit the process or not
  // process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  // Add any cleanup logic here
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully');
  // Add any cleanup logic here
  process.exit(0);
});

// Start the server
const start = async () => {
  try {
    await app.start();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
