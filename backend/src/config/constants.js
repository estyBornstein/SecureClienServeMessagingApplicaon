/**
 * Application-wide constants and configuration values.
 * Centralizes magic numbers and configurable timeouts.
 * @module config/constants
 */

// ── Timeouts (in milliseconds) ──

/** Long polling timeout - how long server holds the connection */
const POLL_TIMEOUT_MS = 30000; // 30 seconds

/** Rate limiting window */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// ── Rate Limits ──

/** Maximum login attempts per minute */
const LOGIN_RATE_LIMIT = 5;

/** Maximum registration attempts per minute */
const REGISTER_RATE_LIMIT = 3;

/** Maximum messages per minute */
const MESSAGE_RATE_LIMIT = 30;

// ── Security ──

/** bcrypt salt rounds for password hashing */
const SALT_ROUNDS = 12;

/** PBKDF2 iterations for key derivation (private key encryption) */
const PBKDF2_ITERATIONS = 100000;

module.exports = {
  // Timeouts
  POLL_TIMEOUT_MS,
  RATE_LIMIT_WINDOW_MS,

  // Rate limits
  LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT,
  MESSAGE_RATE_LIMIT,

  // Security
  SALT_ROUNDS,
  PBKDF2_ITERATIONS,
};
