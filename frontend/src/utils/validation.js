// Validation rules - shared constants
export const VALIDATION_RULES = {
  username: {
    minLength: 3,
    maxLength: 30,
  },
  password: {
    minLength: 6,
  },
};

// Error messages in Hebrew
export const ERROR_MESSAGES = {
  username: {
    required: 'שם משתמש הוא שדה חובה',
    tooShort: `שם משתמש חייב להכיל לפחות ${VALIDATION_RULES.username.minLength} תווים`,
    tooLong: `שם משתמש יכול להכיל עד ${VALIDATION_RULES.username.maxLength} תווים`,
  },
  password: {
    required: 'סיסמה היא שדה חובה',
    tooShort: `סיסמה חייבת להכיל לפחות ${VALIDATION_RULES.password.minLength} תווים`,
  },
  confirmPassword: {
    required: 'אימות סיסמה הוא שדה חובה',
    mismatch: 'הסיסמאות אינן תואמות',
  },
};

/**
 * Validates a username field
 * @param {string} value - The username value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateUsername(value) {
  const trimmed = value?.trim() || '';
  if (!trimmed) return ERROR_MESSAGES.username.required;
  if (trimmed.length < VALIDATION_RULES.username.minLength) return ERROR_MESSAGES.username.tooShort;
  if (trimmed.length > VALIDATION_RULES.username.maxLength) return ERROR_MESSAGES.username.tooLong;
  return null;
}

/**
 * Validates a password field
 * @param {string} value - The password value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validatePassword(value) {
  if (!value) return ERROR_MESSAGES.password.required;
  if (value.length < VALIDATION_RULES.password.minLength) return ERROR_MESSAGES.password.tooShort;
  return null;
}

/**
 * Validates confirm password field
 * @param {string} value - The confirm password value
 * @param {string} password - The original password to compare against
 * @returns {string|null} Error message or null if valid
 */
export function validateConfirmPassword(value, password) {
  if (!value) return ERROR_MESSAGES.confirmPassword.required;
  if (value !== password) return ERROR_MESSAGES.confirmPassword.mismatch;
  return null;
}
