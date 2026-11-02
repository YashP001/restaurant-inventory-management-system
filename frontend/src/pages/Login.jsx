import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter your username/email and password.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (userLogin, userPass) => {
    setIdentifier(userLogin);
    setPassword(userPass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center text-white mx-auto shadow-md shadow-primary-200">
          <UtensilsCrossed className="w-7 h-7" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">Urban Bites</h2>
        <p className="mt-1 text-sm text-slate-500">Restaurant & Food Inventory Management Platform</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. rohit_admin"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition ${
                loading ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials (Development Mode Only) */}
          {import.meta.env.DEV && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
                Quick Role Test Logins (Dev Mode)
              </p>
              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => fillQuickCredentials('rohit_admin', 'UrbanBites@2026')}
                  className="p-2 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50 transition text-xs"
                >
                  <p className="font-bold text-slate-800">Rohit Sharma</p>
                  <p className="text-[10px] text-primary-600 font-semibold">ADMIN</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickCredentials('priya_inventory', 'UrbanBites@2026')}
                  className="p-2 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50 transition text-xs"
                >
                  <p className="font-bold text-slate-800">Priya Patel</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">INVENTORY MGR</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickCredentials('vikram_headchef', 'UrbanBites@2026')}
                  className="p-2 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50 transition text-xs"
                >
                  <p className="font-bold text-slate-800">Vikram Malhotra</p>
                  <p className="text-[10px] text-amber-600 font-semibold">HEAD CHEF</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickCredentials('arjun_cashier', 'UrbanBites@2026')}
                  className="p-2 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50 transition text-xs"
                >
                  <p className="font-bold text-slate-800">Arjun Verma</p>
                  <p className="text-[10px] text-blue-600 font-semibold">CASHIER / POS</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;


