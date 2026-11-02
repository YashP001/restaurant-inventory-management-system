import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  UtensilsCrossed, 
  BookOpen, 
  ChefHat, 
  Package, 
  Trash2, 
  Truck, 
  ClipboardList, 
  TrendingUp, 
  Boxes, 
  Users,
  LogOut
} from 'lucide-react';

export function Sidebar({ isOpen, onClose }) {
  const { user, logout, hasRole } = useAuth();

  const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Customer Orders', to: '/orders', icon: ShoppingCart },
    { label: 'Kitchen Fulfilment', to: '/kitchen', icon: ChefHat },
    { label: 'Menu Catalog', to: '/menu', icon: UtensilsCrossed },
    { label: 'Recipes & BOM', to: '/recipes', icon: BookOpen },
    { label: 'Inventory & Batches', to: '/inventory', icon: Package },
    { label: 'Food Waste', to: '/waste', icon: Trash2 },
    { label: 'Suppliers', to: '/suppliers', icon: Truck, roles: ['ADMIN', 'INVENTORY_MANAGER'] },
    { label: 'Purchase Orders', to: '/purchase-orders', icon: ClipboardList, roles: ['ADMIN', 'INVENTORY_MANAGER'] },
    { label: 'Demand Forecasting', to: '/forecasting', icon: TrendingUp },
    { label: 'Procurement Engine', to: '/procurement', icon: Boxes, roles: ['ADMIN', 'INVENTORY_MANAGER'] },
    { label: 'Staff Management', to: '/staff', icon: Users, roles: ['ADMIN'] }
  ];

  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true;
    return hasRole(...item.roles);
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 shadow-sm ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Brand Header */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-sm shadow-primary-200">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-none">Urban Bites</h1>
              <p className="text-[10px] text-primary-600 font-bold tracking-wider uppercase mt-1">Inventory & POS SaaS</p>
            </div>
          </div>

          {/* Navigation Items (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Operations & Modules
            </div>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive 
                      ? 'bg-primary-50 text-primary-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* User Account & Logout Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name || user?.username || 'Staff Member'}</p>
                <span className="inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-800">
                  {user?.role || 'STAFF'}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Log out of system"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
