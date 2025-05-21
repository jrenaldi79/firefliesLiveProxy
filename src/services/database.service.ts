import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';

type Database = {
  public: {
    Tables: {
      transcription_requests: {
        Row: {
          id: string;
          transcription_id: string;
          status: 'processing' | 'completed' | 'error';
          content: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          last_event_at: string | null;
        };
        Insert: {
          id: string;
          transcription_id: string;
          status: 'processing' | 'completed' | 'error';
          content?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          last_event_at?: string | null;
        };
        Update: {
          status?: 'processing' | 'completed' | 'error';
          content?: string | null;
          error_message?: string | null;
          updated_at?: string;
          last_event_at?: string | null;
        };
      };
    };
  };
};

export class DatabaseService {
  private client: SupabaseClient<Database>;
  private static instance: DatabaseService;

  private constructor() {
    this.client = createClient<Database>(
      config.supabase.url,
      config.supabase.serviceRoleKey || config.supabase.anonKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Creates a new transcription request in the database
   */
  public async createTranscriptionRequest(params: {
    id: string;
    transcriptionId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from('transcription_requests')
      .insert({
        id: params.id,
        transcription_id: params.transcriptionId,
        status: 'processing',
        content: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_event_at: null,
      });

    if (error) {
      logger.error('Failed to create transcription request', { error });
      throw new Error(`Failed to create transcription request: ${error.message}`);
    }
  }

  /**
   * Updates an existing transcription request
   */
  public async updateTranscriptionRequest(requestId: string, segmentContent: string, status?: Database['public']['Tables']['transcription_requests']['Row']['status'], errorMessage?: string): Promise<Database['public']['Tables']['transcription_requests']['Row'] | null> {
    logger.debug(`Fetching existing transcription request ${requestId} to append content.`);
    const { data: existingRequest, error: fetchError } = await this.client
      .from('transcription_requests')
      .select('content, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      logger.error(`Error fetching transcription request ${requestId} for update or request not found:`, { error: fetchError });
      return null;
    }

    const newContent = existingRequest.content
      ? `${existingRequest.content}\n${segmentContent}`
      : segmentContent;

    const updates: Database['public']['Tables']['transcription_requests']['Update'] = {
      content: newContent,
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
    }
    if (errorMessage !== undefined) {
      updates.error_message = errorMessage;
    }

    logger.debug(`Updating transcription request ${requestId} with new appended content and status ${status || existingRequest.status}. New content length: ${newContent.length}`);
    const { data, error } = await this.client
      .from('transcription_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update transcription request', { requestId, error });
      throw new Error(`Failed to update transcription request: ${error.message}`);
    }

    return data;
  }

  /**
   * Gets the status of a transcription request
   */
  public async getTranscriptionRequest(
    id: string
  ): Promise<{
    id: string;
    transcription_id: string;
    status: 'processing' | 'completed' | 'error';
    content: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    last_event_at: string | null;
  } | null> {
    const { data, error } = await this.client
      .from('transcription_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        logger.warn('Transcription request not found in DB by getTranscriptionRequest (PGRST116)', { requestId: id });
        return null;
      }
      logger.error('Failed to fetch transcription request', { requestId: id, error });
      throw new Error(`Failed to fetch transcription request: ${error.message}`);
    }

    logger.debug('Raw data from getTranscriptionRequest:', { requestId: id, data });
    return data;
  }
}

export const databaseService = DatabaseService.getInstance();
