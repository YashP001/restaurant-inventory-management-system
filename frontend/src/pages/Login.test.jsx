import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from './Login';
import * as AuthContextModule from '../context/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Login Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it('renders login form elements properly', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: vi.fn()
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('Urban Bites')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. rohit_admin')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('updates form input values on user input', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: vi.fn()
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const userInput = screen.getByPlaceholderText('e.g. rohit_admin');
    const passInput = screen.getByPlaceholderText('••••••••••••');

    fireEvent.change(userInput, { target: { value: 'priya_inventory' } });
    fireEvent.change(passInput, { target: { value: 'Secret123' } });

    expect(userInput.value).toBe('priya_inventory');
    expect(passInput.value).toBe('Secret123');
  });

  it('calls login and navigates to root on valid submission', async () => {
    const mockLogin = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: mockLogin
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const userInput = screen.getByPlaceholderText('e.g. rohit_admin');
    const passInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(userInput, { target: { value: 'rohit_admin' } });
    fireEvent.change(passInput, { target: { value: 'UrbanBites@2026' } });
    fireEvent.click(submitBtn);

    expect(mockLogin).toHaveBeenCalledWith('rohit_admin', 'UrbanBites@2026');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('displays error alert when login fails', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid identifier or password'));
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      login: mockLogin
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const userInput = screen.getByPlaceholderText('e.g. rohit_admin');
    const passInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(userInput, { target: { value: 'rohit_admin' } });
    fireEvent.change(passInput, { target: { value: 'WrongPassword' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid identifier or password')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
