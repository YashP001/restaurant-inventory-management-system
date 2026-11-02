import React, { useState, useEffect } from 'react';
import { inventoryApi, catalogApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Waste() {
  const [wasteRecords, setWasteRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reasonFilter, setReasonFilter] = useState('');
  const [search, setSearch] = useState('');

  // Log Waste Modal state
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedIngredientBatches, setSelectedIngredientBatches] = useState([]);
  const [wasteForm, setWasteForm] = useState({
    ingredient_id: '',
    batch_id: '',
    quantity_wasted: '',
    waste_reason: 'EXPIRED',
    notes: '',
    waste_date: new Date().toISOString().split('T')[0]
  });
  const [submittingWaste, setSubmittingWaste] = useState(false);

  useEffect(() => {
    fetchWaste();
  }, [reasonFilter]);

  const fetchWaste = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = reasonFilter ? `?waste_reason=${reasonFilter}` : '';
      const res = await inventoryApi.getWasteRecords(query);
      setWasteRecords(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load waste records');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLogModal = async () => {
    try {
      const [ingRes, batchRes] = await Promise.all([
        catalogApi.getIngredients('?limit=100'),
        inventoryApi.getBatches('?limit=100')
      ]);
      setIngredients(ingRes.data || []);
      setBatches(batchRes.data || []);
      setWasteForm({
        ingredient_id: '',
        batch_id: '',
        quantity_wasted: '',
        waste_reason: 'EXPIRED',
        notes: '',
        waste_date: new Date().toISOString().split('T')[0]
      });
      setSelectedIngredientBatches([]);
      setIsLogOpen(true);
    } catch (err) {
      alert('Failed to load ingredients/batches for logging waste');
    }
  };

  const handleIngredientChange = (ingredientId) => {
    const ingId = parseInt(ingredientId);
    setWasteForm(prev => ({ ...prev, ingredient_id: ingredientId, batch_id: '' }));
    // Filter available batches for this ingredient
    const matched = batches.filter(b => b.ingredient_id === ingId && parseFloat(b.current_quantity) > 0);
    setSelectedIngredientBatches(matched);
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    setSubmittingWaste(true);
    try {
      const payload = {
        ingredient_id: parseInt(wasteForm.ingredient_id),
        batch_id: parseInt(wasteForm.batch_id),
        quantity_wasted: parseFloat(wasteForm.quantity_wasted),
        waste_reason: wasteForm.waste_reason,
        notes: wasteForm.notes || undefined,
        waste_date: wasteForm.waste_date
      };
      await inventoryApi.recordWaste(payload);
      alert('Food waste record logged successfully and batch stock deducted.');
      setIsLogOpen(false);
      fetchWaste();
    } catch (err) {
      alert(err.message || 'Failed to log waste');
    } finally {
      setSubmittingWaste(false);
    }
  };

  const filtered = wasteRecords.filter(w => {
    const term = search.toLowerCase();
    const ingName = (w.ingredient_name || '').toLowerCase();
    const batchNum = (w.batch_number || '').toLowerCase();
    const reason = (w.waste_reason || '').toLowerCase();
    return ingName.includes(term) || batchNum.includes(term) || reason.includes(term);
  });

  const totalLoss = filtered.reduce((acc, curr) => acc + (parseFloat(curr.financial_loss || curr.total_loss || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Food Waste Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track spoilage, preparation scraps, expired inventory, and shrinkage financial loss
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenLogModal}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> Record Food Waste
          </button>
        </div>
      </div>

      {/* KPI Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Total Waste Incidents</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Estimated Financial Loss</span>
          <p className="text-2xl font-bold text-red-600 mt-1">₹{totalLoss.toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Primary Waste Driver</span>
          <p className="text-xl font-bold text-gray-800 mt-1">Spoilage & Expiry</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search waste by ingredient or batch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Reason:</label>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Reasons</option>
            <option value="EXPIRED">Expired</option>
            <option value="SPOILED">Spoiled</option>
            <option value="PREPARATION_SCRAP">Preparation Scrap</option>
            <option value="OVERCOOKED">Overcooked</option>
            <option value="CUSTOMER_RETURN">Customer Return</option>
            <option value="STORAGE_CONTAMINATION">Storage Contamination</option>
          </select>
        </div>
      </div>

      {/* Waste Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading waste records...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No food waste records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Ingredient</th>
                  <th className="px-6 py-3">Batch #</th>
                  <th className="px-6 py-3">Quantity</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Financial Loss</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((w, idx) => (
                  <tr key={w.waste_id || idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-xs font-medium text-gray-900">
                      {w.waste_date ? w.waste_date.split('T')[0] : '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {w.ingredient_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {w.batch_number || '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-red-600">
                      -{w.quantity_wasted} {w.unit_abbreviation || ''}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        status={w.waste_reason === 'EXPIRED' ? 'OUT_OF_STOCK' : 'LOW_STOCK'}
                        type="inventory"
                        label={w.waste_reason.replace('_', ' ')}
                      />
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      ₹{parseFloat(w.financial_loss || w.total_loss || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {w.notes || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {w.recorded_by_name || w.username || 'Staff'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Waste Modal */}
      <Modal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        title="Record Food Waste Event"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleLogSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Ingredient *</label>
            <select
              required
              value={wasteForm.ingredient_id}
              onChange={(e) => handleIngredientChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">-- Choose Ingredient --</option>
              {ingredients.map(ing => (
                <option key={ing.ingredient_id} value={ing.ingredient_id}>
                  {ing.ingredient_name} ({ing.unit_abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Inventory Batch *</label>
            <select
              required
              disabled={!wasteForm.ingredient_id}
              value={wasteForm.batch_id}
              onChange={(e) => setWasteForm({ ...wasteForm, batch_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100"
            >
              <option value="">-- Choose Batch --</option>
              {selectedIngredientBatches.map(b => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_number} (Avail: {b.current_quantity}, Exp: {b.expiry_date ? b.expiry_date.split('T')[0] : 'N/A'})
                </option>
              ))}
            </select>
            {wasteForm.ingredient_id && selectedIngredientBatches.length === 0 && (
              <p className="text-2xs text-red-500 mt-1">No active batches with quantity &gt; 0 for this ingredient.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quantity Wasted *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={wasteForm.quantity_wasted}
                onChange={(e) => setWasteForm({ ...wasteForm, quantity_wasted: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Waste Date *</label>
              <input
                type="date"
                required
                value={wasteForm.waste_date}
                onChange={(e) => setWasteForm({ ...wasteForm, waste_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Waste Reason *</label>
            <select
              required
              value={wasteForm.waste_reason}
              onChange={(e) => setWasteForm({ ...wasteForm, waste_reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="EXPIRED">Expired</option>
              <option value="SPOILED">Spoiled</option>
              <option value="PREPARATION_SCRAP">Preparation Scrap</option>
              <option value="OVERCOOKED">Overcooked</option>
              <option value="CUSTOMER_RETURN">Customer Return</option>
              <option value="STORAGE_CONTAMINATION">Storage Contamination</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Discard Details</label>
            <textarea
              rows="2"
              placeholder="e.g. Fridge temperature spike spoiled dairy container"
              value={wasteForm.notes}
              onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsLogOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingWaste || !wasteForm.batch_id}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {submittingWaste ? 'Saving...' : 'Record Waste & Deduct Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

