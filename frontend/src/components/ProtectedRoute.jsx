import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-6">
            Your role (<span className="font-semibold text-slate-800">{user?.role}</span>) does not have permission to access this management interface.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}

