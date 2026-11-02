import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';

describe('ProtectedRoute Component', () => {
  it('renders loading spinner while authentication state is resolving', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: true,
      hasRole: vi.fn()
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Verifying credentials...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      hasRole: vi.fn()
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page Mock</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
  });

  it('renders Access Restricted screen when user lacks required role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 5, username: 'arjun_cashier', role: 'CASHIER' },
      isAuthenticated: true,
      loading: false,
      hasRole: (role) => role === 'CASHIER'
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['ADMIN', 'INVENTORY_MANAGER']}>
          <div>Admin Only Panel</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/Your role/)).toBeInTheDocument();
    expect(screen.getByText('CASHIER')).toBeInTheDocument();
    expect(screen.queryByText('Admin Only Panel')).not.toBeInTheDocument();
  });

  it('renders protected child component when user has required role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, username: 'rohit_admin', role: 'ADMIN' },
      isAuthenticated: true,
      loading: false,
      hasRole: (...roles) => roles.includes('ADMIN')
    });

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <div>Admin Secured Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Secured Content')).toBeInTheDocument();
    expect(screen.queryByText('Access Restricted')).not.toBeInTheDocument();
  });

  it('renders children when no specific roles are required and user is authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, username: 'vikram_headchef', role: 'CHEF' },
      isAuthenticated: true,
      loading: false,
      hasRole: vi.fn()
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>All Staff Visible Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('All Staff Visible Content')).toBeInTheDocument();
  });
});
