import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../services/api';

function TestConsumer() {
  const { user, token, isAuthenticated, login, logout, hasRole } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
      <div data-testid="username">{user?.username || 'NO_USER'}</div>
      <div data-testid="role">{user?.role || 'NO_ROLE'}</div>
      <div data-testid="token">{token || 'NO_TOKEN'}</div>
      <div data-testid="has-admin-role">{hasRole('ADMIN') ? 'IS_ADMIN' : 'NOT_ADMIN'}</div>
      <button onClick={() => login('test_user', 'password123')}>Do Login</button>
      <button onClick={logout}>Do Logout</button>
    </div>
  );
}

describe('AuthContext and AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides default unauthenticated state when localStorage is empty', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    expect(screen.getByTestId('username')).toHaveTextContent('NO_USER');
    expect(screen.getByTestId('token')).toHaveTextContent('NO_TOKEN');
  });

  it('initializes authenticated user from existing localStorage items', async () => {
    const mockUser = { id: 1, username: 'priya_inventory', role: 'INVENTORY_MANAGER' };
    localStorage.setItem('ub_token', 'mock_jwt_token_123');
    localStorage.setItem('ub_user', JSON.stringify(mockUser));

    vi.spyOn(authApi, 'getProfile').mockResolvedValue({
      success: true,
      data: { user: mockUser }
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_IN');
    expect(screen.getByTestId('username')).toHaveTextContent('priya_inventory');
    expect(screen.getByTestId('role')).toHaveTextContent('INVENTORY_MANAGER');
    expect(screen.getByTestId('token')).toHaveTextContent('mock_jwt_token_123');
  });

  it('executes login successfully and persists credentials in localStorage', async () => {
    const mockUser = { id: 1, username: 'rohit_admin', role: 'ADMIN' };
    vi.spyOn(authApi, 'login').mockResolvedValue({
      success: true,
      data: {
        token: 'new_token_456',
        user: mockUser
      }
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    const loginBtn = screen.getByText('Do Login');
    await act(async () => {
      loginBtn.click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_IN');
    expect(screen.getByTestId('username')).toHaveTextContent('rohit_admin');
    expect(screen.getByTestId('has-admin-role')).toHaveTextContent('IS_ADMIN');
    expect(localStorage.getItem('ub_token')).toBe('new_token_456');
    expect(JSON.parse(localStorage.getItem('ub_user'))).toEqual(mockUser);
  });

  it('executes logout and purges state and localStorage', async () => {
    localStorage.setItem('ub_token', 'active_token');
    localStorage.setItem('ub_user', JSON.stringify({ id: 2, username: 'user2', role: 'CHEF' }));

    vi.spyOn(authApi, 'getProfile').mockResolvedValue({
      success: true,
      data: { user: { id: 2, username: 'user2', role: 'CHEF' } }
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    const logoutBtn = screen.getByText('Do Logout');
    act(() => {
      logoutBtn.click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    expect(screen.getByTestId('token')).toHaveTextContent('NO_TOKEN');
    expect(localStorage.getItem('ub_token')).toBeNull();
    expect(localStorage.getItem('ub_user')).toBeNull();
  });

  it('clears session on ub_auth_expired event', () => {
    localStorage.setItem('ub_token', 'expiring_token');
    localStorage.setItem('ub_user', JSON.stringify({ id: 3, username: 'user3', role: 'CASHIER' }));

    vi.spyOn(authApi, 'getProfile').mockResolvedValue({
      success: true,
      data: { user: { id: 3, username: 'user3', role: 'CASHIER' } }
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    act(() => {
      window.dispatchEvent(new Event('ub_auth_expired'));
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('LOGGED_OUT');
    expect(screen.getByTestId('username')).toHaveTextContent('NO_USER');
  });
});

