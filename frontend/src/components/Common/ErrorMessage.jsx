import styles from './ErrorMessage.module.css';

function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className={styles.container}>
      <span className={styles.text}>{message}</span>
      {onDismiss && (
        <button className={styles.dismissBtn} onClick={onDismiss} aria-label="סגור">
          &times;
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
