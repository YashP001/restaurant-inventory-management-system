import React, { useState, useEffect } from 'react';
import { supplierApi, catalogApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [selectedPO, setSelectedPO] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  // Data for creation modal
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [createForm, setCreateForm] = useState({
    supplier_id: '',
    expected_delivery_date: '',
    notes: '',
    items: []
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Data for receiving modal
  const [receiveForm, setReceiveForm] = useState({
    purchase_order_id: '',
    supplier_id: '',
    invoice_number: '',
    received_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: []
  });
  const [receiveLoading, setReceiveLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchSuppliersAndIngredients();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const res = await supplierApi.getPurchaseOrders(query);
      const list = res.data || [];
      const normalized = list.map(po => ({
        ...po,
        purchase_order_id: po.purchase_order_id || po.id,
        supplier_name: po.supplier_name || po.supplier?.name || '—'
      }));
      setOrders(normalized);
    } catch (err) {
      setError(err.message || 'Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliersAndIngredients = async () => {
    try {
      const [supRes, ingRes] = await Promise.all([
        supplierApi.getSuppliers(),
        catalogApi.getIngredients('?limit=100')
      ]);
      setSuppliers(supRes.data || []);
      setIngredients(ingRes.data || []);
    } catch (err) {
      console.error('Failed to load suppliers/ingredients for modal', err);
    }
  };

  const handleViewPO = async (po) => {
    try {
      const id = po.purchase_order_id || po.id;
      const res = await supplierApi.getPurchaseOrderById(id);
      setSelectedPO({
        ...res.data,
        purchase_order_id: res.data.purchase_order_id || res.data.id
      });
      setIsDetailsOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to fetch PO details');
    }
  };

  const handleSubmitPO = async (poId) => {
    if (!window.confirm('Are you sure you want to SUBMIT this purchase order to the vendor?')) return;
    try {
      await supplierApi.submitPurchaseOrder(poId);
      alert('Purchase order submitted successfully!');
      fetchOrders();
      if (selectedPO) {
        const res = await supplierApi.getPurchaseOrderById(poId);
        setSelectedPO(res.data);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit PO');
    }
  };

  const handleCancelPO = async (poId) => {
    if (!window.confirm('Are you sure you want to CANCEL this purchase order?')) return;
    try {
      await supplierApi.cancelPurchaseOrder(poId);
      alert('Purchase order cancelled');
      fetchOrders();
      if (selectedPO) {
        setIsDetailsOpen(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel PO');
    }
  };

  // Open Receive Inward Stock modal prefilled with PO items
  const handleOpenReceive = async (po) => {
    try {
      const id = po.purchase_order_id || po.id;
      const res = await supplierApi.getPurchaseOrderById(id);
      const poData = {
        ...res.data,
        purchase_order_id: res.data.purchase_order_id || res.data.id
      };
      setSelectedPO(poData);

      // Pre-fill items with remaining unreceived quantities
      const itemsToReceive = (poData.items || []).map(item => {
        const remaining = Math.max(0, parseFloat(item.quantity_ordered) - parseFloat(item.quantity_received || 0));
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 14); // 14 days default
        return {
          purchase_order_item_id: item.po_item_id || item.item_id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity_ordered: item.quantity_ordered,
          quantity_received_so_far: item.quantity_received || 0,
          quantity_received: remaining,
          unit_cost: item.unit_cost,
          batch_number: `BATCH-${Date.now().toString().slice(-6)}`,
          expiry_date: defaultExpiry.toISOString().split('T')[0]
        };
      });

      setReceiveForm({
        purchase_order_id: poData.purchase_order_id,
        supplier_id: poData.supplier_id,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        received_date: new Date().toISOString().split('T')[0],
        notes: '',
        items: itemsToReceive
      });
      setIsReceiveOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to initialize receiving modal');
    }
  };

  // Submit Receive Form
  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    setReceiveLoading(true);
    try {
      // Filter out items with 0 quantity
      const validItems = receiveForm.items.filter(it => parseFloat(it.quantity_received) > 0);
      if (validItems.length === 0) {
        alert('Please specify quantity received for at least one item');
        setReceiveLoading(false);
        return;
      }

      // Pre-validation: ensure expiry dates are on or after receipt date
      for (const it of validItems) {
        if (it.expiry_date < receiveForm.received_date) {
          alert(`Expiry date (${it.expiry_date}) for ${it.ingredient_name} cannot be earlier than receipt date (${receiveForm.received_date})`);
          setReceiveLoading(false);
          return;
        }
      }

      const payload = {
        purchase_order_id: Number(receiveForm.purchase_order_id),
        supplier_id: Number(receiveForm.supplier_id),
        received_date: receiveForm.received_date,
        notes: receiveForm.notes || undefined,
        items: validItems.map(it => ({
          purchase_order_item_id: it.purchase_order_item_id ? Number(it.purchase_order_item_id) : undefined,
          ingredient_id: Number(it.ingredient_id),
          quantity_received: parseFloat(it.quantity_received),
          unit_cost: it.unit_cost !== undefined && it.unit_cost !== '' ? parseFloat(it.unit_cost) : undefined,
          batch_number: it.batch_number.trim(),
          expiry_date: it.expiry_date
        }))
      };

      await supplierApi.receivePOItems(payload);
      alert('Stock successfully received and added to inventory batches!');
      setIsReceiveOpen(false);
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to receive stock');
    } finally {
      setReceiveLoading(false);
    }
  };

  // Creation logic
  const handleAddItemToCreate = () => {
    setCreateForm(prev => ({
      ...prev,
      items: [...prev.items, { ingredient_id: '', quantity_ordered: '', unit_cost: '' }]
    }));
  };

  const handleRemoveItemFromCreate = (idx) => {
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.items.length === 0) {
      alert('Please add at least one line item to the purchase order');
      return;
    }
    setCreateLoading(true);
    try {
      const payload = {
        supplier_id: parseInt(createForm.supplier_id),
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: createForm.expected_delivery_date,
        notes: createForm.notes || undefined,
        items: createForm.items.map(it => ({
          ingredient_id: parseInt(it.ingredient_id),
          quantity_ordered: parseFloat(it.quantity_ordered),
          unit_cost: it.unit_cost ? parseFloat(it.unit_cost) : undefined
        }))
      };

      await supplierApi.createPurchaseOrder(payload);
      alert('Draft Purchase Order created successfully!');
      setIsCreateOpen(false);
      setCreateForm({ supplier_id: '', expected_delivery_date: '', notes: '', items: [] });
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to create purchase order');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredOrders = orders.filter(po => {
    const term = search.toLowerCase();
    const poNum = (po.po_number || '').toLowerCase();
    const supName = (po.supplier_name || '').toLowerCase();
    return poNum.includes(term) || supName.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Procurement lifecycle: Drafts, Vendor Submissions, Receipts & Closures
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> Create Draft PO
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by PO# or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Received (Closed)</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading purchase orders...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No purchase orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">PO Number</th>
                  <th className="px-6 py-3">Supplier</th>
                  <th className="px-6 py-3">Order Date</th>
                  <th className="px-6 py-3">Expected Date</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((po) => (
                  <tr key={po.purchase_order_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {po.po_number}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {po.supplier_name}
                    </td>
                    <td className="px-6 py-4 text-xs">{po.order_date ? po.order_date.split('T')[0] : '—'}</td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-900">
                      {po.expected_delivery_date ? po.expected_delivery_date.split('T')[0] : '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      ₹{parseFloat(po.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={po.status} type="po" />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewPO(po)}
                        className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1 rounded font-medium transition"
                      >
                        View
                      </button>

                      {po.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => handleSubmitPO(po.purchase_order_id)}
                            className="text-xs bg-primary-50 text-primary-600 hover:bg-primary-100 px-2.5 py-1 rounded font-medium transition"
                          >
                            Submit
                          </button>
                          <button
                            onClick={() => handleCancelPO(po.purchase_order_id)}
                            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded font-medium transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {(po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button
                          onClick={() => handleOpenReceive(po)}
                          className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1 rounded font-medium transition"
                        >
                          Receive Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PO Details Modal */}
      {selectedPO && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={`Purchase Order: ${selectedPO.po_number}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg text-sm">
              <div>
                <span className="text-xs text-gray-500 block">Supplier</span>
                <span className="font-semibold text-gray-900">{selectedPO.supplier_name}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Status</span>
                <div className="mt-1"><Badge status={selectedPO.status} type="po" /></div>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Order Date</span>
                <span className="font-medium text-gray-900">{selectedPO.order_date ? selectedPO.order_date.split('T')[0] : '—'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Expected Delivery</span>
                <span className="font-medium text-gray-900">{selectedPO.expected_delivery_date ? selectedPO.expected_delivery_date.split('T')[0] : '—'}</span>
              </div>
            </div>

            {selectedPO.notes && (
              <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200">
                <strong>Notes:</strong> {selectedPO.notes}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Line Items</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5">Ingredient</th>
                      <th className="px-4 py-2.5">Qty Ordered</th>
                      <th className="px-4 py-2.5">Qty Received</th>
                      <th className="px-4 py-2.5">Unit Cost</th>
                      <th className="px-4 py-2.5">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(selectedPO.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{item.ingredient_name}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800">{item.quantity_ordered}</td>
                        <td className="px-4 py-2.5">
                          <span className={item.quantity_received >= item.quantity_ordered ? 'text-green-600 font-medium' : 'text-gray-700'}>
                            {item.quantity_received || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">₹{parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">
                          ₹{(parseFloat(item.quantity_ordered) * parseFloat(item.unit_cost || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold text-gray-900">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-right">Total PO Value:</td>
                      <td className="px-4 py-3 text-primary-600 font-bold">
                        ₹{parseFloat(selectedPO.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedPO.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => handleSubmitPO(selectedPO.purchase_order_id)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Submit Purchase Order
                  </button>
                  <button
                    onClick={() => handleCancelPO(selectedPO.purchase_order_id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Cancel Order
                  </button>
                </>
              )}
              {(selectedPO.status === 'SUBMITTED' || selectedPO.status === 'PARTIALLY_RECEIVED') && (
                <button
                  onClick={() => { setIsDetailsOpen(false); handleOpenReceive(selectedPO); }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold"
                >
                  Receive Inward Stock
                </button>
              )}
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Draft PO Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Draft Purchase Order"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Select Supplier *</label>
              <select
                required
                value={createForm.supplier_id}
                onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">-- Choose a Vendor --</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name} (Lead time: {s.lead_time_days} days)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expected Delivery Date *</label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={createForm.expected_delivery_date}
                onChange={(e) => setCreateForm({ ...createForm, expected_delivery_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Instructions (Optional)</label>
            <input
              type="text"
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              placeholder="e.g. Deliver to rear kitchen bay before 11 AM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Line items section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-900 uppercase">PO Line Items</label>
              <button
                type="button"
                onClick={handleAddItemToCreate}
                className="text-xs bg-primary-50 text-primary-600 px-3 py-1 rounded font-medium hover:bg-primary-100"
              >
                + Add Ingredient
              </button>
            </div>

            {createForm.items.length === 0 ? (
              <p className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded border border-dashed border-gray-200">
                No items added yet. Click "+ Add Ingredient" to specify materials and quantities.
              </p>
            ) : (
              <div className="space-y-2">
                {createForm.items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded border border-gray-200 text-xs">
                    <div className="flex-1">
                      <select
                        required
                        value={it.ingredient_id}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...createForm.items];
                          updated[idx].ingredient_id = val;
                          setCreateForm({ ...createForm, items: updated });
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs"
                      >
                        <option value="">Select ingredient</option>
                        {ingredients.map(ing => (
                          <option key={ing.ingredient_id} value={ing.ingredient_id}>
                            {ing.ingredient_name} ({ing.unit_abbreviation})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="Quantity"
                        value={it.quantity_ordered}
                        onChange={(e) => {
                          const updated = [...createForm.items];
                          updated[idx].quantity_ordered = e.target.value;
                          setCreateForm({ ...createForm, items: updated });
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Unit Cost (₹)"
                        value={it.unit_cost}
                        onChange={(e) => {
                          const updated = [...createForm.items];
                          updated[idx].unit_cost = e.target.value;
                          setCreateForm({ ...createForm, items: updated });
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItemFromCreate(idx)}
                      className="text-red-500 hover:text-red-700 px-2 py-1 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {createLoading ? 'Saving...' : 'Save as Draft PO'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Stock Modal */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title={`Receive Inward Stock: PO #${selectedPO?.po_number || ''}`}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleReceiveSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg text-xs">
            <div>
              <label className="block text-gray-600 font-medium mb-1">Vendor Invoice # *</label>
              <input
                type="text"
                required
                value={receiveForm.invoice_number}
                onChange={(e) => setReceiveForm({ ...receiveForm, invoice_number: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Receipt Date *</label>
              <input
                type="date"
                required
                value={receiveForm.received_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, received_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Receipt Notes</label>
              <input
                type="text"
                placeholder="Optional delivery comments"
                value={receiveForm.notes}
                onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded bg-white"
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Item Delivery Inspection & Batches</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2">Ingredient</th>
                    <th className="px-3 py-2">Ordered</th>
                    <th className="px-3 py-2">Received So Far</th>
                    <th className="px-3 py-2">Receiving Now *</th>
                    <th className="px-3 py-2">Cost/Unit *</th>
                    <th className="px-3 py-2">Batch # *</th>
                    <th className="px-3 py-2">Expiry Date *</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receiveForm.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{it.ingredient_name}</td>
                      <td className="px-3 py-2">{it.quantity_ordered}</td>
                      <td className="px-3 py-2 text-gray-500">{it.quantity_received_so_far}</td>
                      <td className="px-3 py-2 w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={it.quantity_received}
                          onChange={(e) => {
                            const updated = [...receiveForm.items];
                            updated[idx].quantity_received = e.target.value;
                            setReceiveForm({ ...receiveForm, items: updated });
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={it.unit_cost}
                          onChange={(e) => {
                            const updated = [...receiveForm.items];
                            updated[idx].unit_cost = e.target.value;
                            setReceiveForm({ ...receiveForm, items: updated });
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 w-32">
                        <input
                          type="text"
                          required
                          value={it.batch_number}
                          onChange={(e) => {
                            const updated = [...receiveForm.items];
                            updated[idx].batch_number = e.target.value;
                            setReceiveForm({ ...receiveForm, items: updated });
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 w-36">
                        <input
                          type="date"
                          required
                          value={it.expiry_date}
                          onChange={(e) => {
                            const updated = [...receiveForm.items];
                            updated[idx].expiry_date = e.target.value;
                            setReceiveForm({ ...receiveForm, items: updated });
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsReceiveOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiveLoading}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {receiveLoading ? 'Receiving...' : 'Confirm Stock Receipt (FEFO Batch Inward)'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

