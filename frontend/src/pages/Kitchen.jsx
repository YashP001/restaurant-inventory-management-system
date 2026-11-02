import React, { useState, useEffect } from 'react';
import { ordersApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Cancel order modal with waste option
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelForm, setCancelForm] = useState({
    record_waste: false,
    waste_reason: 'CUSTOMER_RETURN',
    notes: ''
  });

  useEffect(() => {
    fetchActiveOrders();
    const timer = setInterval(fetchActiveOrders, 15000); // 15s poll for live kitchen updates
    return () => clearInterval(timer);
  }, []);

  const fetchActiveOrders = async () => {
    try {
      const res = await ordersApi.getOrders('?limit=50');
      // Filter out COMPLETED and CANCELLED unless recent
      setOrders(res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load kitchen queue', err);
      setError(err.message || 'Failed to load kitchen queue');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await ordersApi.confirmOrder(orderId);
      await fetchActiveOrders();
    } catch (err) {
      alert(err.message || 'Failed to confirm order');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkReady = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await ordersApi.markOrderReady(orderId);
      await fetchActiveOrders();
    } catch (err) {
      alert(err.message || 'Failed to advance order to ready');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeliver = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await ordersApi.deliverOrder(orderId);
      await fetchActiveOrders();
    } catch (err) {
      alert(err.message || 'Failed to deliver order');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleComplete = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await ordersApi.completeOrder(orderId);
      await fetchActiveOrders();
    } catch (err) {
      alert(err.message || 'Failed to complete order');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openCancelModal = (order) => {
    setCancellingOrder(order);
    setCancelForm({
      record_waste: order.status === 'PREPARING' || order.status === 'READY_FOR_PICKUP',
      waste_reason: 'CUSTOMER_RETURN',
      notes: ''
    });
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    setActionLoadingId(cancellingOrder.order_id);
    try {
      await ordersApi.cancelOrder(cancellingOrder.order_id, cancelForm);
      alert('Order cancelled successfully.');
      setCancelModalOpen(false);
      setCancellingOrder(null);
      await fetchActiveOrders();
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Group orders by workflow stages
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const preparingOrders = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY_FOR_PICKUP');
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kitchen Fulfilment Queue (KDS)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time kitchen order display: Confirm tickets, advance cooking status, and dispatch
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Auto-syncing
          </span>
          <button
            onClick={fetchActiveOrders}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          Loading kitchen tickets...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
          <p className="font-semibold">Error Loading Queue</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        /* 4-Column Kitchen Board */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Column 1: PENDING */}
          <div className="bg-gray-100 rounded-xl p-4 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
              <span className="font-bold text-sm text-gray-700">1. Pending Confirmation</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-200 text-yellow-800">
                {pendingOrders.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {pendingOrders.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8">No pending tickets</div>
              ) : (
                pendingOrders.map(o => (
                  <KitchenCard
                    key={o.order_id}
                    order={o}
                    isProcessing={actionLoadingId === o.order_id}
                    onConfirm={() => handleConfirm(o.order_id)}
                    onCancel={() => openCancelModal(o)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: PREPARING */}
          <div className="bg-blue-50/50 rounded-xl p-4 flex flex-col min-h-[500px] border border-blue-100">
            <div className="flex items-center justify-between mb-3 border-b border-blue-200 pb-2">
              <span className="font-bold text-sm text-blue-900">2. Kitchen Cooking</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-200 text-blue-800">
                {preparingOrders.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {preparingOrders.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8">No orders in preparation</div>
              ) : (
                preparingOrders.map(o => (
                  <KitchenCard
                    key={o.order_id}
                    order={o}
                    isProcessing={actionLoadingId === o.order_id}
                    onReady={() => handleMarkReady(o.order_id)}
                    onCancel={() => openCancelModal(o)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: READY FOR PICKUP */}
          <div className="bg-emerald-50/50 rounded-xl p-4 flex flex-col min-h-[500px] border border-emerald-100">
            <div className="flex items-center justify-between mb-3 border-b border-emerald-200 pb-2">
              <span className="font-bold text-sm text-emerald-900">3. Ready for Service</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-200 text-emerald-800">
                {readyOrders.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {readyOrders.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8">No orders ready</div>
              ) : (
                readyOrders.map(o => (
                  <KitchenCard
                    key={o.order_id}
                    order={o}
                    isProcessing={actionLoadingId === o.order_id}
                    onDeliver={() => handleDeliver(o.order_id)}
                    onComplete={() => handleComplete(o.order_id)}
                    onCancel={() => openCancelModal(o)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 4: OUT FOR DELIVERY / RECENT */}
          <div className="bg-purple-50/40 rounded-xl p-4 flex flex-col min-h-[500px] border border-purple-100">
            <div className="flex items-center justify-between mb-3 border-b border-purple-200 pb-2">
              <span className="font-bold text-sm text-purple-900">4. Out for Delivery</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-200 text-purple-800">
                {deliveredOrders.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {deliveredOrders.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8">No active delivery tickets</div>
              ) : (
                deliveredOrders.map(o => (
                  <KitchenCard
                    key={o.order_id}
                    order={o}
                    isProcessing={actionLoadingId === o.order_id}
                    onComplete={() => handleComplete(o.order_id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order & Record Waste Modal */}
      {cancellingOrder && (
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title={`Cancel Order Ticket: ${cancellingOrder.order_number}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCancelSubmit} className="space-y-4">
            <p className="text-xs text-gray-600">
              Are you sure you want to cancel ticket <strong>{cancellingOrder.order_number}</strong>?
            </p>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelForm.record_waste}
                  onChange={(e) => setCancelForm({ ...cancelForm, record_waste: e.target.checked })}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span className="text-xs font-bold text-red-800">
                  Record prepared food ingredients as WASTE
                </span>
              </label>

              {cancelForm.record_waste && (
                <div>
                  <label className="block text-2xs font-semibold text-red-900 uppercase mb-1">
                    Waste Reason
                  </label>
                  <select
                    value={cancelForm.waste_reason}
                    onChange={(e) => setCancelForm({ ...cancelForm, waste_reason: e.target.value })}
                    className="w-full px-2 py-1.5 border border-red-300 rounded text-xs bg-white"
                  >
                    <option value="CUSTOMER_RETURN">Customer Return / Cancelled</option>
                    <option value="PREPARATION_SCRAP">Preparation Scrap</option>
                    <option value="OVERCOOKED">Overcooked / Burned</option>
                    <option value="SPOILED">Spoiled / Cold</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cancellation Notes</label>
              <input
                type="text"
                placeholder="Reason for ticket cancellation..."
                value={cancelForm.notes}
                onChange={(e) => setCancelForm({ ...cancelForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
              >
                Confirm Cancellation
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Subcomponent: Kitchen Ticket Card
function KitchenCard({ order, isProcessing, onConfirm, onReady, onDeliver, onComplete, onCancel }) {
  const elapsedMinutes = Math.floor((new Date() - new Date(order.created_at || Date.now())) / 60000);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="font-bold text-sm text-gray-900 block">{order.order_number}</span>
          <span className="text-2xs font-semibold text-primary-600 uppercase">
            {order.order_type} {order.table_id ? `• Table ${order.table_id}` : ''}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-2xs font-mono px-1.5 py-0.5 rounded ${
            elapsedMinutes > 20 ? 'bg-red-100 text-red-700 font-bold' : 'bg-gray-100 text-gray-600'
          }`}>
            {elapsedMinutes}m ago
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-1.5 text-xs">
        {(order.items || []).map((it, idx) => (
          <div key={idx} className="flex justify-between items-start">
            <div>
              <span className="font-bold text-gray-900 mr-1.5">{it.quantity}x</span>
              <span className="text-gray-800">{it.item_name}</span>
              {it.special_instructions && (
                <p className="text-2xs text-red-500 font-medium italic mt-0.5">⚠️ {it.special_instructions}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="bg-yellow-50 p-1.5 rounded text-2xs text-yellow-800 border border-yellow-200">
          <strong>Note:</strong> {order.notes}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="text-2xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
          >
            Cancel
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs font-bold transition disabled:opacity-50"
            >
              {isProcessing ? 'Confirming...' : 'Confirm (FEFO)'}
            </button>
          )}

          {onReady && (
            <button
              onClick={onReady}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-bold transition disabled:opacity-50"
            >
              {isProcessing ? 'Updating...' : 'Mark Ready'}
            </button>
          )}

          {order.order_type === 'ONLINE' && onDeliver && (
            <button
              onClick={onDeliver}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition disabled:opacity-50"
            >
              {isProcessing ? 'Dispatching...' : 'Dispatch'}
            </button>
          )}

          {onComplete && (
            <button
              onClick={onComplete}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition disabled:opacity-50"
            >
              {isProcessing ? 'Completing...' : 'Complete Ticket'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

