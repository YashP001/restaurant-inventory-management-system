import React, { useState, useEffect } from 'react';
import { supplierApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierDetails, setSupplierDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierApi.getSuppliers();
      setSuppliers(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSupplier = async (supplier) => {
    setSelectedSupplier(supplier);
    setDetailsLoading(true);
    try {
      const res = await supplierApi.getSupplierById(supplier.supplier_id);
      setSupplierDetails(res.data);
    } catch (err) {
      alert(err.message || 'Failed to load supplier details');
      setSelectedSupplier(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filtered = suppliers.filter(s =>
    s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name && s.contact_name.toLowerCase().includes(search.toLowerCase())) ||
    (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Suppliers & Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage approved vendor relationships, lead times, and ingredient contract pricing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSuppliers}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search suppliers by name, contact, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading suppliers...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchSuppliers}
              className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No suppliers found matching your query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Supplier Name</th>
                  <th className="px-6 py-3">Contact Person</th>
                  <th className="px-6 py-3">Phone & Email</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Lead Time</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => (
                  <tr key={s.supplier_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {s.supplier_name}
                    </td>
                    <td className="px-6 py-4">{s.contact_name || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-900">{s.phone || '—'}</div>
                      <div className="text-xs text-gray-500">{s.email || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">{s.city ? `${s.city}, ${s.state || ''}` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{s.lead_time_days || 1}</span> days
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        status={s.is_active ? 'ACTIVE' : 'INACTIVE'}
                        type="general"
                        label={s.is_active ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewSupplier(s)}
                        className="text-primary-600 hover:text-primary-800 font-medium text-xs bg-primary-50 px-3 py-1.5 rounded-md hover:bg-primary-100 transition"
                      >
                        View Catalog
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Catalog Modal */}
      {selectedSupplier && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedSupplier(null); setSupplierDetails(null); }}
          title={`${selectedSupplier.supplier_name} — Details & Catalog`}
          maxWidth="max-w-3xl"
        >
          {detailsLoading ? (
            <div className="p-8 text-center text-gray-500">Loading catalog items...</div>
          ) : supplierDetails ? (
            <div className="space-y-6">
              {/* Profile summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Contact</span>
                  <span className="font-medium text-gray-900">{supplierDetails.contact_name || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Phone</span>
                  <span className="font-medium text-gray-900">{supplierDetails.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Email</span>
                  <span className="font-medium text-gray-900 truncate block">{supplierDetails.email || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Lead Time</span>
                  <span className="font-medium text-gray-900">{supplierDetails.lead_time_days} days</span>
                </div>
              </div>

              {/* Ingredients supplied */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Contracted Ingredients & Pricing</h3>
                {(!supplierDetails.ingredients || supplierDetails.ingredients.length === 0) ? (
                  <p className="text-sm text-gray-500 italic">No specific ingredients mapped to this supplier.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5">Ingredient Name</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Unit</th>
                          <th className="px-4 py-2.5">Contract Cost</th>
                          <th className="px-4 py-2.5">Min Order Qty (MOQ)</th>
                          <th className="px-4 py-2.5">Preferred</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {supplierDetails.ingredients.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{item.ingredient_name}</td>
                            <td className="px-4 py-2.5">{item.category_name || '—'}</td>
                            <td className="px-4 py-2.5">{item.unit_abbreviation || item.unit_name || 'units'}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">₹{parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                            <td className="px-4 py-2.5">{item.minimum_order_quantity || 1}</td>
                            <td className="px-4 py-2.5">
                              {item.is_preferred ? (
                                <span className="text-green-600 font-semibold">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
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
          ) : null}
        </Modal>
      )}
    </div>
  );
}

