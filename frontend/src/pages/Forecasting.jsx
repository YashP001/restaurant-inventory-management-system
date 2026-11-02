import React, { useState, useEffect } from 'react';
import { forecastingApi } from '../services/api';
import Badge from '../components/Badge';

export default function Forecasting() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'ingredients' | 'accuracy'
  const [forecasts, setForecasts] = useState([]);
  const [ingredientDemand, setIngredientDemand] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Metadata from generation/forecasts
  const [meta, setMeta] = useState({
    model_name: 'RandomForestRegressor',
    model_version: 'RandomForestRegressor@1.0.0',
    data_through_date: '2026-10-30',
    uncertainty_method: 'empirical_residual_std_provisional',
    forecast_start_date: null,
    forecast_end_date: null
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, ingRes, accRes] = await Promise.allSettled([
        forecastingApi.getForecasts('?limit=200'),
        forecastingApi.getIngredientDemand(),
        forecastingApi.getAccuracy()
      ]);

      if (fRes.status === 'fulfilled' && fRes.value.data) {
        setForecasts(fRes.value.data);
        if (fRes.value.data.length > 0) {
          const sample = fRes.value.data[0];
          setMeta(prev => ({
            ...prev,
            model_version: sample.model_version || prev.model_version,
            forecast_start_date: fRes.value.data[0].forecast_date,
            forecast_end_date: fRes.value.data[fRes.value.data.length - 1].forecast_date
          }));
        }
      }

      if (ingRes.status === 'fulfilled' && ingRes.value.data) {
        setIngredientDemand(ingRes.value.data);
      }

      if (accRes.status === 'fulfilled' && accRes.value.data) {
        setAccuracy(accRes.value.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load forecasting data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await forecastingApi.generateForecasts({ horizon_days: 7 });
      const data = res.data;
      setMeta({
        model_name: data.model_name,
        model_version: data.model_version,
        data_through_date: data.data_through_date,
        uncertainty_method: data.uncertainty_method,
        forecast_start_date: data.forecast_start_date,
        forecast_end_date: data.forecast_end_date
      });
      alert('7-day demand forecasts regenerated successfully with Random Forest model!');
      await loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to generate forecasts');
    } finally {
      setGenerating(false);
    }
  };

  // Group forecasts by menu item
  const groupedMenuForecasts = forecasts.reduce((acc, f) => {
    const key = f.target_name || `Item ${f.target_id}`;
    if (!acc[key]) {
      acc[key] = {
        name: key,
        id: f.target_id,
        daily: [],
        total: 0
      };
    }
    acc[key].daily.push(f);
    acc[key].total += f.predicted_quantity;
    return acc;
  }, {});

  const menuList = Object.values(groupedMenuForecasts).filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AI Demand Forecasting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Machine learning 7-day demand projections, recipe BOM expansion, and residual analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Generating Projections...
              </>
            ) : (
              <>
                <span>⚡</span> Run 7-Day Forecast Engine
              </>
            )}
          </button>
        </div>
      </div>

      {/* Model & System Metadata Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-gray-500 block uppercase font-medium">Selected Model</span>
          <span className="font-bold text-gray-900 text-sm">{meta.model_name}</span>
          <span className="text-2xs text-gray-400 block">{meta.model_version}</span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-medium">Data Through Date</span>
          <span className="font-bold text-amber-600 text-sm">{meta.data_through_date || '2026-10-30'}</span>
          <span className="text-2xs text-gray-400 block">Historical training cutoff</span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-medium">Forecast Horizon</span>
          <span className="font-bold text-primary-600 text-sm">7 Days</span>
          <span className="text-2xs text-gray-400 block">
            {meta.forecast_start_date ? `${meta.forecast_start_date} to ${meta.forecast_end_date}` : 'Upcoming week'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block uppercase font-medium">Uncertainty Bounds</span>
          <span className="font-bold text-gray-900 text-sm">Empirical Residuals</span>
          <span className="text-2xs text-yellow-600 block">Provisional method</span>
        </div>
      </div>

      {/* Methodological Guidance & Warnings */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <span>⚠️</span> Important Interpretive Notes:
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-2xs pl-2">
          <li>
            <strong>Data Freshness Warning:</strong> Historical sales training data ends at <strong>{meta.data_through_date || '2026-10-30'}</strong>.
            Verify ongoing actuals for seasonal shifts or special event spikes.
          </li>
          <li>
            <strong>Empirical Residual Bounds:</strong> Uncertainty intervals reflect empirical residual standard deviations (<code className="font-mono">{meta.uncertainty_method}</code>)
            and must <em>not</em> be interpreted as statistically calibrated confidence intervals.
          </li>
          <li>
            <strong>Kitchen Prep Guidance:</strong> Fractional predictions represent statistical expected values. Kitchen staff should round to sensible batch or pan sizes.
          </li>
        </ul>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('menu')}
          className={`pb-3 transition border-b-2 ${
            activeTab === 'menu'
              ? 'border-primary-600 text-primary-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Menu Item Forecasts ({menuList.length})
        </button>
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`pb-3 transition border-b-2 ${
            activeTab === 'ingredients'
              ? 'border-primary-600 text-primary-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          BOM Ingredient Demand Breakdown
        </button>
        <button
          onClick={() => setActiveTab('accuracy')}
          className={`pb-3 transition border-b-2 ${
            activeTab === 'accuracy'
              ? 'border-primary-600 text-primary-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Model Evaluation & Accuracy
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          Loading forecast engine data...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
          <p className="font-semibold">Error Loading Forecast Data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : activeTab === 'menu' ? (
        /* Tab 1: Menu Forecasts */
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <input
              type="text"
              placeholder="Search forecasted menu dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">Menu Dish</th>
                    <th className="px-5 py-3">7-Day Total Expected</th>
                    <th className="px-5 py-3">Recommended Prep</th>
                    <th className="px-5 py-3">Daily Breakdown & Uncertainty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {menuList.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4 font-bold text-gray-900 text-sm">
                        {m.name}
                      </td>
                      <td className="px-5 py-4 font-black text-primary-600 text-sm">
                        {m.total.toFixed(1)} <span className="text-2xs font-normal text-gray-500">servings</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-green-100 text-green-800 font-bold rounded text-xs">
                          ~{Math.round(m.total)} units
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {m.daily.map((d, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-50 border border-gray-200 rounded p-1.5 text-center min-w-[70px]"
                            >
                              <span className="block text-3xs text-gray-400 font-mono">
                                {d.forecast_date.slice(5)}
                              </span>
                              <span className="font-bold text-gray-900 text-xs block">
                                {d.predicted_quantity.toFixed(1)}
                              </span>
                              <span className="text-3xs text-gray-500 block">
                                [{d.confidence_lower_bound.toFixed(0)} - {d.confidence_upper_bound.toFixed(0)}]
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'ingredients' ? (
        /* Tab 2: BOM Ingredient Demand */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-xs text-gray-600">
            <span className="font-semibold text-gray-900">Recipe BOM Conversion:</span>{' '}
            Expanded {ingredientDemand?.summary?.totalMenuForecastLines || 0} menu prediction points into{' '}
            <strong>{ingredientDemand?.aggregatedIngredientDemand?.length || 0} unique ingredients</strong> needed over the 7-day forecast horizon.
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Ingredient</th>
                    <th className="px-6 py-3">Unit</th>
                    <th className="px-6 py-3">7-Day Net Required Quantity</th>
                    <th className="px-6 py-3">Contributing Menu Dishes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(ingredientDemand?.aggregatedIngredientDemand || []).map((ing, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-semibold text-gray-900">{ing.ingredient_name}</td>
                      <td className="px-6 py-3 font-mono">{ing.unit_abbreviation || 'units'}</td>
                      <td className="px-6 py-3 font-bold text-primary-600 text-sm">
                        {parseFloat(ing.total_required_quantity).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-2xs text-gray-500">
                        {(ing.contributing_dishes || []).join(', ') || 'Derived from active recipes'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 3: Accuracy Evaluation */
        <div className="space-y-4">
          {accuracy?.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Mean Absolute Error (MAE)</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{accuracy.metrics.mae ?? '0.00'}</p>
                <span className="text-2xs text-gray-400">Servings error per day</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Root Mean Sq Error (RMSE)</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{accuracy.metrics.rmse ?? '0.00'}</p>
                <span className="text-2xs text-gray-400">Penalizes large errors</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Weighted MAPE</span>
                <p className="text-xl font-bold text-primary-600 mt-1">{accuracy.metrics.wmape ?? '0.00'}%</p>
                <span className="text-2xs text-gray-400">Volume-weighted accuracy</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Evaluated Points</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{accuracy.metrics.sample_size ?? 0}</p>
                <span className="text-2xs text-gray-400">Overlapping actual sales</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {(!accuracy?.evaluations || accuracy.evaluations.length === 0) ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No historical forecast-versus-actual overlap recorded yet. Ongoing sales will populate real-time accuracy benchmarks.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Menu Dish</th>
                      <th className="px-5 py-3">Predicted</th>
                      <th className="px-5 py-3">Realized Actual</th>
                      <th className="px-5 py-3">Absolute Residual</th>
                      <th className="px-5 py-3">Model Tag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accuracy.evaluations.map((ev, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 font-mono text-gray-900">{ev.forecast_date}</td>
                        <td className="px-5 py-2.5 font-medium text-gray-900">{ev.menu_item_name}</td>
                        <td className="px-5 py-2.5 font-semibold text-primary-600">{ev.predicted_quantity.toFixed(1)}</td>
                        <td className="px-5 py-2.5 font-bold text-gray-900">{ev.actual_quantity.toFixed(1)}</td>
                        <td className="px-5 py-2.5 font-mono text-red-600">{ev.absolute_error.toFixed(2)}</td>
                        <td className="px-5 py-2.5 text-2xs text-gray-400">{ev.model_version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

