import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../components/Auth/LoginForm';
import { AuthContext } from '../context/AuthContext';

// Mock services
vi.mock('../services/authService', () => ({
  login: vi.fn(),
}));

vi.mock('../utils/crypto', () => ({
  decryptPrivateKey: vi.fn(() => 'mock-decrypted-private-key'),
}));

vi.mock('../utils/storage', () => ({
  setPrivateKey: vi.fn(),
}));

import { login as loginApi } from '../services/authService';

function renderWithAuth(ui, { loginFn = vi.fn() } = {}) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, login: loginFn, logout: vi.fn() }}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form fields', () => {
    renderWithAuth(<LoginForm />);

    expect(screen.getByLabelText('שם משתמש')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר' })).toBeInTheDocument();
  });

  it('shows validation error for empty username on blur', async () => {
    renderWithAuth(<LoginForm />);
    const usernameInput = screen.getByLabelText('שם משתמש');

    fireEvent.focus(usernameInput);
    fireEvent.blur(usernameInput);

    expect(await screen.findByText('שם משתמש הוא שדה חובה')).toBeInTheDocument();
  });

  it('shows validation error for short username on blur', async () => {
    renderWithAuth(<LoginForm />);
    const usernameInput = screen.getByLabelText('שם משתמש');

    await userEvent.type(usernameInput, 'ab');
    fireEvent.blur(usernameInput);

    expect(await screen.findByText('שם משתמש חייב להכיל לפחות 3 תווים')).toBeInTheDocument();
  });

  it('shows validation error for empty password on blur', async () => {
    renderWithAuth(<LoginForm />);
    const passwordInput = screen.getByLabelText('סיסמה');

    fireEvent.focus(passwordInput);
    fireEvent.blur(passwordInput);

    expect(await screen.findByText('סיסמה היא שדה חובה')).toBeInTheDocument();
  });

  it('shows validation error for short password on blur', async () => {
    renderWithAuth(<LoginForm />);
    const passwordInput = screen.getByLabelText('סיסמה');

    await userEvent.type(passwordInput, '12345');
    fireEvent.blur(passwordInput);

    expect(await screen.findByText('סיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
  });

  it('clears field error when user starts typing', async () => {
    renderWithAuth(<LoginForm />);
    const usernameInput = screen.getByLabelText('שם משתמש');

    fireEvent.focus(usernameInput);
    fireEvent.blur(usernameInput);
    expect(await screen.findByText('שם משתמש הוא שדה חובה')).toBeInTheDocument();

    await userEvent.type(usernameInput, 'test');
    expect(screen.queryByText('שם משתמש הוא שדה חובה')).not.toBeInTheDocument();
  });

  it('prevents submission with empty fields', async () => {
    renderWithAuth(<LoginForm />);
    const submitBtn = screen.getByRole('button', { name: 'התחבר' });

    await userEvent.click(submitBtn);

    expect(loginApi).not.toHaveBeenCalled();
    expect(screen.getByText('שם משתמש הוא שדה חובה')).toBeInTheDocument();
    expect(screen.getByText('סיסמה היא שדה חובה')).toBeInTheDocument();
  });

  it('calls login API with valid credentials', async () => {
    const mockLogin = vi.fn();
    loginApi.mockResolvedValue({
      token: 'mock-token',
      user: { id: 1, username: 'testuser' },
      encryptedPrivateKey: 'enc-pk',
      encryptedPrivateKeyIv: 'salt:iv',
    });

    renderWithAuth(<LoginForm />, { loginFn: mockLogin });

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'testuser');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'התחבר' }));

    await waitFor(() => {
      expect(loginApi).toHaveBeenCalledWith('testuser', 'password123');
      expect(mockLogin).toHaveBeenCalledWith('mock-token', { id: 1, username: 'testuser' });
    });
  });

  it('displays API error message on login failure', async () => {
    loginApi.mockRejectedValue({
      response: { data: { error: 'Invalid username or password' } },
    });

    renderWithAuth(<LoginForm />);

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'wronguser');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'התחבר' }));

    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    loginApi.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithAuth(<LoginForm />);

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'testuser');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'התחבר' }));

    expect(await screen.findByText('מתחבר...')).toBeInTheDocument();
  });
});
