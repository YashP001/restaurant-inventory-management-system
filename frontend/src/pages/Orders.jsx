import React, { useState, useEffect } from 'react';
import { ordersApi, catalogApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Orders() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' or 'history'
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [menuSearch, setMenuSearch] = useState('');

  // Cart / New Order state
  const [cart, setCart] = useState([]); // [{ menu_item_id, item_name, price, quantity, special_instructions }]
  const [orderType, setOrderType] = useState('DINE_IN');
  const [tableId, setTableId] = useState('1');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Order history state
  const [orders, setOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'CASH',
    amount_paid: '',
    transaction_reference: ''
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchMenu();
    if (activeTab === 'history') {
      fetchOrderHistory();
    }
  }, [activeTab, historyStatusFilter]);

  const fetchMenu = async () => {
    try {
      const [menuRes, catRes] = await Promise.all([
        catalogApi.getMenuItems('?is_available=true&limit=100'),
        catalogApi.getCategories()
      ]);
      const raw = menuRes.data || [];
      setMenuItems(raw.map(item => ({
        ...item,
        menu_item_id: item.id || item.menu_item_id,
        item_name: item.name || item.item_name || '',
        price: Number(item.selling_price ?? item.price ?? 0)
      })));
      const rawCats = catRes.data || [];
      setCategories(rawCats.map(c => ({
        ...c,
        category_id: c.id || c.category_id,
        category_name: c.name || c.category_name
      })));
    } catch (err) {
      console.error('Failed to load menu items', err);
    }
  };

  const fetchOrderHistory = async () => {
    setHistoryLoading(true);
    try {
      const query = historyStatusFilter ? `?status=${historyStatusFilter}` : '';
      const res = await ordersApi.getOrders(query);
      const raw = res.data || [];
      setOrders(raw.map(o => ({ ...o, order_id: o.id || o.order_id })));
    } catch (err) {
      console.error('Failed to load order history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Cart handlers
  const handleAddToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.menu_item_id);
      if (existing) {
        return prev.map(i =>
          i.menu_item_id === item.menu_item_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, {
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        price: parseFloat(item.price || 0),
        quantity: 1,
        special_instructions: ''
      }];
    });
  };

  const handleUpdateCartQty = (menu_item_id, delta) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.menu_item_id === menu_item_id) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const handleCartInstruction = (menu_item_id, note) => {
    setCart(prev =>
      prev.map(i => i.menu_item_id === menu_item_id ? { ...i, special_instructions: note } : i)
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05; // 5% GST
  const grandTotal = subtotal + tax;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert('Cart is empty! Add menu items to place an order.');
      return;
    }
    setSubmittingOrder(true);
    try {
      const payload = {
        order_type: orderType,
        table_id: orderType === 'DINE_IN' ? parseInt(tableId) : undefined,
        notes: orderNotes || undefined,
        items: cart.map(i => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          special_instructions: i.special_instructions || undefined
        }))
      };

      const res = await ordersApi.createOrder(payload);
      alert(`Order #${res.data?.order_number || res.data?.order_id} created successfully in PENDING status!`);
      setCart([]);
      setOrderNotes('');
      // Open order details directly
      handleViewOrder(res.data);
    } catch (err) {
      alert(err.message || 'Failed to create order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleViewOrder = async (order) => {
    try {
      const res = await ordersApi.getOrderById(order.order_id || order.id);
      const raw = res.data;
      setSelectedOrder(raw ? { ...raw, order_id: raw.id || raw.order_id } : null);
      setIsDetailsOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to fetch order details');
    }
  };

  // Order Actions
  const handleConfirmOrder = async (orderId) => {
    try {
      await ordersApi.confirmOrder(orderId);
      alert('Order CONFIRMED! FEFO inventory stock has been deducted.');
      if (selectedOrder) {
        const res = await ordersApi.getOrderById(orderId);
        setSelectedOrder(res.data);
      }
      if (activeTab === 'history') fetchOrderHistory();
    } catch (err) {
      alert(err.message || 'Failed to confirm order');
    }
  };

  const handleOpenPayment = (order) => {
    const ord = order ? { ...order, order_id: order.id || order.order_id } : null;
    setSelectedOrder(ord);
    const remaining = Math.max(0, parseFloat(order.total_amount || 0) - parseFloat(order.total_paid || 0));
    setPaymentForm({
      payment_method: 'CASH',
      amount_paid: remaining.toFixed(2),
      transaction_reference: ''
    });
    setIsPaymentOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setSubmittingPayment(true);
    try {
      const orderId = selectedOrder.order_id || selectedOrder.id;
      await ordersApi.recordPayment(orderId, {
        payment_method: paymentForm.payment_method,
        amount_paid: parseFloat(paymentForm.amount_paid),
        transaction_reference: paymentForm.transaction_reference || undefined
      });
      alert('Payment recorded successfully!');
      setIsPaymentOpen(false);
      const res = await ordersApi.getOrderById(selectedOrder.order_id);
      setSelectedOrder(res.data);
      if (activeTab === 'history') fetchOrderHistory();
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchCat = selectedCategory === 'ALL' || item.category_id === parseInt(selectedCategory);
    const name = (item.item_name || item.name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const search = (menuSearch || '').toLowerCase();
    const matchSearch = name.includes(search) || desc.includes(search);
    return matchCat && matchSearch;
  });

  const filteredHistory = orders.filter(o => {
    const term = historySearch.toLowerCase();
    const num = (o.order_number || '').toLowerCase();
    const type = (o.order_type || '').toLowerCase();
    return num.includes(term) || type.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Orders & POS</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create dining & takeaway tickets, track payments, and review order bills
          </p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              activeTab === 'pos'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            New Order (POS)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              activeTab === 'history'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Order History
          </button>
        </div>
      </div>

      {activeTab === 'pos' ? (
        /* POS Layout: Menu on left, Cart & Bill on right */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Catalog Section */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search & Category Filter Pills */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
              <input
                type="text"
                placeholder="Search menu dishes..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedCategory === 'ALL'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                {categories.map(c => (
                  <button
                    key={c.category_id}
                    onClick={() => setSelectedCategory(c.category_id.toString())}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      selectedCategory === c.category_id.toString()
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {c.category_name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMenuItems.map(item => (
                <div
                  key={item.menu_item_id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between hover:border-primary-300 transition"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 text-sm">{item.item_name}</h3>
                      <span className="font-bold text-primary-600 text-sm">₹{parseFloat(item.price).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description || 'Delicious freshly prepared recipe'}</p>
                  </div>
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="mt-4 w-full py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium rounded-lg text-xs transition"
                  >
                    + Add to Ticket
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cart & Ticket Sidebar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="font-bold text-gray-900 text-base">Current Ticket</h2>
                <span className="text-xs text-gray-500">{cart.length} item{cart.length === 1 ? '' : 's'}</span>
              </div>

              {/* Order Settings */}
              <div className="grid grid-cols-2 gap-3 my-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Order Type</label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="DINE_IN">Dine In</option>
                    <option value="TAKEAWAY">Takeaway</option>
                    <option value="ONLINE">Online Delivery</option>
                  </select>
                </div>
                {orderType === 'DINE_IN' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Table #</label>
                    <select
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => (
                        <option key={t} value={t}>Table {t}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Table</label>
                    <div className="text-xs text-gray-400 py-1.5">N/A</div>
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 my-2">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    Cart is empty. Select items from the menu to build the ticket.
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.menu_item_id} className="py-2.5 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-900">{item.item_name}</span>
                        <span className="font-bold text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateCartQty(item.menu_item_id, -1)}
                            className="w-5 h-5 bg-gray-100 rounded text-center leading-none hover:bg-gray-200"
                          >
                            -
                          </button>
                          <span className="font-medium text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateCartQty(item.menu_item_id, 1)}
                            className="w-5 h-5 bg-gray-100 rounded text-center leading-none hover:bg-gray-200"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-2xs">@ ₹{item.price.toFixed(2)}</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Special instructions (e.g. less spicy)..."
                        value={item.special_instructions}
                        onChange={(e) => handleCartInstruction(item.menu_item_id, e.target.value)}
                        className="w-full text-2xs px-2 py-1 border border-gray-200 rounded mt-1"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Price Breakdown and Place Order Button */}
            <div className="border-t pt-4 space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Ticket notes (optional)..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded mb-2"
                />
              </div>

              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium text-gray-900">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span className="font-medium text-gray-900">₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t">
                  <span>Grand Total:</span>
                  <span className="text-primary-600">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={submittingOrder || cart.length === 0}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-sm shadow-sm transition disabled:opacity-50"
              >
                {submittingOrder ? 'Placing Order...' : 'Create Customer Ticket'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-80">
              <input
                type="text"
                placeholder="Search orders by number..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500">Status:</label>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">All Orders</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY_FOR_PICKUP">Ready For Pickup</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {historyLoading ? (
              <div className="p-8 text-center text-gray-500">Loading orders...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No orders found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Order #</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Table</th>
                      <th className="px-6 py-3">Total Amount</th>
                      <th className="px-6 py-3">Payment Status</th>
                      <th className="px-6 py-3">Order Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map(o => (
                      <tr key={o.order_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-semibold text-gray-900">{o.order_number}</td>
                        <td className="px-6 py-4 text-xs font-medium">{o.order_type}</td>
                        <td className="px-6 py-4 text-xs">{o.table_id ? `Table ${o.table_id}` : '—'}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900">₹{parseFloat(o.total_amount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <Badge
                            status={parseFloat(o.total_paid || 0) >= parseFloat(o.total_amount || 0) ? 'PAID' : 'PENDING'}
                            type="general"
                            label={parseFloat(o.total_paid || 0) >= parseFloat(o.total_amount || 0) ? 'PAID' : `DUE: ₹${(parseFloat(o.total_amount || 0) - parseFloat(o.total_paid || 0)).toFixed(2)}`}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={o.status} type="order" />
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleViewOrder(o)}
                            className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1 rounded font-medium"
                          >
                            Details
                          </button>
                          {parseFloat(o.total_paid || 0) < parseFloat(o.total_amount || 0) && o.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleOpenPayment(o)}
                              className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1 rounded font-medium"
                            >
                              Pay
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
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title={`Order Ticket: ${selectedOrder.order_number}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
              <div>
                <span className="text-gray-500 block">Type</span>
                <span className="font-bold text-gray-900">{selectedOrder.order_type}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Table</span>
                <span className="font-bold text-gray-900">{selectedOrder.table_id ? `Table ${selectedOrder.table_id}` : 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Status</span>
                <div className="mt-0.5"><Badge status={selectedOrder.status} type="order" /></div>
              </div>
              <div>
                <span className="text-gray-500 block">Time</span>
                <span className="font-bold text-gray-900">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleTimeString() : '—'}</span>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="bg-yellow-50 p-2.5 rounded text-xs text-yellow-800 border border-yellow-200">
                <strong>Notes:</strong> {selectedOrder.notes}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Items Ordered</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2">Dish</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-gray-900">{it.item_name}</span>
                          {it.special_instructions && (
                            <div className="text-2xs text-gray-400 italic">{it.special_instructions}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold">{it.quantity}</td>
                        <td className="px-3 py-2">₹{parseFloat(it.unit_price || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold text-gray-900">
                          ₹{(parseFloat(it.quantity) * parseFloat(it.unit_price || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold text-gray-900">
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-right">Subtotal:</td>
                      <td className="px-3 py-2">₹{parseFloat(selectedOrder.subtotal || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-right">Tax (5%):</td>
                      <td className="px-3 py-2">₹{parseFloat(selectedOrder.tax_amount || 0).toFixed(2)}</td>
                    </tr>
                    <tr className="text-primary-600">
                      <td colSpan="3" className="px-3 py-2 text-right">Total Amount:</td>
                      <td className="px-3 py-2 font-black">₹{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payments list if any */}
            {selectedOrder.payments && selectedOrder.payments.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Recorded Payments</h4>
                <div className="space-y-1">
                  {selectedOrder.payments.map((p, idx) => (
                    <div key={idx} className="bg-green-50 text-green-900 p-2 rounded text-xs flex justify-between">
                      <span>Method: <strong>{p.payment_method}</strong> ({p.transaction_reference || 'Ref: Cash'})</span>
                      <span className="font-bold">₹{parseFloat(p.amount_paid).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              {selectedOrder.status === 'PENDING' && (
                <button
                  onClick={() => handleConfirmOrder(selectedOrder.order_id)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold"
                >
                  Confirm & Deduct Stock (FEFO)
                </button>
              )}
              {parseFloat(selectedOrder.total_paid || 0) < parseFloat(selectedOrder.total_amount || 0) && selectedOrder.status !== 'CANCELLED' && (
                <button
                  onClick={() => { setIsDetailsOpen(false); handleOpenPayment(selectedOrder); }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                >
                  Record Payment
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

      {/* Payment Recording Modal */}
      {selectedOrder && (
        <Modal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          title={`Record Payment for Order ${selectedOrder.order_number}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-900 flex justify-between">
              <span>Total Bill: <strong>₹{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</strong></span>
              <span>Paid: <strong>₹{parseFloat(selectedOrder.total_paid || 0).toFixed(2)}</strong></span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method *</label>
              <select
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="ONLINE">Online Portal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount Paid (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentForm.amount_paid}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Transaction Reference (Optional)</label>
              <input
                type="text"
                placeholder="UPI UTR #, Card Auth Code, etc."
                value={paymentForm.transaction_reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {submittingPayment ? 'Recording...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

