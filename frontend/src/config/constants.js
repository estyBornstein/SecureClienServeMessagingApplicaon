/**
 * Application-wide constants and configuration values.
 * Centralizes magic numbers and configurable timeouts.
 * @module config/constants
 */

// ── Timeouts (in milliseconds) ──

/** How long to display API errors before auto-clearing */
export const API_ERROR_DURATION = 30000; // 30 seconds

/** How long to wait before retrying after connection error */
export const POLL_RETRY_DELAY = 1000; // 1 second

/** HTTP request timeout for long polling */
export const POLL_REQUEST_TIMEOUT = 35000; // 35 seconds

/** Default HTTP request timeout */
export const DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds

// ── Input Limits ──

/** Maximum message length in characters */
export const MAX_MESSAGE_LENGTH = 5000;

// ── Security ──

/** PBKDF2 iterations for key derivation (private key encryption) */
export const PBKDF2_ITERATIONS = 100000;
