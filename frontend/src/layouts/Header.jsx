import React from 'react';
import { Menu, RefreshCw, CheckCircle2 } from 'lucide-react';

export function Header({ onMenuClick, onRefresh, loading, lastUpdated }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
              Restaurant & Food Inventory Management System
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex-shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Phase 0
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block truncate">
            Foundational Architecture, Relational & NoSQL Database Connectivity
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        {lastUpdated && (
          <span className="text-xs text-slate-400 hidden lg:inline font-mono">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition ${
            loading ? 'opacity-70 cursor-wait' : ''
          }`}
          title="Refresh service connectivity checks"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
          <span>{loading ? 'Checking...' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
}
