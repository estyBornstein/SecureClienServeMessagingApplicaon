import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '../components/Auth/RegisterForm';
import { AuthContext } from '../context/AuthContext';

// Mock services
vi.mock('../services/authService', () => ({
  register: vi.fn(),
}));

vi.mock('../utils/crypto', () => ({
  generateRSAKeyPair: vi.fn(() =>
    Promise.resolve({ publicKey: 'mock-pub-key', privateKey: 'mock-priv-key' })
  ),
  encryptPrivateKey: vi.fn(() => ({
    encryptedPrivateKey: 'mock-enc-pk',
    iv: 'mock-salt:mock-iv',
  })),
}));

vi.mock('../utils/storage', () => ({
  setPrivateKey: vi.fn(),
}));

import { register as registerApi } from '../services/authService';

function renderWithAuth(ui, { loginFn = vi.fn() } = {}) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, login: loginFn, logout: vi.fn() }}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form fields', () => {
    renderWithAuth(<RegisterForm />);

    expect(screen.getByLabelText('שם משתמש')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByLabelText('אימות סיסמה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הירשם' })).toBeInTheDocument();
  });

  it('shows validation error for empty username on blur', async () => {
    renderWithAuth(<RegisterForm />);
    const usernameInput = screen.getByLabelText('שם משתמש');

    fireEvent.focus(usernameInput);
    fireEvent.blur(usernameInput);

    expect(await screen.findByText('שם משתמש הוא שדה חובה')).toBeInTheDocument();
  });

  it('shows validation error for short username', async () => {
    renderWithAuth(<RegisterForm />);
    const usernameInput = screen.getByLabelText('שם משתמש');

    await userEvent.type(usernameInput, 'ab');
    fireEvent.blur(usernameInput);

    expect(await screen.findByText('שם משתמש חייב להכיל לפחות 3 תווים')).toBeInTheDocument();
  });

  it('shows validation error for empty password', async () => {
    renderWithAuth(<RegisterForm />);
    const passwordInput = screen.getByLabelText('סיסמה');

    fireEvent.focus(passwordInput);
    fireEvent.blur(passwordInput);

    expect(await screen.findByText('סיסמה היא שדה חובה')).toBeInTheDocument();
  });

  it('shows validation error for short password', async () => {
    renderWithAuth(<RegisterForm />);
    const passwordInput = screen.getByLabelText('סיסמה');

    await userEvent.type(passwordInput, '12345');
    fireEvent.blur(passwordInput);

    expect(await screen.findByText('סיסמה חייבת להכיל לפחות 6 תווים')).toBeInTheDocument();
  });

  it('shows validation error for password mismatch', async () => {
    renderWithAuth(<RegisterForm />);

    await userEvent.type(screen.getByLabelText('סיסמה'), 'password123');
    await userEvent.type(screen.getByLabelText('אימות סיסמה'), 'different456');
    fireEvent.blur(screen.getByLabelText('אימות סיסמה'));

    expect(await screen.findByText('הסיסמאות אינן תואמות')).toBeInTheDocument();
  });

  it('prevents submission with empty fields', async () => {
    renderWithAuth(<RegisterForm />);
    const submitBtn = screen.getByRole('button', { name: 'הירשם' });

    await userEvent.click(submitBtn);

    expect(registerApi).not.toHaveBeenCalled();
    expect(screen.getByText('שם משתמש הוא שדה חובה')).toBeInTheDocument();
  });

  it('calls register API with valid data', async () => {
    const mockLogin = vi.fn();
    registerApi.mockResolvedValue({
      token: 'mock-token',
      user: { id: 1, username: 'newuser' },
    });

    renderWithAuth(<RegisterForm />, { loginFn: mockLogin });

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'newuser');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'password123');
    await userEvent.type(screen.getByLabelText('אימות סיסמה'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'הירשם' }));

    await waitFor(() => {
      expect(registerApi).toHaveBeenCalledWith(
        'newuser',
        'password123',
        'mock-pub-key',
        'mock-enc-pk',
        'mock-salt:mock-iv'
      );
      expect(mockLogin).toHaveBeenCalledWith('mock-token', { id: 1, username: 'newuser' });
    });
  });

  it('displays API error message on registration failure', async () => {
    registerApi.mockRejectedValue({
      response: { data: { error: 'Username already exists' } },
    });

    renderWithAuth(<RegisterForm />);

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'existinguser');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'password123');
    await userEvent.type(screen.getByLabelText('אימות סיסמה'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'הירשם' }));

    expect(await screen.findByText('Username already exists')).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    registerApi.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithAuth(<RegisterForm />);

    await userEvent.type(screen.getByLabelText('שם משתמש'), 'newuser');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'password123');
    await userEvent.type(screen.getByLabelText('אימות סיסמה'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'הירשם' }));

    expect(await screen.findByText('נרשם...')).toBeInTheDocument();
  });
});
