import React, { useState, useEffect } from 'react';
import { staffApi } from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const ROLE_OPTIONS = [
  { id: 1, name: 'ADMIN', label: 'Admin (Full Access)' },
  { id: 2, name: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
  { id: 3, name: 'CHEF', label: 'Head / Line Chef' },
  { id: 4, name: 'CASHIER', label: 'Cashier / POS Staff' }
];

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Create Staff Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    role_id: 4,
    password: ''
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Staff Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role_id: 4
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await staffApi.getStaff();
      setStaffList(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch staff directory');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await staffApi.createStaff({
        full_name: createForm.full_name,
        username: createForm.username,
        email: createForm.email,
        phone: createForm.phone || undefined,
        role_id: parseInt(createForm.role_id),
        password: createForm.password
      });
      alert('Staff member created successfully!');
      setIsCreateOpen(false);
      setCreateForm({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        role_id: 4,
        password: ''
      });
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to create staff member');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEdit = (user) => {
    setSelectedStaff(user);
    const roleMatch = ROLE_OPTIONS.find(r => r.name === user.role_name);
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || '',
      role_id: roleMatch ? roleMatch.id : 4
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setEditLoading(true);
    try {
      await staffApi.updateStaff(selectedStaff.id || selectedStaff.user_id, {
        full_name: editForm.full_name,
        phone: editForm.phone || undefined,
        role_id: parseInt(editForm.role_id)
      });
      alert('Staff member profile updated.');
      setIsEditOpen(false);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to update staff member');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = !user.is_active;
    const action = newStatus ? 'ACTIVATE' : 'DEACTIVATE';
    if (!window.confirm(`Are you sure you want to ${action} account for ${user.full_name}?`)) return;

    try {
      await staffApi.updateStaffStatus(user.id || user.user_id, newStatus);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const filtered = staffList.filter(u => {
    const term = search.toLowerCase();
    const name = (u.full_name || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const role = (u.role_name || '').toLowerCase();
    return name.includes(term) || username.includes(term) || email.includes(term) || role.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            System administration: Role-based access control (RBAC), credentials & active directory
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> Add Staff Member
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search staff by name, username, email or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading staff records...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No staff members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Full Name</th>
                  <th className="px-6 py-3">Username</th>
                  <th className="px-6 py-3">Email & Phone</th>
                  <th className="px-6 py-3">Assigned Role</th>
                  <th className="px-6 py-3">Account Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <tr key={u.id || u.user_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {u.full_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      @{u.username}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="text-gray-900">{u.email}</div>
                      <div className="text-gray-400">{u.phone || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role_name === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                        u.role_name === 'INVENTORY_MANAGER' ? 'bg-blue-100 text-blue-800' :
                        u.role_name === 'CHEF' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {u.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        status={u.is_active ? 'ACTIVE' : 'INACTIVE'}
                        type="general"
                        label={u.is_active ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1 rounded font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`text-xs px-2.5 py-1 rounded font-medium ${
                          u.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Staff Member"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={createForm.full_name}
              onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Username *</label>
            <input
              type="text"
              required
              placeholder="e.g. rahul_s"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="rahul@urbanbites.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={createForm.role_id}
              onChange={(e) => setCreateForm({ ...createForm, role_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Initial Password *</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Min 8 characters"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
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
              {createLoading ? 'Creating...' : 'Save Staff Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      {selectedStaff && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Staff Profile: @${selectedStaff.username}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role Assignment *</label>
              <select
                value={editForm.role_id}
                onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Update Staff Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

