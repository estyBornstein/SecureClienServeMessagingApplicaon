import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLongPolling } from '../hooks/useLongPolling';
import * as messagesService from '../services/messages';

// Mock the messages service
vi.mock('../services/messages');

describe('useLongPolling', () => {
  let mockOnMessages;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockOnMessages = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should return disconnected status when not enabled', () => {
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useLongPolling(mockOnMessages, false));

      expect(result.current.connectionStatus).toBe('disconnected');
    });

    it('should start with connecting status when enabled', async () => {
      let resolveFirstPoll;
      messagesService.pollMessages.mockImplementation(
        () => new Promise((resolve) => { resolveFirstPoll = resolve; })
      );

      const { result } = renderHook(() => useLongPolling(mockOnMessages, true));

      // Wait for the effect to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.connectionStatus).toBe('connecting');

      // Cleanup
      resolveFirstPoll({ messages: [] });
    });
  });

  describe('successful polling', () => {
    it('should set connected status after successful poll', async () => {
      messagesService.pollMessages.mockResolvedValueOnce({ messages: [] });
      // Keep second poll pending to prevent infinite loop
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });
    });

    it('should call onMessages when messages are received', async () => {
      const mockMessages = [
        { id: 1, content: 'test message' },
        { id: 2, content: 'another message' },
      ];

      messagesService.pollMessages.mockResolvedValueOnce({ messages: mockMessages });
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(mockOnMessages).toHaveBeenCalledWith(mockMessages);
      });
    });

    it('should not call onMessages when messages array is empty', async () => {
      messagesService.pollMessages.mockResolvedValueOnce({ messages: [] });
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mockOnMessages).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should set error status on network error', async () => {
      messagesService.pollMessages.mockRejectedValueOnce(new Error('Network error'));
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
    });

    it('should retry after 1 second on error', async () => {
      messagesService.pollMessages
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ messages: [] })
        .mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useLongPolling(mockOnMessages, true));

      // First poll fails
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });

      // Wait for retry delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });

      expect(messagesService.pollMessages).toHaveBeenCalledTimes(2);
    });

    it('should not retry on abort error', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      messagesService.pollMessages.mockRejectedValueOnce(abortError);

      renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Wait a bit to ensure no retry
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Should only be called once (no retry on abort)
      expect(messagesService.pollMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should set disconnected status when disabled', async () => {
      messagesService.pollMessages.mockResolvedValueOnce({ messages: [] });
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      const { result, rerender } = renderHook(
        ({ enabled }) => useLongPolling(mockOnMessages, enabled),
        { initialProps: { enabled: true } }
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });

      // Disable polling
      rerender({ enabled: false });

      expect(result.current.connectionStatus).toBe('disconnected');
    });

    it('should abort request on unmount', async () => {
      let abortSignal;
      messagesService.pollMessages.mockImplementation((signal) => {
        abortSignal = signal;
        return new Promise(() => {});
      });

      const { unmount } = renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Unmount the hook
      unmount();

      // The abort signal should have been triggered
      expect(abortSignal?.aborted).toBe(true);
    });
  });

  describe('connection status transitions', () => {
    it('should transition from connecting -> connected on success', async () => {
      let resolveFirstPoll;
      messagesService.pollMessages.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirstPoll = resolve; })
      );
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.connectionStatus).toBe('connecting');

      await act(async () => {
        resolveFirstPoll({ messages: [] });
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });
    });

    it('should transition from connecting -> error on failure', async () => {
      let rejectFirstPoll;
      messagesService.pollMessages.mockImplementationOnce(
        () => new Promise((_, reject) => { rejectFirstPoll = reject; })
      );
      messagesService.pollMessages.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useLongPolling(mockOnMessages, true));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.connectionStatus).toBe('connecting');

      await act(async () => {
        rejectFirstPoll(new Error('Network error'));
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
    });
  });
});
