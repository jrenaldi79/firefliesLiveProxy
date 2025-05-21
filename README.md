# Fireflies.ai Proxy Service

A Node.js service that provides a REST API to start and monitor real-time transcriptions from Fireflies.ai.

## Features

- Start a real-time transcription session for a Fireflies.ai meeting
- Monitor the status of transcription requests
- Store transcription data in Supabase
- Automatic reconnection handling for WebSocket connections
- Configurable buffering of transcription chunks
- Manually stop an active transcription session via API
- Automatic 10-minute inactivity timer to stop sessions if no speech is detected from Fireflies

## Prerequisites

- Node.js 16.x or later
- npm or yarn
- Supabase account and project
- Fireflies.ai API key with access to the Realtime API

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` file with your Supabase and Fireflies.ai credentials

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Port to run the server on | No | 3000 |
| NODE_ENV | Node environment | No | development |
| SUPABASE_URL | Supabase project URL | Yes | |
| SUPABASE_ANON_KEY | Supabase anonymous key | Yes | |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key | Yes | |
| FIREFLIES_API_KEY | Fireflies.ai API key | Yes | |
| LOG_LEVEL | Logging level | No | info |

## API Endpoints

### Start a Transcription

```http
POST /api/transcription/start
```

Initiates a real-time transcription for the given Fireflies.ai `transcriptionId`.

**Request Body:**

```json
{
  "transcriptionId": "your-fireflies-transcription-id",
  "requestId": "your-optional-client-provided-uuid" 
}
```
- `transcriptionId` (string, required): The transcription ID from Fireflies.ai.
- `requestId` (string, optional): A client-provided UUID for the request. If not provided, the server will generate one.

**Success Response (202):**

```json
{
  "requestId": "server-generated-or-client-provided-uuid",
  "status": "processing",
  "message": "Transcription process initiated successfully."
}
```

### Get Transcription Status

```http
GET /api/transcription/status/:requestId
```

Retrieves the current status and content of a transcription request.

**URL Parameters:**
- `requestId` (string, required): The ID of the transcription request (returned by the `/start` endpoint).

**Success Response (200):**

```json
{
  "requestId": "unique-request-id",
  "status": "processing", // or "completed", "error"
  "content": "Transcription content...",
  "error": null, // or an error message string
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:01:00.000Z"
}
```

### Stop a Transcription

```http
POST /api/transcription/stop
```

Manually stops an active transcription session.

**Request Body:**

```json
{
  "requestId": "unique-request-id-from-start"
}
```
- `requestId` (string, required): The ID of the transcription request to stop (returned by the `/start` endpoint).

**Success Response (200):**

```json
{
  "requestId": "unique-request-id-from-start",
  "status": "completed",
  "message": "Transcription session stopped successfully."
}
```

## Database Schema

### transcription_requests

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| transcription_id | TEXT | Fireflies.ai transcription ID |
| status | TEXT | Current status (processing/completed/error) |
| content | TEXT | Transcription content |
| error_message | TEXT | Error message if status is error |
| created_at | TIMESTAMP | When the request was created |
| updated_at | TIMESTAMP | When the request was last updated |
| last_event_at | TIMESTAMP | When the last event was received |

## Running the Application

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Deployment

This service is designed to be deployed as a long-running process. It is not suitable for serverless environments due to the persistent WebSocket connection requirement.

Recommended deployment options:

- Containerized deployment (Docker) on platforms like:
  - Google Cloud Run (with CPU always allocated)
  - AWS ECS/Fargate
  - Azure Container Instances
  - DigitalOcean App Platform
- Traditional VM/Server (e.g., AWS EC2, Google Compute Engine)

## License

MIT
