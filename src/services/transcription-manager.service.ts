import { io, Socket } from 'socket.io-client';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import { databaseService } from './database.service.js';

interface TranscriptionEvent {
  transcript_id: string;
  chunk_id: string;
  text: string;
  speaker_name: string;
  start_time: number;
  end_time: number;
}

// Interface for the wrapper object received from Fireflies WebSocket
interface FirefliesMessageWrapper {
  type: string;
  message?: string; // Optional as some events might not have it
  timestamp: string;
  payload: TranscriptionEvent;
}

export class TranscriptionManager {
  private socket: Socket | null = null;
  private requestId: string | null = null;
  private transcriptionId: string | null = null;
  private buffer: TranscriptionEvent[] = [];
  private lastFlushTime: number = 0;
  private readonly FLUSH_INTERVAL = 15000; // 15 seconds
  private readonly INACTIVITY_TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes
  private inactivityTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessingFlag: boolean = false; // Renamed to avoid conflict with getter

  public getRequestId(): string | null {
    return this.requestId;
  }

  public isProcessing(): boolean {
    return this.isProcessingFlag;
  }

  /**
   * Starts a new transcription session
   */
  public async startTranscription(requestId: string, transcriptionId: string): Promise<void> {
    this.requestId = requestId;
    this.transcriptionId = transcriptionId;
    this.buffer = [];
    this.lastFlushTime = Date.now();
    this.isProcessingFlag = true;

    logger.info('Starting transcription session', { requestId, transcriptionId });

    try {
      // Initialize the WebSocket connection
      this.socket = io('wss://api.fireflies.ai', {
        path: '/ws/realtime',
        auth: {
          token: `Bearer ${config.fireflies.apiKey}`,
          transcriptId: transcriptionId,
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        transports: ['websocket'] // Force WebSocket transport
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Start the flush timer
      this.startFlushTimer();
      // Start the inactivity timer
      this.resetInactivityTimer();

      // The database request is already marked as 'processing' during creation in transcription.routes.ts
      // No need to update status here again.

      logger.info('Transcription session started successfully', { requestId });
    } catch (error) {
      logger.error('Failed to start transcription session', { 
        requestId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      await this.handleError('Failed to start transcription session');
      throw error;
    }
  }

  /**
   * Stops the transcription session
   */
  public async stopTranscription(): Promise<void> {
    logger.info('Stopping transcription session', { requestId: this.requestId });
    
    this.isProcessingFlag = false;
    
    // Clear the flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining buffered data
    if (this.buffer.length > 0) {
      await this.flushBuffer();
    }

    // Close the WebSocket connection
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Update the database to mark the request as completed
    if (this.requestId) {
      await databaseService.updateTranscriptionRequest(this.requestId, "", 'completed');
    }

    logger.info('Transcription session stopped', { requestId: this.requestId });
  }

  /**
   * Sets up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('WebSocket connected', { requestId: this.requestId });
    });

    this.socket.on('disconnect', (reason) => {
      logger.info('WebSocket disconnected', { 
        requestId: this.requestId, 
        reason 
      });

      if (this.isProcessing()) {
        logger.warn('Unexpected WebSocket disconnection', { 
          requestId: this.requestId, 
          reason 
        });
        
        // Attempt to reconnect if this was an unexpected disconnection
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          logger.info('Attempting to reconnect...', { requestId: this.requestId });
          this.socket?.connect();
        } else {
          this.handleError('WebSocket disconnected unexpectedly');
        }
      }
    });

    this.socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error', { 
        requestId: this.requestId, 
        error: error.message 
      });
      this.handleError(`WebSocket connection error: ${error.message}`);
    });

    this.socket.on('auth.success', (data) => {
      logger.info('Authentication successful', { 
        requestId: this.requestId, 
        data 
      });
    });

    this.socket.on('auth.failed', (error) => {
      logger.error('Authentication failed', { 
        requestId: this.requestId, 
        error 
      });
      this.handleError(`Authentication failed: ${error}`);
    });

    this.socket.on('transcription.broadcast', async (messageWrapper: FirefliesMessageWrapper) => {
      this.resetInactivityTimer(); // Reset timer upon receiving a transcription event

      logger.debug('Received transcription.broadcast event', { requestId: this.requestId, event: messageWrapper });
      
      // Ensure payload exists and is of expected type before processing
      if (!messageWrapper.payload || typeof messageWrapper.payload !== 'object') {
        logger.warn('Received transcription.broadcast with missing or invalid payload', {
          requestId: this.requestId,
          receivedEvent: messageWrapper
        });
        return; // Skip processing this event
      }
      try {
        // Add the event's payload (which is the TranscriptionEvent) to the buffer
        this.buffer.push(messageWrapper.payload);
        
        // Check if we should flush the buffer
        const now = Date.now();
        if (now - this.lastFlushTime >= this.FLUSH_INTERVAL) {
          await this.flushBuffer();
          this.lastFlushTime = now;
        }
      } catch (error) {
        logger.error('Error processing transcription event', { 
          requestId: this.requestId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        this.handleError('Error processing transcription event');
      }
    });
  }

  /**
   * Starts the buffer flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      if (this.buffer.length > 0) {
        await this.flushBuffer();
      }
      this.lastFlushTime = Date.now();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Flushes the buffer to the database
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0 || !this.requestId) return;

    try {
      // Process the buffer to create a readable transcript
      const transcript = this.processBufferToTranscript();
      
      // Update the database with the latest transcript
      await databaseService.updateTranscriptionRequest(this.requestId, transcript);

      // Clear the buffer
      this.buffer = [];
      
      logger.debug('Buffer flushed to database', { 
        requestId: this.requestId,
        transcriptLength: transcript.length 
      });
    } catch (error) {
      logger.error('Failed to flush buffer to database', { 
        requestId: this.requestId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
  /**
   * Resets the inactivity timer.
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    this.inactivityTimer = setTimeout(() => {
      this.handleInactivityTimeout();
    }, this.INACTIVITY_TIMEOUT_DURATION);
  }

  /**
   * Handles the inactivity timeout event.
   */
  private async handleInactivityTimeout(): Promise<void> {
    logger.warn(
      `No Fireflies messages received for ${this.INACTIVITY_TIMEOUT_DURATION / 60000} minutes. Automatically stopping transcription.`, 
      { requestId: this.requestId }
    );
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    // Ensure buffer is flushed before stopping, in case there are lingering items
    if (this.buffer.length > 0) {
      logger.info('Flushing buffer before inactivity stop.', { requestId: this.requestId });
      await this.flushBuffer();
    }
    await this.stopTranscription(); 
  }

  /**
   * Processes the buffer to create a readable transcript
   */
  private processBufferToTranscript(): string {
    // Group events by chunk_id to handle updates to the same chunk
    const chunks = new Map<string, TranscriptionEvent>();
    
    for (const event of this.buffer) {
      chunks.set(event.chunk_id, event);
    }

    // Convert chunks to array, sort by start_time, and format
    return Array.from(chunks.values())
      .sort((a, b) => a.start_time - b.start_time)
      .map(event => {
        const speaker = event.speaker_name || 'Unknown Speaker';
        const text = event.text || '';
        if (!text.trim() && speaker === 'Unknown Speaker') {
             return '';
        }
        return `${speaker}: ${text}`;
      })
      .filter(line => line.length > 0)
      .join('\n');
  }

  /**
   * Handles errors during transcription
   */
  private async handleError(message: string): Promise<void> {
    this.isProcessingFlag = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.requestId) {
      try {
        await databaseService.updateTranscriptionRequest(this.requestId, "", 'error', message);
      } catch (error) {
        logger.error('Failed to update transcription request with error status', { 
          requestId: this.requestId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    logger.error('Transcription error', { 
      requestId: this.requestId, 
      message 
    });
  }
}

export const transcriptionManager = new TranscriptionManager();
