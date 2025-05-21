import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

export const config = {
  // Server
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  // Fireflies.ai
  fireflies: {
    apiKey: process.env.FIREFLIES_API_KEY || '',
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Application
  app: {
    name: 'Fireflies Proxy Service',
    version: '1.0.0',
  },
} as const;

export type Config = typeof config;
