import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for form validation with field-level errors.
 * Extracts common validation logic from form components.
 *
 * @param {Object} validationSchema - Object mapping field names to validation functions
 *   Each validator receives (value, formData) and returns error string or null
 * @returns {Object} Validation utilities
 *
 * @example
 * const schema = {
 *   username: (value) => validateUsername(value),
 *   password: (value) => validatePassword(value),
 * };
 * const { fieldErrors, validateField, handleBlur, clearFieldError } = useFormValidation(schema);
 */
export function useFormValidation(validationSchema) {
  const [fieldErrors, setFieldErrors] = useState({});

  // Memoize schema to prevent unnecessary re-renders
  const schema = useMemo(() => validationSchema, [validationSchema]);

  /**
   * Validates a single field
   * @param {string} name - Field name
   * @param {string} value - Field value
   * @param {Object} formData - Full form data (for cross-field validation)
   * @returns {string|null} Error message or null
   */
  const validateField = useCallback((name, value, formData = {}) => {
    const validator = schema[name];
    return validator ? validator(value, formData) : null;
  }, [schema]);

  /**
   * Validates all fields in form data
   * @param {Object} formData - Form data to validate
   * @returns {Object} Object with field names as keys and error messages as values
   */
  const validateAll = useCallback((formData) => {
    const errors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key], formData);
      if (error) errors[key] = error;
    });
    return errors;
  }, [validateField]);

  /**
   * Blur handler - validates field and sets error if invalid
   * @param {Event} e - Blur event
   * @param {Object} formData - Current form data (for cross-field validation)
   */
  const handleBlur = useCallback((e, formData = {}) => {
    const { name, value } = e.target;
    const error = validateField(name, value, formData);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [validateField]);

  /**
   * Clears error for a specific field
   * @param {string} name - Field name
   */
  const clearFieldError = useCallback((name) => {
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  }, []);

  /**
   * Clears all field errors
   */
  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    fieldErrors,
    setFieldErrors,
    validateField,
    validateAll,
    handleBlur,
    clearFieldError,
    clearAllErrors,
  };
}
