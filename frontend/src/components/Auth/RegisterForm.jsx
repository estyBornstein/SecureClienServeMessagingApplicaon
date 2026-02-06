import { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useFormValidation } from '../../hooks/useFormValidation';
import { register as registerApi } from '../../services/authService';
import { generateRSAKeyPair, encryptPrivateKey } from '../../utils/crypto';
import { setPrivateKey } from '../../utils/storage';
import { validateUsername, validatePassword, validateConfirmPassword } from '../../utils/validation';
import PasswordToggleButton from '../Common/PasswordToggleButton';
import styles from './RegisterForm.module.css';

function RegisterForm() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validation schema - confirmPassword needs access to formData.password
  const validationSchema = useMemo(() => ({
    username: (value) => validateUsername(value),
    password: (value) => validatePassword(value),
    confirmPassword: (value, data) => validateConfirmPassword(value, data.password),
  }), []);

  const { fieldErrors, setFieldErrors, validateAll, handleBlur, clearFieldError } = useFormValidation(validationSchema);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearFieldError(name);
    if (apiError) setApiError('');
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
      // Generate RSA key pair client-side
      const { publicKey, privateKey } = await generateRSAKeyPair();

      // Encrypt private key with password for server-side backup
      const { encryptedPrivateKey, iv: pkIv } = encryptPrivateKey(privateKey, formData.password);

      const data = await registerApi(
        formData.username,
        formData.password,
        publicKey,
        encryptedPrivateKey,
        pkIv
      );

      // Store private key locally
      setPrivateKey(privateKey);

      login(data.token, data.user);
    } catch (err) {
      const message = err.response?.data?.error || 'שגיאה בהרשמה. נסה שוב.';
      setApiError(message);
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
        <label className={styles.label} htmlFor="register-username">שם משתמש</label>
        <input
          id="register-username"
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          onBlur={onBlur}
          className={`${styles.input} ${fieldErrors.username ? styles.inputError : ''}`}
          placeholder="3-30 תווים"
          autoComplete="username"
          disabled={loading}
        />
        {fieldErrors.username && (
          <span className={styles.errorText}>{fieldErrors.username}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-password">סיסמה</label>
        <div className={styles.passwordWrapper}>
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            onBlur={onBlur}
            className={`${styles.input} ${styles.passwordInput} ${fieldErrors.password ? styles.inputError : ''}`}
            placeholder="לפחות 6 תווים"
            autoComplete="new-password"
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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="register-confirm">אימות סיסמה</label>
        <div className={styles.passwordWrapper}>
          <input
            id="register-confirm"
            type={showConfirm ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={onBlur}
            className={`${styles.input} ${styles.passwordInput} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
            placeholder="הכנס סיסמה שוב"
            autoComplete="new-password"
            disabled={loading}
          />
          {formData.confirmPassword && (
            <PasswordToggleButton
              show={showConfirm}
              onToggle={() => setShowConfirm(prev => !prev)}
            />
          )}
        </div>
        {fieldErrors.confirmPassword && (
          <span className={styles.errorText}>{fieldErrors.confirmPassword}</span>
        )}
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading}
      >
        {loading ? 'נרשם...' : 'הירשם'}
      </button>
    </form>
  );
}

export default RegisterForm;
