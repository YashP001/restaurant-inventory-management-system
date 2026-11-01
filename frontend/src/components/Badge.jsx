import React from 'react';

export function Badge({ status, label }) {
  const normalized = (status || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  if (normalized === 'UP' || normalized === 'HEALTHY' || normalized === 'CONNECTED') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    dotColor = 'bg-emerald-500 animate-pulse';
  } else if (normalized === 'DOWN' || normalized === 'UNREACHABLE' || normalized === 'ERROR') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    dotColor = 'bg-rose-500';
  } else if (normalized === 'DEGRADED' || normalized === 'WARNING') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    dotColor = 'bg-amber-500';
  } else if (normalized === 'CHECKING') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    dotColor = 'bg-blue-500 animate-ping';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      {label || normalized}
    </span>
  );
}
