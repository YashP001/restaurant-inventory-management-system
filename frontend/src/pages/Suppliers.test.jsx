import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Suppliers from './Suppliers';
import { supplierApi } from '../services/api';

vi.mock('../services/api', () => ({
  supplierApi: {
    getSuppliers: vi.fn(),
    getSupplierById: vi.fn()
  }
}));

describe('Suppliers Page Component Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders suppliers without crash when backend returns standard { id, name } structure', async () => {
    supplierApi.getSuppliers.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: 'Fresh Farms Organics',
          contact_person: 'Ramesh Patel',
          email: 'ramesh@freshfarms.in',
          phone: '+91 98765 43210',
          address: 'Pune, Maharashtra',
          lead_time_days: 2,
          is_active: true
        }
      ]
    });

    render(<Suppliers />);

    expect(screen.getByText('Loading suppliers...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Fresh Farms Organics')).toBeInTheDocument();
    });

    expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
  });

  it('2. Regression: Renders safely when supplier records have undefined/null name without throwing TypeError', async () => {
    // Reproduces the exact scenario: supplier object where name is undefined or null
    supplierApi.getSuppliers.mockResolvedValueOnce({
      data: [
        {
          id: 42,
          name: undefined,
          supplier_name: undefined,
          contact_person: null,
          email: null,
          phone: null,
          address: null,
          lead_time_days: 3,
          is_active: false
        },
        {
          id: 43,
          name: 'Spice Valley',
          contact_person: 'Anita Roy',
          email: 'anita@spicevalley.com',
          phone: '9988776655',
          address: 'Kochi, Kerala',
          lead_time_days: 1,
          is_active: true
        }
      ]
    });

    render(<Suppliers />);

    // Should not throw Uncaught TypeError: Cannot read properties of undefined (reading 'toLowerCase')
    await waitFor(() => {
      expect(screen.getByText('Unnamed Supplier')).toBeInTheDocument();
      expect(screen.getByText('Spice Valley')).toBeInTheDocument();
    });

    // Test search filter with missing names
    const searchInput = screen.getByPlaceholderText(/Search suppliers by name/i);
    fireEvent.change(searchInput, { target: { value: 'Spice' } });

    await waitFor(() => {
      expect(screen.getByText('Spice Valley')).toBeInTheDocument();
      expect(screen.queryByText('Unnamed Supplier')).not.toBeInTheDocument();
    });
  });

  it('3. Safely opens supplier catalog modal using normalized ID', async () => {
    supplierApi.getSuppliers.mockResolvedValueOnce({
      data: [
        {
          id: 5,
          name: 'Dairy Delight',
          contact_person: 'Sunil Verma',
          email: 'sunil@dairydelight.in',
          phone: '9123456789',
          address: 'Amul Dairy Rd, Anand',
          lead_time_days: 1,
          is_active: true
        }
      ]
    });

    supplierApi.getSupplierById.mockResolvedValueOnce({
      data: {
        id: 5,
        name: 'Dairy Delight',
        contact_person: 'Sunil Verma',
        phone: '9123456789',
        email: 'sunil@dairydelight.in',
        lead_time_days: 1,
        ingredients: [
          {
            ingredient_id: 101,
            ingredient_name: 'Fresh Cow Milk',
            category_name: 'Dairy',
            unit_abbreviation: 'L',
            unit_cost: 62.00,
            minimum_order_quantity: 10,
            is_preferred: true
          }
        ]
      }
    });

    render(<Suppliers />);

    await waitFor(() => {
      expect(screen.getByText('Dairy Delight')).toBeInTheDocument();
    });

    const viewBtn = screen.getByRole('button', { name: /View Catalog/i });
    fireEvent.click(viewBtn);

    expect(supplierApi.getSupplierById).toHaveBeenCalledWith(5);

    await waitFor(() => {
      expect(screen.getByText('Contracted Ingredients & Pricing')).toBeInTheDocument();
      expect(screen.getByText('Fresh Cow Milk')).toBeInTheDocument();
    });
  });
});
