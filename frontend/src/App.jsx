import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

// Page Imports
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Catalog from './pages/Catalog';
import Recipes from './pages/Recipes';
import Inventory from './pages/Inventory';
import Waste from './pages/Waste';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Forecasting from './pages/Forecasting';
import Procurement from './pages/Procurement';
import Staff from './pages/Staff';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes inside DashboardLayout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* 1. Dashboard (All authenticated staff) */}
            <Route path="/" element={<Dashboard />} />

            {/* 2. Customer Orders & POS (All authenticated staff) */}
            <Route path="/orders" element={<Orders />} />

            {/* 3. Kitchen Fulfilment Queue (All authenticated staff) */}
            <Route path="/kitchen" element={<Kitchen />} />

            {/* 4. Menu & Raw Ingredients Catalog */}
            <Route path="/menu" element={<Catalog />} />

            {/* 5. Recipes & BOM Management */}
            <Route path="/recipes" element={<Recipes />} />

            {/* 6. Inventory, Batches, Inward Receiving & Adjustments */}
            <Route path="/inventory" element={<Inventory />} />

            {/* 7. Food Waste Recording */}
            <Route path="/waste" element={<Waste />} />

            {/* 8. Suppliers (ADMIN & INVENTORY_MANAGER) */}
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'INVENTORY_MANAGER']}>
                  <Suppliers />
                </ProtectedRoute>
              }
            />

            {/* 9. Purchase Orders (ADMIN & INVENTORY_MANAGER) */}
            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'INVENTORY_MANAGER']}>
                  <PurchaseOrders />
                </ProtectedRoute>
              }
            />

            {/* 10. AI Demand Forecasting (All authenticated staff) */}
            <Route path="/forecasting" element={<Forecasting />} />

            {/* 11. Intelligent Procurement Engine (ADMIN & INVENTORY_MANAGER) */}
            <Route
              path="/procurement"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'INVENTORY_MANAGER']}>
                  <Procurement />
                </ProtectedRoute>
              }
            />

            {/* 12. Staff Management & RBAC (ADMIN only) */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Staff />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
