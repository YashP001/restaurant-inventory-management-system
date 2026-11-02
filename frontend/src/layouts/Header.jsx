import React from 'react';
import { Menu, UserCircle, Bell, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Header({ onMenuClick, onRefresh, loading }) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            Urban Bites Management Platform
          </h2>
          <p className="text-xs text-slate-500 hidden sm:block truncate">
            Live Inventory Visibility, FEFO Batches, POS & AI Demand Forecasting
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition ${
              loading ? 'opacity-70 cursor-wait' : ''
            }`}
            title="Refresh active view"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary-600' : 'text-slate-500'}`} />
            <span className="hidden md:inline">{loading ? 'Updating...' : 'Sync'}</span>
          </button>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
            {user?.username ? user.username.slice(0, 2).toUpperCase() : 'UB'}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">{user?.username}</p>
            <p className="text-[10px] text-slate-500 font-medium">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
