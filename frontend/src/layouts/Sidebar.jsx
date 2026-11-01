import React from 'react';
import { 
  Activity, 
  UtensilsCrossed, 
  BookOpen, 
  ShoppingCart, 
  Package, 
  Truck, 
  TrendingUp, 
  Trash2, 
  Users 
} from 'lucide-react';

export function Sidebar({ isOpen, onClose }) {
  const navItems = [
    { label: 'System Health & Status', icon: Activity, active: true, phase: 'Phase 0' },
    { label: 'Menu & Recipes', icon: BookOpen, active: false, phase: 'Phase 1' },
    { label: 'Orders & POS', icon: ShoppingCart, active: false, phase: 'Phase 2' },
    { label: 'Inventory & Stock', icon: Package, active: false, phase: 'Phase 2' },
    { label: 'Suppliers & Purchases', icon: Truck, active: false, phase: 'Phase 3' },
    { label: 'Demand Forecasting', icon: TrendingUp, active: false, phase: 'Phase 4' },
    { label: 'Food Waste Tracking', icon: Trash2, active: false, phase: 'Phase 5' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div>
          {/* Logo & Brand */}
          <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-none">RestoInventory</h1>
              <p className="text-[10px] text-emerald-700 font-semibold tracking-wider uppercase mt-0.5">Intelligent Ops</p>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="p-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              System Modules
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      item.active
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${item.active ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      item.active ? 'bg-emerald-200/60 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.phase}
                    </span>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Users className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-800">DBMS Laboratory Project</p>
              <p className="text-[11px] text-slate-500">Team of 3 Students</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
