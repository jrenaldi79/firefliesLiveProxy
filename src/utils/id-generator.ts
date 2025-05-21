import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique identifier
 * @returns A UUID v4 string
 */
export const generateId = (): string => {
  return uuidv4();
};

/**
 * Generates a short, URL-safe ID
 * @returns A short ID string
 */
export const generateShortId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};
