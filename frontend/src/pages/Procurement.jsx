import React, { useState, useEffect } from 'react';
import { procurementApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Procurement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [onlyShortages, setOnlyShortages] = useState(true);

  // Conversion Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionNotes, setConversionNotes] = useState('');
  const [conversionResult, setConversionResult] = useState(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await procurementApi.getRecommendations('?horizon_days=7');
      setData(res.data);
      // Automatically preselect all items flagged with reorder_needed
      if (res.data?.recommendations) {
        const shortages = new Set(
          res.data.recommendations.filter(r => r.reorder_needed).map(r => r.ingredient_id)
        );
        setSelectedIds(shortages);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate procurement recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleSelectAllShortages = () => {
    if (!data?.recommendations) return;
    const shortages = new Set(
      data.recommendations.filter(r => r.reorder_needed).map(r => r.ingredient_id)
    );
    setSelectedIds(shortages);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Prepare items for draft PO conversion modal
  const selectedItems = (data?.recommendations || []).filter(r => selectedIds.has(r.ingredient_id));

  // Group selected items by supplier
  const groupedBySupplier = selectedItems.reduce((acc, item) => {
    if (!item.supplier) {
      acc.unassigned = acc.unassigned || [];
      acc.unassigned.push(item);
      return acc;
    }
    const supId = item.supplier.supplier_id;
    if (!acc[supId]) {
      acc[supId] = {
        supplier_id: supId,
        supplier_name: item.supplier.supplier_name,
        lead_time_days: item.supplier.lead_time_days,
        items: [],
        totalCost: 0
      };
    }
    acc[supId].items.push(item);
    acc[supId].totalCost += item.estimated_cost;
    return acc;
  }, {});

  const handleOpenConfirmModal = () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one recommendation line item.');
      return;
    }
    if (groupedBySupplier.unassigned && groupedBySupplier.unassigned.length > 0) {
      const unassignedNames = groupedBySupplier.unassigned.map(i => i.ingredient_name).join(', ');
      alert(`Warning: The following ingredients have no approved vendor mapped and cannot be converted: ${unassignedNames}. Deselect them to continue.`);
      return;
    }
    setConversionNotes('Generated from AI 7-day demand forecasting recommendations');
    setIsConfirmOpen(true);
  };

  const handleExecuteConversion = async () => {
    setConverting(true);
    try {
      const payload = {
        notes: conversionNotes || undefined,
        items: selectedItems.map(item => ({
          ingredient_id: item.ingredient_id,
          supplier_id: item.supplier.supplier_id,
          quantity: item.recommended_order_quantity,
          unit_cost: item.supplier.contract_unit_cost
        }))
      };

      const res = await procurementApi.convertToPO(payload);
      setConversionResult(res.data);
      alert('Draft Purchase Order(s) created successfully! Review them under Purchase Orders.');
      setIsConfirmOpen(false);
      // Refresh recommendations
      await fetchRecommendations();
    } catch (err) {
      alert(err.message || 'Failed to convert recommendations to PO');
    } finally {
      setConverting(false);
    }
  };

  const recommendations = data?.recommendations || [];
  const filtered = recommendations.filter(r => {
    const matchSearch = r.ingredient_name.toLowerCase().includes(search.toLowerCase());
    const matchShortage = onlyShortages ? r.reorder_needed : true;
    return matchSearch && matchShortage;
  });

  const totalProcurementCost = selectedItems.reduce((sum, item) => sum + item.estimated_cost, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Intelligent Procurement Engine</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reorder point analysis considering lead-time demand, expiry schedules, safety stock & supplier MOQs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRecommendations}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition"
          >
            Re-evaluate
          </button>
          <button
            onClick={handleOpenConfirmModal}
            disabled={selectedItems.length === 0}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            <span>📝</span> Convert Selected to Draft PO ({selectedItems.length})
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Evaluated Ingredients</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_ingredients_evaluated}</p>
            <span className="text-2xs text-gray-400">Total recipe catalog</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Reorder Required</span>
            <p className="text-2xl font-bold text-red-600 mt-1">{data.reorder_required_count}</p>
            <span className="text-2xs text-red-500">Shortage &lt; Reorder Point</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Forecast Horizon</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.forecast_horizon_days} Days</p>
            <span className="text-2xs text-gray-400">{data.forecast_start_date} → {data.forecast_end_date}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Selected PO Value</span>
            <p className="text-2xl font-bold text-primary-600 mt-1">₹{totalProcurementCost.toFixed(2)}</p>
            <span className="text-2xs text-gray-400">{selectedItems.length} lines selected</span>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Selection Shortcuts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyShortages}
              onChange={(e) => setOnlyShortages(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            Show Shortages Only
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleSelectAllShortages}
            className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-semibold transition"
          >
            Select All Shortages
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium transition"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Procurement Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Evaluating supply chains and forecasts...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50">
            <p className="font-semibold">Error Generating Procurement Recommendations</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No procurement recommendations matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">Select</th>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3">Usable Stock</th>
                  <th className="px-4 py-3">Safety Stock</th>
                  <th className="px-4 py-3">ROP</th>
                  <th className="px-4 py-3">Lead-Time Dem.</th>
                  <th className="px-4 py-3">7D Forecast</th>
                  <th className="px-4 py-3">Inbound POs</th>
                  <th className="px-4 py-3">Supplier & MOQ</th>
                  <th className="px-4 py-3 font-bold text-gray-900">Suggested Order</th>
                  <th className="px-4 py-3">Est. Cost</th>
                  <th className="px-4 py-3">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                  const isSelected = selectedIds.has(item.ingredient_id);
                  return (
                    <tr
                      key={item.ingredient_id}
                      className={`hover:bg-gray-50 transition ${
                        item.reorder_needed ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.ingredient_id)}
                          className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {item.ingredient_name}
                        <span className="text-2xs text-gray-400 block font-normal font-mono">{item.unit_abbr}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">
                        {item.current_usable_stock}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500">
                        {item.safety_stock}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-700">
                        {item.reorder_point}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">
                        {item.lead_time_demand}
                      </td>
                      <td className="px-4 py-3 font-mono text-primary-600 font-semibold">
                        {item.total_forecast_demand_7d}
                      </td>
                      <td className="px-4 py-3 font-mono text-green-700">
                        {item.total_inbound_po_quantity > 0 ? `+${item.total_inbound_po_quantity}` : '0'}
                      </td>
                      <td className="px-4 py-3">
                        {item.supplier ? (
                          <div>
                            <span className="font-semibold text-gray-900 block truncate max-w-[130px]">
                              {item.supplier.supplier_name}
                            </span>
                            <span className="text-2xs text-gray-500 block">
                              MOQ: {item.minimum_order_quantity} {item.unit_abbr} ({item.lead_time_days}d lead)
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-500 font-medium text-2xs">No Vendor Mapped</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.recommended_order_quantity > 0 ? (
                          <span className="font-black text-red-600 text-sm">
                            {item.recommended_order_quantity} <span className="text-2xs font-normal">{item.unit_abbr}</span>
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">Sufficient</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        ₹{item.estimated_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {item.warnings && item.warnings.length > 0 ? (
                          <div className="space-y-0.5">
                            {item.warnings.map((w, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800"
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-2xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation & Summary Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Purchase Order Generation"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            You are converting <strong>{selectedItems.length} selected recommendations</strong> into DRAFT purchase orders.
            Orders will be grouped by approved vendor with calculated lead times.
          </p>

          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800">
            <strong>Important:</strong> Generated purchase orders will be created in <strong>DRAFT</strong> status.
            They will <em>not</em> be sent to vendors automatically until an authorized manager reviews and submits them.
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Vendor Grouping & Cost Summary</h4>
            <div className="space-y-3">
              {Object.values(groupedBySupplier).map((group, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-xs space-y-2">
                  <div className="flex justify-between items-center font-bold text-gray-900">
                    <span>Vendor: {group.supplier_name}</span>
                    <span className="text-primary-600">Estimated Total: ₹{group.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {group.items.map((it, itemIdx) => (
                      <div key={itemIdx} className="py-1 flex justify-between text-2xs text-gray-700">
                        <span>• {it.ingredient_name}</span>
                        <span>
                          {it.recommended_order_quantity} {it.unit_abbr} @ ₹{it.supplier?.contract_unit_cost || 0} = ₹{it.estimated_cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PO Batch Notes</label>
            <input
              type="text"
              value={conversionNotes}
              onChange={(e) => setConversionNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteConversion}
              disabled={converting}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {converting ? 'Generating POs...' : 'Create Draft Purchase Orders'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

