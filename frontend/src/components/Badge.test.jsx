import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders status label correctly with default styling and replaces underscores with spaces', () => {
    render(<Badge status="UNKNOWN_STATUS" />);
    const badge = screen.getByText('UNKNOWN STATUS');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('span')).toHaveClass('bg-slate-100', 'text-slate-700');
  });

  it('normalizes status casing to uppercase display', () => {
    render(<Badge status="healthy" />);
    const badge = screen.getByText('HEALTHY');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('span')).toHaveClass('bg-emerald-50', 'text-emerald-700');
  });

  it('uses custom label if provided', () => {
    render(<Badge status="ACTIVE" label="In Service" />);
    expect(screen.getByText('In Service')).toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('renders emerald styling for positive operational statuses', () => {
    const positiveStatuses = ['UP', 'HEALTHY', 'COMPLETED', 'RECEIVED', 'ACTIVE', 'PAID'];
    for (const st of positiveStatuses) {
      const { unmount } = render(<Badge status={st} />);
      const el = screen.getByText(st.replace(/_/g, ' ')).closest('span');
      expect(el).toHaveClass('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
      unmount();
    }
  });

  it('renders rose styling for failure and discard statuses', () => {
    const dangerStatuses = ['DOWN', 'ERROR', 'CANCELLED', 'OUT_OF_STOCK', 'EXPIRED', 'DISCARDED'];
    for (const st of dangerStatuses) {
      const { unmount } = render(<Badge status={st} />);
      const el = screen.getByText(st.replace(/_/g, ' ')).closest('span');
      expect(el).toHaveClass('bg-rose-50', 'text-rose-700', 'border-rose-200');
      unmount();
    }
  });

  it('renders amber styling for warning and pending statuses', () => {
    const warningStatuses = ['DEGRADED', 'WARNING', 'PENDING', 'LOW_STOCK', 'PARTIALLY_RECEIVED'];
    for (const st of warningStatuses) {
      const { unmount } = render(<Badge status={st} />);
      const el = screen.getByText(st.replace(/_/g, ' ')).closest('span');
      expect(el).toHaveClass('bg-amber-50', 'text-amber-700', 'border-amber-200');
      unmount();
    }
  });

  it('renders blue styling for in-progress statuses', () => {
    const progressStatuses = ['PREPARING', 'READY_FOR_PICKUP', 'DELIVERED', 'CONFIRMED', 'SUBMITTED'];
    for (const st of progressStatuses) {
      const { unmount } = render(<Badge status={st} />);
      const el = screen.getByText(st.replace(/_/g, ' ')).closest('span');
      expect(el).toHaveClass('bg-blue-50', 'text-blue-700', 'border-blue-200');
      unmount();
    }
  });

  it('renders purple styling for DRAFT status', () => {
    render(<Badge status="DRAFT" />);
    const el = screen.getByText('DRAFT').closest('span');
    expect(el).toHaveClass('bg-purple-50', 'text-purple-700', 'border-purple-200');
  });

  it('appends custom className when passed', () => {
    render(<Badge status="ACTIVE" className="custom-test-badge" />);
    const el = screen.getByText('ACTIVE').closest('span');
    expect(el).toHaveClass('custom-test-badge');
  });
});
