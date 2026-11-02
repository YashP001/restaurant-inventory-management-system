import React from 'react';

export function Badge({ status, label, className = '' }) {
  const normalized = (status || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  switch (normalized) {
    case 'UP':
    case 'HEALTHY':
    case 'CONNECTED':
    case 'COMPLETED':
    case 'RECEIVED':
    case 'IN_STOCK':
    case 'ACTIVE':
    case 'PAID':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      break;

    case 'DOWN':
    case 'UNREACHABLE':
    case 'ERROR':
    case 'CANCELLED':
    case 'OUT_OF_STOCK':
    case 'EXPIRED':
    case 'DISCARDED':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      break;

    case 'DEGRADED':
    case 'WARNING':
    case 'PENDING':
    case 'LOW_STOCK':
    case 'PARTIALLY_RECEIVED':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      break;

    case 'PREPARING':
    case 'READY_FOR_PICKUP':
    case 'DELIVERED':
    case 'CONFIRMED':
    case 'SUBMITTED':
    case 'CHECKING':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      break;

    case 'DRAFT':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      dotColor = 'bg-purple-500';
      break;

    default:
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {label || normalized.replace(/_/g, ' ')}
    </span>
  );
}

export default Badge;

