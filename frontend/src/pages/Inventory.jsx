import React, { useState, useEffect } from 'react';
import { inventoryApi, catalogApi, supplierApi } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { 
  Package, 
  Search, 
  Filter, 
  ArrowDownToLine, 
  SlidersHorizontal, 
  Clock, 
  History, 
  AlertTriangle,
  Plus,
  RefreshCw
} from 'lucide-react';

export function Inventory() {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'batches' | 'expiring' | 'movements'
  const [stockList, setStockList] = useState([]);
  const [batchesList, setBatchesList] = useState([]);
  const [expiringList, setExpiringList] = useState([]);
  const [movementsList, setMovementsList] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals state
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Receive Stock Form state
  const [receiveForm, setReceiveForm] = useState({
    supplier_id: '',
    ingredient_id: '',
    batch_number: '',
    quantity_received: '',
    unit_cost: '',
    expiry_date: '',
    received_date: new Date().toISOString().split('T')[0]
  });

  // Adjust Stock Form state
  const [adjustForm, setAdjustForm] = useState({
    batch_id: '',
    adjustment_type: 'INCREASE', // 'INCREASE' | 'DECREASE'
    quantity: '',
    reason: 'CYCLE_COUNT_CORRECTION',
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [stockRes, batchRes, expRes, movRes, ingRes, supRes] = await Promise.allSettled([
        inventoryApi.getCurrentStock(),
        inventoryApi.getBatches('?limit=50'),
        inventoryApi.getBatches('?limit=50&status=ACTIVE'),
        inventoryApi.getMovements('?limit=50'),
        catalogApi.getIngredients(),
        supplierApi.getSuppliers()
      ]);

      if (stockRes.status === 'fulfilled' && stockRes.value?.success) {
        setStockList(stockRes.value.data?.stock || []);
      }
      if (batchRes.status === 'fulfilled' && batchRes.value?.success) {
        setBatchesList(batchRes.value.data?.batches || []);
      }
      if (expRes.status === 'fulfilled' && expRes.value?.success) {
        const active = expRes.value.data?.batches || [];
        // Sort by expiry_date ASC
        setExpiringList(active.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)));
      }
      if (movRes.status === 'fulfilled' && movRes.value?.success) {
        setMovementsList(movRes.value.data?.movements || []);
      }
      if (ingRes.status === 'fulfilled' && ingRes.value?.success) {
        setIngredients(ingRes.value.data?.ingredients || []);
      }
      if (supRes.status === 'fulfilled' && supRes.value?.success) {
        setSuppliers(supRes.value.data?.suppliers || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setModalError('');

      await inventoryApi.receiveStock({
        supplier_id: Number(receiveForm.supplier_id),
        items: [
          {
            ingredient_id: Number(receiveForm.ingredient_id),
            batch_number: receiveForm.batch_number.trim(),
            quantity_received: Number(receiveForm.quantity_received),
            unit_cost: Number(receiveForm.unit_cost),
            expiry_date: receiveForm.expiry_date,
            received_date: receiveForm.received_date
          }
        ]
      });

      setShowReceiveModal(false);
      setReceiveForm({
        supplier_id: '',
        ingredient_id: '',
        batch_number: '',
        quantity_received: '',
        unit_cost: '',
        expiry_date: '',
        received_date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (err) {
      setModalError(err.message || 'Failed to record stock inward');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setModalError('');

      await inventoryApi.adjustStock({
        batch_id: Number(adjustForm.batch_id),
        adjustment_type: adjustForm.adjustment_type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
        notes: adjustForm.notes
      });

      setShowAdjustModal(false);
      setAdjustForm({
        batch_id: '',
        adjustment_type: 'INCREASE',
        quantity: '',
        reason: 'CYCLE_COUNT_CORRECTION',
        notes: ''
      });
      loadData();
    } catch (err) {
      setModalError(err.message || 'Failed to submit inventory adjustment');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Stock Items
  const filteredStock = stockList.filter(item => {
    const matchesSearch = !search || item.ingredient_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || item.stock_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Inventory & Stock Tracking</h1>
          <p className="text-xs sm:text-sm text-slate-500">Live ingredient balances, FEFO batches, movements, and manual adjustments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setModalError(''); setShowReceiveModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-xs transition"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Receive Stock</span>
          </button>
          <button
            type="button"
            onClick={() => { setModalError(''); setShowAdjustModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Adjust Stock</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'stock' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Current Stock ({stockList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expiring')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'expiring' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Expiring Batches ({expiringList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'batches' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>All Batches ({batchesList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'movements' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movements Ledger</span>
        </button>
      </div>

      {/* TAB 1: CURRENT STOCK */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ingredients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Ingredient</th>
                  <th className="px-4 py-3">Current Stock</th>
                  <th className="px-4 py-3">Safety Min</th>
                  <th className="px-4 py-3">Optimal Par</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Valuation</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      {loading ? 'Loading stock balances...' : 'No ingredients match query'}
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((item) => (
                    <tr key={item.ingredient_id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-slate-900">{item.ingredient_name}</p>
                        <p className="text-[10px] text-slate-400">ID #{item.ingredient_id}</p>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {item.current_stock} {item.unit_abbreviation}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{item.minimum_stock_level} {item.unit_abbreviation}</td>
                      <td className="px-4 py-3.5 text-slate-600">{item.optimal_par_level} {item.unit_abbreviation}</td>
                      <td className="px-4 py-3.5 text-slate-600">₹{Number(item.cost_per_unit).toFixed(2)}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        ₹{(Number(item.current_stock) * Number(item.cost_per_unit)).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Badge status={item.stock_status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EXPIRING BATCHES */}
      {activeTab === 'expiring' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-amber-50/40">
            <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>FEFO Priority View: Batches ordered by expiry date ascending. Prioritize consumption or inventory auditing.</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Batch Number</th>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3">Remaining Qty</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Received Date</th>
                  <th className="px-6 py-3 text-right">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No active batches recorded</td>
                  </tr>
                ) : (
                  expiringList.map((b) => {
                    const daysUntil = Math.ceil((new Date(b.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysUntil <= 7;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-3.5 font-bold text-slate-900">{b.batch_number}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">{b.ingredient_name || `Ingredient #${b.ingredient_id}`}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-900">{b.quantity_remaining}</td>
                        <td className="px-4 py-3.5 text-slate-600">₹{Number(b.unit_cost).toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-slate-500">{b.received_date}</td>
                        <td className="px-6 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isUrgent ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{b.expiry_date} ({daysUntil}d)</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL BATCHES */}
      {activeTab === 'batches' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Batch Number</th>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3">Received Qty</th>
                  <th className="px-4 py-3">Remaining Qty</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchesList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{b.batch_number}</td>
                    <td className="px-4 py-3.5 text-slate-800 font-medium">{b.ingredient_name || `Item #${b.ingredient_id}`}</td>
                    <td className="px-4 py-3.5 text-slate-600">{b.quantity_received}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{b.quantity_remaining}</td>
                    <td className="px-4 py-3.5 text-slate-600">₹{Number(b.unit_cost).toFixed(2)}</td>
                    <td className="px-4 py-3.5">
                      <Badge status={b.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right text-slate-600">{b.expiry_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MOVEMENTS LEDGER */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Date & Time</th>
                  <th className="px-4 py-3">Batch / Item</th>
                  <th className="px-4 py-3">Movement Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Balance After</th>
                  <th className="px-6 py-3 text-right">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementsList.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5 text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{m.batch_number || `Batch #${m.batch_id}`}</td>
                    <td className="px-4 py-3.5 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        m.movement_type === 'PURCHASE_RECEIPT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        m.movement_type === 'ORDER_CONSUMPTION' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        m.movement_type === 'WASTE_DISPOSAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-black text-slate-900">{m.quantity}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-600">{m.balance_after}</td>
                    <td className="px-6 py-3.5 text-right text-slate-500 font-mono text-[11px]">{m.reference_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE INWARD STOCK */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title="Stock Inward & Batch Receiving"
      >
        {modalError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {modalError}
          </div>
        )}

        <form onSubmit={handleReceiveStock} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Supplier</label>
              <select
                value={receiveForm.supplier_id}
                onChange={(e) => setReceiveForm({ ...receiveForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Ingredient</label>
              <select
                value={receiveForm.ingredient_id}
                onChange={(e) => setReceiveForm({ ...receiveForm, ingredient_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              >
                <option value="">Select Ingredient</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_abbreviation})</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Batch Number</label>
              <input
                type="text"
                placeholder="e.g. BATCH-2026-N1"
                value={receiveForm.batch_number}
                onChange={(e) => setReceiveForm({ ...receiveForm, batch_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Quantity Received</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                placeholder="0.000"
                value={receiveForm.quantity_received}
                onChange={(e) => setReceiveForm({ ...receiveForm, quantity_received: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Unit Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={receiveForm.unit_cost}
                onChange={(e) => setReceiveForm({ ...receiveForm, unit_cost: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Received Date</label>
              <input
                type="date"
                value={receiveForm.received_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, received_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Expiry Date</label>
              <input
                type="date"
                value={receiveForm.expiry_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowReceiveModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-xs"
            >
              {actionLoading ? 'Recording...' : 'Record Inward Batch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: MANUAL STOCK ADJUSTMENT */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Manual Stock Adjustment"
      >
        {modalError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {modalError}
          </div>
        )}

        <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Target Batch</label>
            <select
              value={adjustForm.batch_id}
              onChange={(e) => setAdjustForm({ ...adjustForm, batch_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              required
            >
              <option value="">Select Batch to Adjust</option>
              {batchesList.filter(b => b.status === 'ACTIVE').map(b => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} - {b.ingredient_name || `Item #${b.ingredient_id}`} (Rem: {b.quantity_remaining})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Adjustment Type</label>
              <select
                value={adjustForm.adjustment_type}
                onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              >
                <option value="INCREASE">Increase Stock (+)</option>
                <option value="DECREASE">Decrease Stock (-)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Quantity</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                placeholder="0.000"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Reason</label>
            <select
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            >
              <option value="CYCLE_COUNT_CORRECTION">Cycle Count Correction</option>
              <option value="SPOILAGE_DISPOSAL">Spoilage / Damage</option>
              <option value="DATA_ENTRY_ERROR">Data Entry Error</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Notes</label>
            <textarea
              rows="2"
              placeholder="Provide context for audit ledger..."
              value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAdjustModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-xs"
            >
              {actionLoading ? 'Adjusting...' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Inventory;


