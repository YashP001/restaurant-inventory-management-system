import React from 'react';
import { Badge } from './Badge';

export function StatusCard({ title, icon: Icon, role, target, status, latencyMs, details, error }) {
  const isUp = status === 'UP' || status === 'HEALTHY';

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between min-w-0">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm truncate">{title}</h3>
              <p className="text-[11px] text-slate-500 truncate">{role}</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Badge status={status} />
          </div>
        </div>

        {/* Key Metrics / Metadata */}
        <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50/60 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 whitespace-nowrap">Target:</span>
            <span className="font-mono text-[11px] text-slate-700 truncate" title={target}>{target}</span>
          </div>
          {latencyMs !== undefined && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 whitespace-nowrap">Latency:</span>
              <span className="font-semibold text-emerald-700">{latencyMs} ms</span>
            </div>
          )}
          {details && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 whitespace-nowrap">Info:</span>
              <span className="font-mono text-[11px] text-slate-700 truncate" title={details}>{details}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Status diagnosis */}
      {error ? (
        <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200/60 text-[11px] text-rose-700 font-mono break-words leading-tight">
          <span className="font-semibold text-rose-800">Diag:</span> {error}
        </div>
      ) : (
        <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Operational & responding
        </div>
      )}
    </div>
  );
}
