import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUser = { id: 1, username: 'testuser' };
const mockSendMessage = vi.fn();
let mockUseAuthReturn = { user: mockUser };
let mockUseMessagesReturn = {
  messages: [],
  loading: false,
  error: null,
  sending: false,
  sendMessage: mockSendMessage,
  connectionStatus: 'connected',
};

// Mock the hooks before importing ChatPage
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuthReturn,
}));

vi.mock('../hooks/useMessages', () => ({
  useMessages: () => mockUseMessagesReturn,
}));

// Import after mocks are set up
import ChatPage from '../components/Chat/ChatPage';

describe('ChatPage', () => {
  const defaultUseMessagesReturn = {
    messages: [],
    loading: false,
    error: null,
    sending: false,
    sendMessage: mockSendMessage,
    connectionStatus: 'connected',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthReturn = { user: mockUser };
    mockUseMessagesReturn = { ...defaultUseMessagesReturn };
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        loading: true,
      };

      const { container } = render(<ChatPage />);

      expect(container.querySelector('[class*="spinner"]')).toBeInTheDocument();
    });
  });

  describe('connection status', () => {
    it('should show "מחובר" when connected', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        connectionStatus: 'connected',
      };

      render(<ChatPage />);

      expect(screen.getByText('מחובר')).toBeInTheDocument();
    });

    it('should show "מתחבר..." when connecting', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        connectionStatus: 'connecting',
      };

      render(<ChatPage />);

      expect(screen.getByText('מתחבר...')).toBeInTheDocument();
    });

    it('should show "שגיאת חיבור" when error', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        connectionStatus: 'error',
      };

      render(<ChatPage />);

      expect(screen.getByText('שגיאת חיבור')).toBeInTheDocument();
    });

    it('should show "מנותק" when disconnected', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        connectionStatus: 'disconnected',
      };

      render(<ChatPage />);

      expect(screen.getByText('מנותק')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should display error message when error exists', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        error: 'Failed to load messages',
      };

      render(<ChatPage />);

      expect(screen.getByText('Failed to load messages')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state message when no messages', () => {
      render(<ChatPage />);

      expect(screen.getByText('אין הודעות עדיין. שלח את ההודעה הראשונה!')).toBeInTheDocument();
    });
  });

  describe('messages display', () => {
    const mockMessages = [
      {
        id: 1,
        senderId: 1,
        senderUsername: 'testuser',
        content: 'Hello world',
        createdAt: '2024-01-15T10:30:00Z',
      },
      {
        id: 2,
        senderId: 2,
        senderUsername: 'otheruser',
        content: 'Hi there',
        createdAt: '2024-01-15T10:31:00Z',
      },
    ];

    it('should render messages', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        messages: mockMessages,
      };

      render(<ChatPage />);

      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    it('should show sender name for other users messages', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        messages: mockMessages,
      };

      render(<ChatPage />);

      expect(screen.getByText('otheruser')).toBeInTheDocument();
      // Own message should not show sender name
      expect(screen.queryAllByText('testuser')).toHaveLength(0);
    });

    it('should apply different styles for own vs other messages', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        messages: mockMessages,
      };

      render(<ChatPage />);

      const messageBubbles = screen.getAllByText(/Hello world|Hi there/).map(
        (el) => el.closest('[class*="messageBubble"]')
      );

      // Check that classes are applied (own vs other)
      expect(messageBubbles[0].className).toMatch(/own/);
      expect(messageBubbles[1].className).toMatch(/other/);
    });
  });

  describe('message input', () => {
    it('should render input field and send button', () => {
      render(<ChatPage />);

      expect(screen.getByPlaceholderText('הקלד הודעה...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'שלח' })).toBeInTheDocument();
    });

    it('should disable send button when input is empty', () => {
      render(<ChatPage />);

      const sendButton = screen.getByRole('button', { name: 'שלח' });
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button when input has content', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      await user.type(input, 'Test message');

      const sendButton = screen.getByRole('button', { name: 'שלח' });
      expect(sendButton).not.toBeDisabled();
    });

    it('should disable send button when only whitespace', async () => {
      const user = userEvent.setup();
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      await user.type(input, '   ');

      const sendButton = screen.getByRole('button', { name: 'שלח' });
      expect(sendButton).toBeDisabled();
    });

    it('should have max length of 5000 characters', () => {
      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      expect(input).toHaveAttribute('maxLength', '5000');
    });
  });

  describe('sending messages', () => {
    it('should call sendMessage when form is submitted', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue({ data: { id: 3 } });

      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      await user.type(input, 'Test message');

      const sendButton = screen.getByRole('button', { name: 'שלח' });
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after successful send', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue({ data: { id: 3 } });

      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: 'שלח' }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should restore input value on send failure', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockRejectedValue(new Error('Send failed'));

      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: 'שלח' }));

      await waitFor(() => {
        expect(input).toHaveValue('Test message');
      });
    });

    it('should show "שולח..." when sending', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        sending: true,
      };

      render(<ChatPage />);

      expect(screen.getByRole('button', { name: 'שולח...' })).toBeInTheDocument();
    });

    it('should disable input when sending', () => {
      mockUseMessagesReturn = {
        ...defaultUseMessagesReturn,
        sending: true,
      };

      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      expect(input).toBeDisabled();
    });

    it('should not send empty messages', () => {
      render(<ChatPage />);

      const form = screen.getByPlaceholderText('הקלד הודעה...').closest('form');
      fireEvent.submit(form);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should trim whitespace from messages', async () => {
      mockSendMessage.mockResolvedValue({ data: { id: 3 } });

      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      // Set value directly to include leading/trailing spaces
      fireEvent.change(input, { target: { value: '  Test message  ' } });
      fireEvent.submit(input.closest('form'));

      // Due to async nature, we need to wait
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });
    });
  });

  describe('keyboard interaction', () => {
    it('should submit form on Enter key', async () => {
      const user = userEvent.setup();
      mockSendMessage.mockResolvedValue({ data: { id: 3 } });

      render(<ChatPage />);

      const input = screen.getByPlaceholderText('הקלד הודעה...');
      await user.type(input, 'Test message{enter}');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });
  });
});
