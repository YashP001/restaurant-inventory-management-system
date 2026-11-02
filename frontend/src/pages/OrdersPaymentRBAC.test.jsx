import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Orders from './Orders';
import * as AuthContextModule from '../context/AuthContext';
import { ordersApi, catalogApi } from '../services/api';

vi.mock('../services/api', () => ({
  ordersApi: {
    getOrders: vi.fn(),
    getOrderById: vi.fn(),
    createOrder: vi.fn(),
    confirmOrder: vi.fn(),
    recordPayment: vi.fn()
  },
  catalogApi: {
    getMenuItems: vi.fn().mockResolvedValue({ data: [] }),
    getCategories: vi.fn().mockResolvedValue({ data: [] })
  }
}));

describe('Orders Page Payment RBAC Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUnpaidOrders = [
    {
      id: 1006,
      order_number: 'UB-ORD-1006',
      order_type: 'DINE_IN',
      status: 'CONFIRMED',
      total_amount: 500.00,
      total_paid: 0.00,
      payment_status: 'UNPAID',
      items: [
        { id: 1, menu_item_name: 'Margherita Pizza', quantity: 2, unit_price: 250.00 }
      ]
    }
  ];

  it('1. CHEF role cannot see Pay button or Record Payment button', async () => {
    // Mock user as CHEF
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, username: 'vikram_chef', role: 'CHEF' },
      hasRole: (...roles) => roles.includes('CHEF')
    });

    ordersApi.getOrders.mockResolvedValueOnce({ data: mockUnpaidOrders });
    ordersApi.getOrderById.mockResolvedValueOnce({ data: mockUnpaidOrders[0] });

    render(<Orders />);

    // Switch to Order History tab
    const historyTab = screen.getByRole('button', { name: /^Order History$/i });
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(screen.getByText('UB-ORD-1006')).toBeInTheDocument();
    });

    // Pay button must NOT be rendered for CHEF
    expect(screen.queryByRole('button', { name: /^Pay$/i })).not.toBeInTheDocument();

    // Open Details Modal
    const detailsBtn = screen.getByRole('button', { name: /Details/i });
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByText(/Order Ticket: UB-ORD-1006/i)).toBeInTheDocument();
    });

    // Record Payment button must NOT be rendered for CHEF
    expect(screen.queryByRole('button', { name: /Record Payment/i })).not.toBeInTheDocument();
  });

  it('2. CASHIER role CAN see Pay button and Record Payment button', async () => {
    // Mock user as CASHIER
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 4, username: 'ananya_cashier', role: 'CASHIER' },
      hasRole: (...roles) => roles.includes('CASHIER')
    });

    ordersApi.getOrders.mockResolvedValueOnce({ data: mockUnpaidOrders });
    ordersApi.getOrderById.mockResolvedValueOnce({ data: mockUnpaidOrders[0] });

    render(<Orders />);

    // Switch to Order History tab
    const historyTab = screen.getByRole('button', { name: /^Order History$/i });
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(screen.getByText('UB-ORD-1006')).toBeInTheDocument();
    });

    // Pay button MUST be visible for CASHIER
    const payBtn = screen.getByRole('button', { name: /^Pay$/i });
    expect(payBtn).toBeInTheDocument();

    // Open Details Modal
    const detailsBtn = screen.getByRole('button', { name: /Details/i });
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByText(/Order Ticket: UB-ORD-1006/i)).toBeInTheDocument();
    });

    // Record Payment button MUST be visible for CASHIER
    expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument();
  });
});
