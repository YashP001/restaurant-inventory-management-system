import React, { useState, useEffect } from 'react';
import { catalogApi } from '../services/api';
import { Modal } from '../components/Modal';
import { 
  BookOpen, 
  ChefHat, 
  Eye, 
  Layers, 
  Search, 
  DollarSign,
  Info
} from 'lucide-react';

export function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Selected recipe details for modal
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await catalogApi.getRecipes('?limit=50');
      if (res?.success) {
        setRecipes(res.data?.recipes || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load recipes catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const openRecipeDetails = async (recipe) => {
    try {
      setDetailsLoading(true);
      setShowDetailsModal(true);
      const res = await catalogApi.getRecipeById(recipe.id);
      if (res?.success) {
        setSelectedRecipe(res.data);
      }
    } catch (err) {
      alert(`Failed to load recipe details: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(r => 
    !search || r.menu_item_name?.toLowerCase().includes(search.toLowerCase()) || r.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Recipes & Bill of Materials (BOM)</h1>
        <p className="text-xs sm:text-sm text-slate-500">Dish ingredient compositions, yield servings, wastage allowances, and theoretical food costing</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Main Recipes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search dishes or recipes..."
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
                <th className="px-6 py-3">Menu Dish</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Yield Servings</th>
                <th className="px-4 py-3">BOM Ingredients</th>
                <th className="px-4 py-3">Selling Price</th>
                <th className="px-4 py-3">Cost / Serving</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecipes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    {loading ? 'Loading recipes...' : 'No recipes match search criteria'}
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5">
                      <p className="font-bold text-slate-900">{r.menu_item_name}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{r.instructions || 'Standard culinary preparation'}</p>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">{r.category_name}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{r.yield_servings} serving(s)</td>
                    <td className="px-4 py-3.5 text-slate-600 font-semibold">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-primary-50 text-primary-700 border border-primary-200">
                        {r.bom_items_count} items
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-black text-slate-900">₹{Number(r.selling_price).toFixed(2)}</td>
                    <td className="px-4 py-3.5 font-bold text-emerald-700">
                      ₹{Number(r.cost_per_serving || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openRecipeDetails(r)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>View BOM</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RECIPE BILL OF MATERIALS */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={selectedRecipe ? `Recipe BOM: ${selectedRecipe.menu_item_name}` : 'Recipe Details'}
        maxWidth="max-w-3xl"
      >
        {detailsLoading || !selectedRecipe ? (
          <div className="py-12 text-center text-slate-400">Loading recipe components...</div>
        ) : (
          <div className="space-y-6 text-xs">
            {/* Summary Header */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-slate-400 uppercase font-bold text-[10px]">Yield Servings</p>
                <p className="text-base font-bold text-slate-900">{selectedRecipe.yield_servings}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase font-bold text-[10px]">Selling Price</p>
                <p className="text-base font-black text-slate-900">₹{Number(selectedRecipe.selling_price).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase font-bold text-[10px]">Theoretical Food Cost</p>
                <p className="text-base font-black text-emerald-700">₹{Number(selectedRecipe.cost_per_serving || 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Preparation Notes */}
            {selectedRecipe.instructions && (
              <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-slate-700">
                <p className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                  <ChefHat className="w-4 h-4 text-blue-600" />
                  <span>Preparation Instructions</span>
                </p>
                <p className="text-[11px] leading-relaxed">{selectedRecipe.instructions}</p>
              </div>
            )}

            {/* Bill of Materials Table */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px]">
                Raw Ingredients Bill of Materials ({selectedRecipe.ingredients?.length || 0})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Ingredient</th>
                      <th className="px-3 py-2.5">Required Qty</th>
                      <th className="px-3 py-2.5">Recipe Unit</th>
                      <th className="px-3 py-2.5">Wastage %</th>
                      <th className="px-3 py-2.5">Base Unit Rate</th>
                      <th className="px-4 py-2.5 text-right">Line Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRecipe.ingredients?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{item.ingredient_name}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-800">{item.quantity_required}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-medium">{item.unit_abbreviation}</td>
                        <td className="px-3 py-2.5 text-slate-600">{item.wastage_allowance_percent}%</td>
                        <td className="px-3 py-2.5 text-slate-600">₹{Number(item.cost_per_unit).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900">
                          ₹{Number(item.ingredient_cost || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Recipes;


