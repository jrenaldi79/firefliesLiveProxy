#!/usr/bin/env ts-node

import axios from 'axios';
import { config } from '../src/config/environment.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../src/utils/logger.js';

const API_BASE_URL = `http://localhost:${config.port}/api/transcription`;

// Add error handling for config
if (!config.port) {
  logger.error('Port not configured in environment variables');
  process.exit(1);
}

// Get TRANSCRIPTION_ID from command-line arguments
// process.argv[0] is 'tsx' (or node)
// process.argv[1] is 'scripts/test-api.ts'
// process.argv[2] will be the first argument passed by the user
let TRANSCRIPTION_ID = process.argv[2];

if (!TRANSCRIPTION_ID) {
  TRANSCRIPTION_ID = uuidv4();
  logger.info(`No TRANSCRIPTION_ID provided via CLI, generated one for this test run: ${TRANSCRIPTION_ID}`);
} else {
  logger.info(`Using TRANSCRIPTION_ID from CLI: ${TRANSCRIPTION_ID}`);
}

const testRequestId = uuidv4(); // Unique UUID request ID for this test run

async function startTranscription(transcriptionId: string, requestId: string) {
  logger.info(`Starting transcription for ID: ${transcriptionId} with request ID: ${requestId}`);
  try {
    const response = await axios.post(`${API_BASE_URL}/start`, {
      transcriptionId,
      requestId, // Send our test-specific request ID
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000 // 5 seconds
    });
    logger.info('Start transcription response data:', response.data);

    if (!response.data || !response.data.requestId || !response.data.status) {
      logger.error('Test failed: /start response did not include requestId or status', { data: response.data });
      throw new Error('Test failed: /start response did not include requestId or status');
    }
    // The requestId for getStatus should be the one from the server's response
    return response.data.requestId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Error starting transcription:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error('Unexpected error:', error);
    }
    throw error;
  }
}

async function testGetStatus(requestId: string) {
  try {
    logger.info(`Getting status for request ID: ${requestId}`);
    const response = await axios.get(`${API_BASE_URL}/status/${requestId}`, {
      timeout: 3000
    });
    logger.info('Status response:', response.data); 

    // Check if content property exists and has a value (it can be an empty string)
    if (response.data.content !== undefined) { 
      logger.info('Transcription content received:', { content: response.data.content });
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Error getting status:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error('Unexpected error:', error);
    }
    throw error;
  }
}

async function runTest() {
  try {
    // Use the global testRequestId which is now what we send to the server
    // Ensure TRANSCRIPTION_ID is defined before calling startTranscription, which it will be by this point.
    const actualRequestId = await startTranscription(TRANSCRIPTION_ID!, testRequestId);

    logger.info(`Waiting 60 seconds for transcription events and DB flush...`);
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 60 seconds

    await testGetStatus(actualRequestId); // Use the requestId returned or confirmed by the start endpoint
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest();
