import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import transcriptionRoutes from '@/api/routes/transcription.routes.js';

export class App {
  private app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security headers
    // this.app.use(helmet()); // Temporarily disabled for testing
    
    // Enable CORS
    this.app.use(cors());
    
    // Parse JSON request body
    this.app.use(express.json());
    
    // Parse URL-encoded request body
    this.app.use(express.urlencoded({ extended: true }));
    
    // Response compression
    // this.app.use(compression()); // Temporarily disabled for testing
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration,
          userAgent: req.get('user-agent'),
          ip: req.ip,
        });
      });
      
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // API routes
    this.app.use('/api/transcription', transcriptionRoutes);

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
      });
    });
  }

  private initializeErrorHandling(): void {
    // Error handling middleware
    this.app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error', {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });

      const statusCode = err.statusCode || 500;
      const message = statusCode === 500 ? 'Internal Server Error' : err.message;

      res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    });
  }

  public getServer(): Application {
    return this.app;
  }

  public async start(): Promise<void> {
    const port = config.port;
    
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Server is running on port ${port}`, {
          environment: config.nodeEnv,
          port,
        });
        resolve();
      });
    });
  }
}

export const app = new App();
