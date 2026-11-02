import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, supplierApi, ordersApi } from '../services/api';
import { Badge } from '../components/Badge';
import { 
  ShoppingCart, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Clock, 
  Truck, 
  TrendingUp, 
  ChefHat,
  ArrowRight,
  RefreshCw,
  Boxes
} from 'lucide-react';

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [pendingPOs, setPendingPOs] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [invSumRes, expRes, lowRes, poRes, ordRes] = await Promise.allSettled([
        dashboardApi.getInventorySummary(),
        dashboardApi.getExpiringBatches(14),
        dashboardApi.getLowStock(),
        supplierApi.getPurchaseOrders('?status=SUBMITTED&limit=5'),
        ordersApi.getOrders('?limit=8')
      ]);

      if (invSumRes.status === 'fulfilled' && invSumRes.value?.success) {
        setSummary(invSumRes.value.data);
      }
      if (expRes.status === 'fulfilled' && expRes.value?.success) {
        setExpiringBatches(expRes.value.data?.expiring_batches || []);
      }
      if (lowRes.status === 'fulfilled' && lowRes.value?.success) {
        setLowStockItems(lowRes.value.data?.low_stock_ingredients || []);
      }
      if (poRes.status === 'fulfilled' && poRes.value?.success) {
        setPendingPOs(poRes.value.data?.purchase_orders || []);
      }
      if (ordRes.status === 'fulfilled' && ordRes.value?.success) {
        setRecentOrders(ordRes.value.data?.orders || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load live dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalValuation = summary?.total_inventory_valuation || 0;
  const activeBatchesCount = summary?.active_batches_count || 0;
  const lowStockCount = lowStockItems.length;
  const expiringCount = expiringBatches.length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Operations Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500">Live operational overview across inventory, sales, and kitchen fulfilment</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-xs transition"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Order / POS</span>
          </Link>
          <Link
            to="/procurement"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
          >
            <Boxes className="w-3.5 h-3.5 text-primary-600" />
            <span>Procurement</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchDashboardData} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Valuation</span>
            <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">₹{Number(totalValuation).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] text-slate-400 mt-1">{activeBatchesCount} active inventory batches</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Warnings</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600">{lowStockCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Ingredients below minimum par level</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiring in 14 Days</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600">{expiringCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Batches reaching shelf-life threshold</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted POs</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600">{pendingPOs.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Inbound purchase orders awaiting receipt</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Customer Orders</h3>
            </div>
            <Link to="/orders" className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Order #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">
                      {loading ? 'Loading orders...' : 'No orders recorded yet'}
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-3.5 font-bold text-slate-900">{ord.order_number}</td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{ord.order_type}</td>
                      <td className="px-4 py-3.5">
                        <Badge status={ord.status} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{ord.items_count || 1} item(s)</td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-900">₹{Number(ord.total_amount).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock & Action Alerts (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Low Stock Watchlist</span>
              </h3>
              <Link to="/inventory" className="text-xs font-bold text-primary-600 hover:text-primary-700">Details</Link>
            </div>

            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">All stock levels healthy above par levels.</p>
              ) : (
                lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-[11px] text-slate-500">Par: {item.optimal_par_level} {item.unit_abbreviation}</p>
                    </div>
                    <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                      {item.current_stock} {item.unit_abbreviation}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl text-white p-6 shadow-sm">
            <TrendingUp className="w-8 h-8 text-primary-200 mb-3" />
            <h4 className="font-bold text-base mb-1">AI Demand Forecasting Active</h4>
            <p className="text-xs text-primary-100 leading-relaxed mb-4">
              RandomForest multi-step demand predictions and BOM conversion are generating 7-day ingredient requirements.
            </p>
            <Link
              to="/forecasting"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-primary-900 bg-white hover:bg-primary-50 transition shadow-xs"
            >
              <span>Explore Forecasts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;


