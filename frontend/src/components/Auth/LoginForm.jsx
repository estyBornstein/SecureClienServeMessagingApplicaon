import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useFormValidation } from '../../hooks/useFormValidation';
import { login as loginApi } from '../../services/authService';
import { decryptPrivateKey } from '../../utils/crypto';
import { setPrivateKey } from '../../utils/storage';
import { validateUsername, validatePassword } from '../../utils/validation';
import { API_ERROR_DURATION } from '../../config/constants';
import PasswordToggleButton from '../Common/PasswordToggleButton';
import styles from './LoginForm.module.css';

function LoginForm() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errorTimerRef = useRef(null);

  // Validation schema
  const validationSchema = useMemo(() => ({
    username: (value) => validateUsername(value),
    password: (value) => validatePassword(value),
  }), []);

  const { fieldErrors, setFieldErrors, validateAll, handleBlur, clearFieldError } = useFormValidation(validationSchema);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const onBlur = (e) => {
    handleBlur(e, formData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateAll(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      const data = await loginApi(formData.username, formData.password);

      // Decrypt and store private key from server backup
      if (data.encryptedPrivateKey && data.encryptedPrivateKeyIv) {
        try {
          const privateKeyPem = decryptPrivateKey(
            data.encryptedPrivateKey,
            data.encryptedPrivateKeyIv,
            formData.password
          );
          setPrivateKey(privateKeyPem);
        } catch {
          // Silent fail - user can still use the app but may need to re-register
        }
      }

      login(data.token, data.user);
    } catch (err) {
      const message = err.response?.data?.error || 'שגיאה בהתחברות. נסה שוב.';
      setApiError(message);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setApiError(''), API_ERROR_DURATION);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {apiError && (
        <div className={styles.apiError}>
          {apiError}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-username">שם משתמש</label>
        <input
          id="login-username"
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          onBlur={onBlur}
          className={`${styles.input} ${fieldErrors.username ? styles.inputError : ''}`}
          placeholder="הכנס שם משתמש"
          autoComplete="username"
          disabled={loading}
        />
        {fieldErrors.username && (
          <span className={styles.errorText}>{fieldErrors.username}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">סיסמה</label>
        <div className={styles.passwordWrapper}>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            onBlur={onBlur}
            className={`${styles.input} ${styles.passwordInput} ${fieldErrors.password ? styles.inputError : ''}`}
            placeholder="הכנס סיסמה"
            autoComplete="current-password"
            disabled={loading}
          />
          {formData.password && (
            <PasswordToggleButton
              show={showPassword}
              onToggle={() => setShowPassword(prev => !prev)}
            />
          )}
        </div>
        {fieldErrors.password && (
          <span className={styles.errorText}>{fieldErrors.password}</span>
        )}
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
      >
        {loading ? 'מתחבר...' : 'התחבר'}
      </button>
    </form>
  );
}

export default LoginForm;
