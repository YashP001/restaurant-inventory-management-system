import React, { useState, useEffect } from 'react';
import { catalogApi } from '../services/api';
import { Badge } from '../components/Badge';
import { 
  UtensilsCrossed, 
  Layers, 
  Ruler, 
  Tag, 
  Search, 
  Check, 
  X,
  Edit2
} from 'lucide-react';

export function Catalog() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'ingredients' | 'categories' | 'units'
  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [menuRes, ingRes, catRes, unitRes] = await Promise.allSettled([
        catalogApi.getMenuItems(),
        catalogApi.getIngredients(),
        catalogApi.getCategories(),
        catalogApi.getUnits()
      ]);

      if (menuRes.status === 'fulfilled' && menuRes.value?.success) {
        setMenuItems(menuRes.value.data?.menu_items || []);
      }
      if (ingRes.status === 'fulfilled' && ingRes.value?.success) {
        setIngredients(ingRes.value.data?.ingredients || []);
      }
      if (catRes.status === 'fulfilled' && catRes.value?.success) {
        setCategories(catRes.value.data?.categories || []);
      }
      if (unitRes.status === 'fulfilled' && unitRes.value?.success) {
        setUnits(unitRes.value.data?.units || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleAvailability = async (item) => {
    try {
      await catalogApi.updateMenuItem(item.id, {
        is_available: !item.is_available
      });
      setMenuItems(menuItems.map(m => m.id === item.id ? { ...m, is_available: !m.is_available } : m));
    } catch (err) {
      alert(`Failed to update item availability: ${err.message}`);
    }
  };

  const filteredMenuItems = menuItems.filter(m => 
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredIngredients = ingredients.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Master Catalog & Menu Management</h1>
        <p className="text-xs sm:text-sm text-slate-500">Menu items, ingredient master records, categories, and units of measurement</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('menu')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'menu' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Menu Items ({menuItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ingredients')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'ingredients' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Raw Ingredients ({ingredients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'categories' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Categories ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('units')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'units' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Ruler className="w-4 h-4" />
          <span>Units of Measure ({units.length})</span>
        </button>
      </div>

      {/* TAB 1: MENU ITEMS */}
      {activeTab === 'menu' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Menu Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Selling Price</th>
                  <th className="px-4 py-3">Prep Time</th>
                  <th className="px-4 py-3">Recipe Status</th>
                  <th className="px-6 py-3 text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMenuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.description || 'No description'}</p>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">{item.category_name}</td>
                    <td className="px-4 py-3.5 font-black text-slate-900">₹{Number(item.selling_price).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-slate-600">{item.preparation_time_mins} mins</td>
                    <td className="px-4 py-3.5">
                      {item.has_recipe ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          BOM Configured
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          No Recipe
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(item)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition ${
                          item.is_available
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {item.is_available ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        <span>{item.is_available ? 'Available' : 'Unavailable'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INGREDIENTS */}
      {activeTab === 'ingredients' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Ingredient</th>
                  <th className="px-4 py-3">Base Unit</th>
                  <th className="px-4 py-3">Min Stock</th>
                  <th className="px-4 py-3">Optimal Par</th>
                  <th className="px-4 py-3">Cost per Unit</th>
                  <th className="px-6 py-3 text-right">Active Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIngredients.map((ing) => (
                  <tr key={ing.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{ing.name}</td>
                    <td className="px-4 py-3.5 text-slate-700">{ing.unit_name} ({ing.unit_abbreviation})</td>
                    <td className="px-4 py-3.5 text-slate-600">{ing.minimum_stock_level}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{ing.optimal_par_level}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">₹{Number(ing.cost_per_unit).toFixed(2)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <Badge status={ing.is_active ? 'ACTIVE' : 'DISCARDED'} label={ing.is_active ? 'Active' : 'Inactive'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5 text-slate-400 font-mono">#{c.id}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{c.description || '—'}</td>
                    <td className="px-6 py-3.5 text-right">
                      <Badge status={c.is_active ? 'ACTIVE' : 'DISCARDED'} label={c.is_active ? 'Active' : 'Inactive'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: UNITS OF MEASURE */}
      {activeTab === 'units' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Unit Name</th>
                  <th className="px-4 py-3">Abbreviation</th>
                  <th className="px-4 py-3">Dimension Type</th>
                  <th className="px-4 py-3">Base Unit ID</th>
                  <th className="px-6 py-3 text-right">Conversion Factor to Base</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-primary-700">{u.abbreviation}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {u.unit_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{u.base_unit_id || 'Base Unit (Self)'}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">{u.conversion_factor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Catalog;


