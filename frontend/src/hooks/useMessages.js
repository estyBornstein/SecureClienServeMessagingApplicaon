import { useState, useCallback, useEffect, useRef } from 'react';
import { sendMessage as sendMessageApi, getHistory } from '../services/messages';
import { getAllPublicKeys } from '../services/users';
import { encryptMessageForRecipients, decryptMessage } from '../utils/crypto';
import { getPrivateKey } from '../utils/storage';
import { useLongPolling } from './useLongPolling';
import { useAuth } from './useAuth';

async function decryptMsg(msg, privateKey) {
  try {
    const content = await decryptMessage(
      msg.encryptedContent,
      msg.iv,
      msg.encryptedKey,
      privateKey
    );
    return {
      id: msg.id,
      senderId: msg.senderId,
      senderUsername: msg.senderUsername,
      content,
      createdAt: msg.createdAt,
    };
  } catch {
    return {
      id: msg.id,
      senderId: msg.senderId,
      senderUsername: msg.senderUsername,
      content: '[Unable to decrypt]',
      createdAt: msg.createdAt,
    };
  }
}

export function useMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const publicKeysRef = useRef([]);
  const initialLoadDone = useRef(false);

  // Load public keys and initial history
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    async function init() {
      try {
        // Fetch all public keys
        const keys = await getAllPublicKeys();
        publicKeysRef.current = keys;

        // Load and decrypt message history
        const data = await getHistory(1, 100);
        const privateKey = getPrivateKey();
        const reversed = data.messages.reverse();

        const decrypted = [];
        for (const msg of reversed) {
          decrypted.push(await decryptMsg(msg, privateKey));
        }
        setMessages(decrypted);
      } catch {
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Handle incoming messages from long polling
  const handleNewMessages = useCallback(async (newMessages) => {
    const privateKey = getPrivateKey();
    const decryptedNew = [];

    for (const msg of newMessages) {
      decryptedNew.push(await decryptMsg(msg, privateKey));
    }

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const unique = decryptedNew.filter((m) => !existingIds.has(m.id));
      if (unique.length === 0) return prev;
      return [...prev, ...unique];
    });
  }, []);

  // Start long polling after history loads
  const { connectionStatus } = useLongPolling(handleNewMessages, !loading);

  const sendMessage = useCallback(async (content) => {
    setSending(true);
    try {
      // Refresh public keys to catch newly registered users
      const keys = await getAllPublicKeys();
      publicKeysRef.current = keys;

      // Encrypt for all users (including self)
      const { encryptedContent, iv, keys: encKeys } = await encryptMessageForRecipients(
        content,
        publicKeysRef.current
      );

      const result = await sendMessageApi(encryptedContent, iv, encKeys);

      // Add own message to the list immediately (we have the plaintext)
      setMessages((prev) => [
        ...prev,
        {
          id: result.data.id,
          senderId: user.id,
          senderUsername: user.username,
          content,
          createdAt: result.data.createdAt,
        },
      ]);

      return result;
    } finally {
      setSending(false);
    }
  }, [user]);

  return { messages, loading, error, sending, sendMessage, connectionStatus };
}
