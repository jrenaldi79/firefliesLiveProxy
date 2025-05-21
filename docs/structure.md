# Project Structure Documentation

This document outlines the structure of the Fireflies.ai Proxy Service, providing a detailed overview of each directory and file's purpose.

## Root Directory

- `.env.example` - Example environment variables file (copy to `.env` for local development)
- `.eslintrc.js` - ESLint configuration for code linting
- `.gitignore` - Specifies intentionally untracked files to ignore
- `.prettierrc` - Prettier configuration for code formatting
- `package.json` - Project manifest with dependencies and scripts
- `README.md` - Project documentation and setup instructions
- `tsconfig.json` - TypeScript configuration

## Source Code (`/src`)

### API Layer (`/src/api`)
- `routes/` - Express route definitions
  - `transcription.routes.ts` - API endpoints for transcription operations

### Configuration (`/src/config`)
- `environment.ts` - Environment variable validation and configuration
- `module-alias.ts` - Module alias configuration for cleaner imports

### Interfaces (`/src/interfaces`)
- `database.types.ts` - TypeScript interfaces for database models
- `transcription.types.ts` - TypeScript interfaces for transcription data

### Services (`/src/services`)
- `database.service.ts` - Handles all database operations with Supabase
- `transcription-manager.service.ts` - Manages WebSocket connections to Fireflies.ai

### Utilities (`/src/utils`)
- `logger.ts` - Centralized logging utility
- `id-generator.ts` - Utility for generating unique IDs

### Application Files
- `app.ts` - Express application setup with middleware
- `server.ts` - Server entry point with graceful shutdown handling

## Scripts (`/scripts`)
- `setup-db.ts` - Script to set up the database schema
- `test-api.ts` - Script for testing API endpoints

## Supabase (`/supabase`)
- `migrations/` - Database migration files
  - `20230521150000_create_initial_schema.sql` - Initial database schema

## Documentation (`/docs`)
- `structure.md` - This file, documenting the project structure

## Development Workflow

### Key Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run setup:db` - Set up the database schema
- `npm run test:api` - Test API endpoints

### Environment Variables
Required environment variables are documented in `.env.example`. Copy this file to `.env` and fill in the required values.
