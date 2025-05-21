import { Router, Request, Response, NextFunction } from 'express';
import { generateId } from '@/utils/id-generator.js';
import { transcriptionManager } from '@/services/transcription-manager.service.js';
import { databaseService } from '@/services/database.service.js';
import { logger } from '@/utils/logger.js';

const router = Router();

/**
 * @swagger
 * /api/transcription/start:
 *   post:
 *     summary: Start a new transcription session
 *     description: Initiates a real-time transcription for the given transcription ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transcriptionId
 *             properties:
 *               transcriptionId:
 *                 type: string
 *                 description: The Fireflies.ai transcription ID
 *     responses:
 *       202:
 *         description: Transcription started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requestId:
 *                   type: string
 *                   description: The unique ID for this transcription request
 *                 status:
 *                   type: string
 *                   enum: [processing]
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  const { transcriptionId, requestId: clientRequestId } = req.body;

  if (!transcriptionId) {
    logger.warn('Missing transcriptionId in /start request');
    return res.status(400).json({ error: 'transcriptionId is required' });
  }

  const effectiveRequestId = clientRequestId || generateId(); 
  logger.info(`Received /start request. Transcription ID: ${transcriptionId}, Effective Request ID: ${effectiveRequestId}`);

  try {
    await databaseService.createTranscriptionRequest({ id: effectiveRequestId, transcriptionId: transcriptionId });
    logger.info(`Transcription request ${effectiveRequestId} created in database.`);

    transcriptionManager.startTranscription(effectiveRequestId, transcriptionId);
    logger.info(`Transcription process initiated for ${effectiveRequestId} via TranscriptionManager.`);
    
    const successResponse = {
      requestId: effectiveRequestId,
      status: 'processing',
      message: 'Transcription process initiated successfully.',
    };
    logger.info('Sending 202 success response for /start:', { body: successResponse });
    return res.status(202).json(successResponse);

  } catch (error) {
    logger.error('Error in /start route:', { error, requestId: effectiveRequestId, transcriptionId });
    return next(error); 
  }
});

/**
 * @swagger
 * /api/transcription/status/{requestId}:
 *   get:
 *     summary: Get the status of a transcription request
 *     description: Returns the current status and content of a transcription request
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the transcription request
 *     responses:
 *       200:
 *         description: Transcription status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requestId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [processing, completed, error]
 *                 content:
 *                   type: string
 *                   nullable: true
 *                   description: The current transcription content (if available)
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   description: Error message (if status is error)
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Transcription request not found
 *       500:
 *         description: Internal server error
 */
router.get('/status/:requestId', async (req: Request, res: Response, next: NextFunction) => {
  const { requestId } = req.params;

  // It's good practice to validate if the UUID is in a valid format if possible,
  // but for now, we'll just check if it exists.
  // A more robust validation like `isValidUUID(requestId)` would be better.
  if (!requestId) {
    logger.warn('Missing requestId for /status');
    return res.status(400).json({ error: 'requestId is required' });
  }

  try {
    logger.info('Received /status request', { requestId });
    const request = await databaseService.getTranscriptionRequest(requestId);

    if (!request) {
      logger.warn('Transcription request not found for /status', { requestId });
      return res.status(404).json({ error: 'Transcription request not found' });
    }

    const responseBody = {
      requestId: request.id,
      status: request.status,
      content: request.content,
      error: request.error_message, // Ensure this matches your DB column name for errors
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    };

    logger.info('Sending status response:', { body: responseBody });
    return res.status(200).json(responseBody);

  } catch (error) {
    logger.error('Error fetching transcription status', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    // Pass to the generic error handler
    return next(error);
  }
});

/**
 * @swagger
 * /api/transcription/stop:
 *   post:
 *     summary: Stop a transcription session
 *     description: Manually stops an active transcription session for the given request ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *             properties:
 *               requestId:
 *                 type: string
 *                 format: uuid
 *                 description: The unique ID of the transcription request to stop (returned by /start)
 *     responses:
 *       200:
 *         description: Transcription stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requestId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [completed, stopped]
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request, missing requestId, or session not active/mismatched.
 *       404:
 *         description: Active session not found for the given requestId.
 *       500:
 *         description: Internal server error
 */
router.post('/stop', async (req: Request, res: Response, next: NextFunction) => {
  const { requestId } = req.body;

  if (!requestId) {
    logger.warn('Missing requestId in /stop request');
    return res.status(400).json({ error: 'requestId is required' });
  }

  logger.info(`Received /stop request for requestId: ${requestId}`);

  if (!transcriptionManager.isProcessing()) {
    logger.warn(`Attempted to stop session ${requestId}, but no session is currently processing.`);
    return res.status(400).json({
      error: 'No active transcription session to stop.',
      requestId,
    });
  }

  const activeRequestId = transcriptionManager.getRequestId();
  if (activeRequestId !== requestId) {
    logger.warn(
      `Attempted to stop session ${requestId}, but active session is ${activeRequestId}.`,
    );
    return res.status(400).json({
      error: 'The provided requestId does not match the currently active session.',
      requestedId: requestId,
      activeId: activeRequestId,
    });
  }

  try {
    await transcriptionManager.stopTranscription();
    logger.info(`Transcription session ${requestId} stopped successfully via API call.`);
    
    // Optionally, retrieve the final status from the database to confirm 'completed' state
    // For now, we'll assume stopTranscription marks it as 'completed'
    const successResponse = {
      requestId: requestId,
      status: 'completed', // Or 'stopped', depending on desired semantics
      message: 'Transcription session stopped successfully.',
    };
    logger.info('Sending 200 success response for /stop:', { body: successResponse });
    return res.status(200).json(successResponse);

  } catch (error) {
    logger.error('Error in /stop route while stopping transcription:', { error, requestId });
    // Pass to the generic error handler
    return next(error); 
  }
});

export default router;
