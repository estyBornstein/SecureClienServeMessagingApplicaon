import { useEffect, useRef, useCallback, useState } from 'react';
import { pollMessages } from '../services/messages';
import { POLL_RETRY_DELAY } from '../config/constants';

export function useLongPolling(onMessages, enabled = true) {
  const isActive = useRef(false);
  const abortControllerRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState(() => enabled ? 'connecting' : 'disconnected');
  const hasConnectedOnce = useRef(false);

  const poll = useCallback(async () => {
    while (isActive.current) {
      try {
        // Only show "connecting" on first connection attempt
        if (!hasConnectedOnce.current) {
          setConnectionStatus('connecting');
        }

        abortControllerRef.current = new AbortController();
        const data = await pollMessages(abortControllerRef.current.signal);

        if (!isActive.current) break;

        // Mark as connected after first successful poll
        if (!hasConnectedOnce.current) {
          hasConnectedOnce.current = true;
        }
        setConnectionStatus('connected');

        if (data.messages && data.messages.length > 0) {
          onMessages(data.messages);
        }
      } catch (err) {
        if (!isActive.current) break;
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') break;

        setConnectionStatus('error');
        hasConnectedOnce.current = false; // Reset on error
        // Wait before retry on error
        await new Promise((resolve) => setTimeout(resolve, POLL_RETRY_DELAY));
      }
    }
  }, [onMessages]);

  useEffect(() => {
    if (!enabled) {
      hasConnectedOnce.current = false;
      // Defer setState to avoid synchronous call in effect
      queueMicrotask(() => setConnectionStatus('disconnected'));
      return;
    }

    isActive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- poll() updates status asynchronously during long polling
    poll();

    return () => {
      isActive.current = false;
      hasConnectedOnce.current = false;
      // Cleanup setState is allowed
      setConnectionStatus('disconnected');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [poll, enabled]);

  return { connectionStatus };
}
