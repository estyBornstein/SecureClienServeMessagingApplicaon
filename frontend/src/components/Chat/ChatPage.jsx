import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useMessages } from '../../hooks/useMessages';
import LoadingSpinner from '../Common/LoadingSpinner';
import styles from './ChatPage.module.css';

function ChatPage() {
  const { user } = useAuth();
  const { messages, loading, error, sending, sendMessage, connectionStatus } = useMessages();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const content = inputValue.trim();
    if (!content || sending) return;

    setInputValue('');
    try {
      await sendMessage(content);
    } catch {
      setInputValue(content);
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'מחובר';
      case 'connecting': return 'מתחבר...';
      case 'error': return 'שגיאת חיבור';
      default: return 'מנותק';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className={styles.container}>
      <div className={`${styles.statusBar} ${styles[connectionStatus]}`}>
        <span className={styles.statusDot}></span>
        <span className={styles.statusText}>{getStatusText()}</span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>אין הודעות עדיין. שלח את ההודעה הראשונה!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user.id;
            return (
              <div
                key={msg.id}
                className={`${styles.messageBubble} ${isOwn ? styles.own : styles.other}`}
              >
                {!isOwn && (
                  <span className={styles.senderName}>{msg.senderUsername}</span>
                )}
                <p className={styles.messageText}>{msg.content}</p>
                <span className={styles.messageTime}>
                  {new Date(msg.createdAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSend}>
        <input
          type="text"
          className={styles.messageInput}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="הקלד הודעה..."
          disabled={sending}
          maxLength={5000}
          autoFocus
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputValue.trim() || sending}
        >
          {sending ? 'שולח...' : 'שלח'}
        </button>
      </form>
    </div>
  );
}

export default ChatPage;
