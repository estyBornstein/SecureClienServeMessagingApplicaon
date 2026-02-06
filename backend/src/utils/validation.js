// Validation rules - shared constants
const VALIDATION_RULES = {
  username: {
    minLength: 3,
    maxLength: 30,
  },
  password: {
    minLength: 6,
  },
  message: {
    maxEncryptedLength: 20000,
  },
  pagination: {
    defaultPageSize: 50,
    maxPageSize: 100,
  },
};

// Error messages (Hebrew)
const ERROR_MESSAGES = {
  username: {
    required: 'שם משתמש וסיסמה נדרשים',
    invalidLength: `שם משתמש חייב להכיל בין ${VALIDATION_RULES.username.minLength}-${VALIDATION_RULES.username.maxLength} תווים`,
  },
  password: {
    tooShort: `סיסמה חייבת להכיל לפחות ${VALIDATION_RULES.password.minLength} תווים`,
  },
  message: {
    tooLong: 'הודעה מוצפנת ארוכה מדי',
  },
};

module.exports = {
  VALIDATION_RULES,
  ERROR_MESSAGES,
};
