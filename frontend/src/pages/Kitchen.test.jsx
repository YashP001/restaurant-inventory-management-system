import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Kitchen from './Kitchen';
import { ordersApi } from '../services/api';

vi.mock('../services/api', () => ({
  ordersApi: {
    getOrders: vi.fn(),
    confirmOrder: vi.fn(),
    markOrderReady: vi.fn(),
    deliverOrder: vi.fn(),
    completeOrder: vi.fn(),
    cancelOrder: vi.fn()
  }
}));

describe('Kitchen KDS Page Component Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('1. Normalizes order id to order_id and confirms with correct database ID', async () => {
    ordersApi.getOrders.mockResolvedValueOnce({
      data: [
        {
          id: 1005, // backend provides id
          order_number: 'UB-ORD-1005',
          order_type: 'DINE_IN',
          table: { id: 2, table_number: '2' },
          status: 'PENDING',
          items: [
            { id: 201, menu_item_name: 'Paneer Butter Masala', quantity: 2 }
          ]
        }
      ]
    });
    ordersApi.confirmOrder.mockResolvedValueOnce({
      data: { id: 1005, status: 'CONFIRMED' }
    });
    ordersApi.getOrders.mockResolvedValueOnce({
      data: [
        {
          id: 1005,
          order_number: 'UB-ORD-1005',
          order_type: 'DINE_IN',
          table: { id: 2, table_number: '2' },
          status: 'CONFIRMED',
          items: [
            { id: 201, menu_item_name: 'Paneer Butter Masala', quantity: 2 }
          ]
        }
      ]
    });

    render(<Kitchen />);

    await waitFor(() => {
      expect(screen.getByText('UB-ORD-1005')).toBeInTheDocument();
      expect(screen.getByText('Paneer Butter Masala')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirm \(FEFO\)/i });
    fireEvent.click(confirmBtn);

    // Verify confirmOrder called with numerical ID 1005 and NOT undefined
    expect(ordersApi.confirmOrder).toHaveBeenCalledWith(1005);
    expect(ordersApi.confirmOrder).not.toHaveBeenCalledWith(undefined);
  });

  it('2. Regression: Rejects confirmation if order has no valid ID and prevents sending undefined', async () => {
    ordersApi.getOrders.mockResolvedValueOnce({
      data: [
        {
          id: null,
          order_id: null,
          order_number: 'UB-ORD-INVALID',
          order_type: 'TAKEAWAY',
          status: 'PENDING',
          items: []
        }
      ]
    });

    render(<Kitchen />);

    await waitFor(() => {
      expect(screen.getByText('UB-ORD-INVALID')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirm \(FEFO\)/i });
    fireEvent.click(confirmBtn);

    // ordersApi.confirmOrder MUST NOT be called with undefined
    expect(ordersApi.confirmOrder).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/missing or undefined/i));
  });

  it('3. Clears actionLoadingId loading state when confirmOrder throws an error', async () => {
    ordersApi.getOrders.mockResolvedValueOnce({
      data: [
        {
          id: 1009,
          order_number: 'UB-ORD-1009',
          order_type: 'DINE_IN',
          status: 'PENDING',
          items: [{ id: 1, menu_item_name: 'Veg Burger', quantity: 1 }]
        }
      ]
    });
    ordersApi.confirmOrder.mockRejectedValueOnce(new Error('Insufficient inventory batch stock'));

    render(<Kitchen />);

    await waitFor(() => {
      expect(screen.getByText('UB-ORD-1009')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirm \(FEFO\)/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Insufficient inventory batch stock');
    });

    // Loading state must be reset so button returns to enabled
    expect(confirmBtn).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirm \(FEFO\)/i })).toBeInTheDocument();
  });
});

