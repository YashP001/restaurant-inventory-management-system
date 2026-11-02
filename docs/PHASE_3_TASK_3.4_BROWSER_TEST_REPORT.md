# Urban Bites — Phase 3, Task 3.4: Browser Automation & Frontend Testing Report

**Execution Date:** November 2, 2026  
**Baseline Git Commit:** `10f1bce`  
**Test Suite Directories:**  
- E2E Browser Tests: [`frontend/e2e/`](file:///e:/Inventory%20Management%20System%20Project/frontend/e2e)  
- Unit & Component Tests: [`frontend/src/`](file:///e:/Inventory%20Management%20System%20Project/frontend/src)  
**Overall Status:** **PASSED (63 / 63 Tests Succeeded — 100% Pass Rate)**

---

## 1. Executive Summary

Phase 3, Task 3.4 introduced robust, enterprise-grade automated browser testing using **Playwright (Chromium)** along with component and unit testing using **Vitest** and **React Testing Library** for the **Urban Bites React Frontend Dashboard**.

All tests executed against real, live instances of:
- **Vite React SPA Frontend** (`http://localhost:5173`)
- **Express.js API Backend** (`http://localhost:5000/api/v1`)
- **Python FastAPI Demand Forecasting Microservice** (`http://localhost:8000`)
- **MySQL 8 Database** (Port `3306`, InnoDB engine, stored procedures, triggers, views)
- **MongoDB Atlas Audit Logging**

Every core operational screen, responsive layout breakpoint, authentication boundary, and complex multi-step user flow was validated in real browser contexts with screenshot and trace capture.

### Comprehensive Test Summary

| Test Layer / Suite | Spec File | Total Tests | Passed | Failed | Duration | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **E2E 01: Auth & RBAC** | `01_auth.spec.js` | 9 | 9 | 0 | 48.5s | **PASSED** |
| **E2E 02: Dashboard & Nav** | `02_dashboard_nav.spec.js` | 5 | 5 | 0 | 19.8s | **PASSED** |
| **E2E 03: Inventory & FEFO** | `03_inventory.spec.js` | 7 | 7 | 0 | 23.8s | **PASSED** |
| **E2E 04: Orders, Kitchen, Payments** | `04_orders_kitchen.spec.js` | 2 | 2 | 0 | 8.6s | **PASSED** |
| **E2E 05: Forecasting & Procurement** | `05_procurement_forecasting.spec.js` | 3 | 3 | 0 | 11.2s | **PASSED** |
| **E2E 06: Responsive Viewports** | `06_responsive.spec.js` | 3 | 3 | 0 | 9.3s | **PASSED** |
| **E2E Smoke Suite** | `smoke.spec.js` | 1 | 1 | 0 | 0.9s | **PASSED** |
| **Playwright E2E Total** | **All 7 E2E Suites** | **30** | **30** | **0** | **2.2m** | **100% PASSED** |
| **Vitest Component Battery** | **6 Component Suites** | **33** | **33** | **0** | **27.8s** | **100% PASSED** |
| **Combined Frontend Test Suite** | **13 Test Suites** | **63** | **63** | **0** | **~2.8m** | **100% PASSED** |

---

## 2. Test Runner Architecture & Configuration

### 2.1 Playwright E2E Configuration (`frontend/playwright.config.js`)
- **Engine:** Playwright `@playwright/test` v1.56.1.
- **Browser:** Headless Chromium.
- **Base URL:** `http://localhost:5173`.
- **Viewport:** `1440 x 900` default (dynamically overridden in responsive suites).
- **Artifacts:**
  - Full-page screenshots on failure & milestone actions stored in `frontend/playwright-report/screenshots/`.
  - Video recording on test failure (`video: 'retain-on-failure'`).
  - Diagnostic trace zip on test failure (`trace: 'retain-on-failure'`).

### 2.2 Vitest Component Configuration (`frontend/vite.config.js`)
- **Engine:** Vitest v5.0.5 with `jsdom` simulated DOM environment.
- **Library:** `@testing-library/react` v16.3.0 and `@testing-library/jest-dom` v6.9.1.
- **Setup Script:** `frontend/src/test/setup.js` configuring custom matchers and global mocks.

---

## 3. Playwright E2E Browser Test Suites

### 3.1 Suite 1: Authentication and RBAC (`frontend/e2e/01_auth.spec.js`)
Validates role-based route access, navigation visibility, and session state across all 4 system roles:

1. **Login as ADMIN (`rohit_admin`):**
   - Successfully logs in and lands on `/`.
   - Sidebar renders full navigation options, including privileged `Staff Management` (`/staff`), `Suppliers` (`/suppliers`), and `Procurement Engine` (`/procurement`).
   - Profile avatar displays initials `RO` and `ADMIN` badge.
2. **Logout Operation:**
   - Clicks logout button in sidebar footer.
   - Clears `ub_token` and `ub_user` from `localStorage`.
   - Verifies instant redirection to `/login`.
3. **Login as INVENTORY_MANAGER (`priya_inventory`):**
   - Verifies access to `Inventory & Batches`, `Suppliers`, `Purchase Orders`, and `Procurement Engine`.
   - Verifies privileged `Staff Management` link is completely hidden from the DOM.
4. **Login as CHEF (`vikram_chef`):**
   - Verifies operational access to `Kitchen Fulfilment`, `Menu Catalog`, `Recipes & BOM`, and `Food Waste`.
   - Verifies `Suppliers`, `Purchase Orders`, `Procurement Engine`, and `Staff Management` are omitted.
5. **Login as CASHIER (`ananya_cashier`):**
   - Verifies access to `Customer Orders` (POS) and `Kitchen Fulfilment`.
   - Verifies all administrative and inventory replenishment routes are restricted.
6. **Invalid Credentials Handling:**
   - Attempts submission with incorrect password.
   - Verifies immediate appearance of the amber/red banner: *"Invalid username or password"*.
7. **Unauthenticated Route Redirection:**
   - Direct browser visit to `/inventory` without credentials forces redirection to `/login`.
8. **Unauthorized Route Guard:**
   - Logs in as `ananya_cashier` and navigates directly to `/staff`.
   - `ProtectedRoute` renders dedicated *"Access Restricted — Insufficient Permissions"* card with a direct return button.
9. **Session Expiration Handling:**
   - Dispatches `ub_auth_expired` custom event.
   - Verifies authentication context cleanses `localStorage` and automatically bounces to `/login`.

---

### 3.2 Suite 2: Dashboard & Navigation (`frontend/e2e/02_dashboard_nav.spec.js`)
Validates high-level metrics, quick action routing, and client-side single page routing:

1. **4 Live KPI Cards:**
   - Verifies `Today's Revenue`, `Orders Fulfilled`, `Low Stock Warnings`, and `Expiring Soon (3D)` display live values.
2. **Quick Action Shortcuts:**
   - `New Order / POS` button navigates smoothly to `/orders`.
   - `Procurement` button navigates cleanly to `/procurement`.
3. **Seamless Client-Side Navigation:**
   - Cycles through all operational routes via sidebar links with zero full-page browser reloads.
4. **Session Persistence (F5):**
   - Refreshes browser on protected `/inventory` screen; verifies user session persists seamlessly.
5. **Console Error Cleanliness:**
   - Zero uncaught JavaScript exceptions or runtime errors during dashboard operations.

---

### 3.3 Suite 3: Inventory & FEFO Batches (`frontend/e2e/03_inventory.spec.js`)
Validates stock balances, batch expiry prioritization, stock adjustments, and inward receiving protocols:

1. **Inventory Balance Ledger:**
   - Renders master ingredients, unit abbreviations, current stock levels, and par thresholds.
2. **Dynamic Live Filter:**
   - Typing `"Flour"` instantaneously isolates matching ingredients and hides non-matching rows.
3. **Expiring Batches (FEFO Priority):**
   - Renders batches sorted ascending by expiration date.
   - Highlights critical batches expiring within 3 days with urgency badges (`Critical Expiring`, `Attention`).
4. **All Batches Metadata View:**
   - Renders batch numbers, supplier tags, received dates, costs, and quantity remaining.
5. **Stock Adjustment Validation (Sufficiency Enforcement):**
   - Attempts a negative adjustment exceeding available batch stock (`-9999.000`).
   - Modal displays inline validation error and prevents unauthorized database deduction.
6. **Valid Cycle Count Adjustment:**
   - Applies cycle count correction (`+1.000 kg`) with mandatory reason code `AUDIT_ADJUSTMENT`.
   - Confirms audit entry is logged and movements ledger reflects new quantity.
7. **Stock Inward Guidance Protocol:**
   - "Receive Stock (Inward)" button opens protocol modal educating the user that stock must be received through verified Purchase Orders.
   - Click "Go to Purchase Orders" routes cleanly to `/purchase-orders`.

---

### 3.4 Suite 4: Customer Orders, Kitchen & Payments (`frontend/e2e/04_orders_kitchen.spec.js`)
Validates dining room ordering, bill calculation, kitchen staging, and payment closure:

1. **POS Cart Calculation:**
   - Adds *Crispy French Fries* (₹110.00) and *Fresh Lime Soda* (₹65.00).
   - Validates live ticket arithmetic: Subtotal ₹175.00 + GST (5%) ₹8.75 = Grand Total ₹183.75.
2. **End-to-End Order Fulfilment Cycle:**
   - Selects Table #4, specifies dining notes, and clicks `Place Order`.
   - Switches to `Kitchen Fulfilment` tab.
   - Kitchen staff clicks `Confirm (FEFO)`, triggering backend stored procedure `sp_process_order_fefo` to deduct exact ingredients from oldest batches.
   - Advances order status to `Mark Ready`.
   - Opens `Order History & Payments`, opens payment modal, records Cash payment, and confirms order reflects `PAID` badge and releases table.

---

### 3.5 Suite 5: AI Demand Forecasting & Intelligent Procurement (`frontend/e2e/05_procurement_forecasting.spec.js`)
Validates demand projections, model metadata, reorder points, and draft purchase order generation:

1. **Forecasting Engine Dashboard:**
   - Verifies Model Metadata Banner:
     - Selected Model: `RandomForestRegressor`
     - Model Version: `RandomForestRegressor@1.0.0`
     - Historical Cutoff: `2026-10-30`
     - Horizon: `7 Days`
     - Uncertainty Method: `Empirical Residuals`
   - Verifies Methodological Interpretive Notes:
     - *Data Freshness Warning* (historical training cutoff 2026-10-30).
     - *Empirical Residual Bounds* (residual standard deviations; not calibrated confidence intervals).
     - *Kitchen Prep Guidance* (round fractional expected servings to batch sizes).
   - Validates 7-day projected servings table and tab navigation (*BOM Breakdown*, *Model Accuracy*).
2. **Procurement Engine Recommendations:**
   - Verifies KPI cards: `Evaluated Ingredients`, `Reorder Required`, `Forecast Horizon`.
   - Validates recommendation columns: `Ingredient`, `Usable Stock`, `Safety Stock`, `ROP`, `Lead-Time Dem.`, `7D Forecast`, `Supplier & MOQ`, `Suggested Order`, `Est. Cost`.
   - Tests `Select All Shortages` and `Deselect All` buttons.
3. **Draft Purchase Order Lifecycle:**
   - Selects shortages and clicks `Convert Selected to Draft PO`.
   - Confirmation modal summarizes vendor grouping and estimated batch cost.
   - Highlights explicit notice: *Generated POs are created in DRAFT status and require manager submission before transmission*.
   - Executes conversion; navigates to `/purchase-orders`.
   - Identifies newly generated order with `DRAFT` badge.
   - Verifies Draft PO has `Submit` action (and no premature `Receive` action).
   - Submits Draft PO; verifies instantaneous status transition to `SUBMITTED`.

---

### 3.6 Suite 6: Responsive Layout & Mobile Viewports (`frontend/e2e/06_responsive.spec.js`)
Validates application presentation across industry standard device viewports:

1. **Desktop Viewport (`1440 x 900`):**
   - Sidebar is statically pinned to the left (`lg:translate-x-0`).
   - Hamburger menu button is completely hidden (`lg:hidden`).
   - Header title and user profile details are expanded.
   - Zero horizontal scrollbar overflow (`scrollWidth <= innerWidth`).
2. **Tablet Viewport (`768 x 1024`):**
   - Hamburger menu button is visible.
   - Sidebar is hidden off-screen (`-translate-x-full`).
   - Tapping hamburger button slides sidebar in (`translate-x-0`) and mounts backdrop (`bg-slate-900/40`).
   - Clicking navigation link automatically navigates and closes drawer.
3. **Mobile Viewport (`390 x 844` - iPhone 12/13/14):**
   - Mobile navigation drawer opens smoothly and closes on backdrop tap.
   - Tables (`/inventory`, `/purchase-orders`) are wrapped in `.overflow-x-auto` horizontal scrollers, preventing document body distortion.
   - POS grid wraps gracefully into single-column layout.

---

## 4. Vitest Component Testing Battery

Executed via `npx vitest run` across 6 test files (33 passing unit tests in 27.8s):

- **`Badge.test.jsx` (9 tests):** Validates color classes, labels, and rendering for PO statuses (`DRAFT`, `SUBMITTED`, `RECEIVED`), Order statuses (`PENDING`, `CONFIRMED`, `READY`), Stock levels (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`), and Batch urgency.
- **`Modal.test.jsx` (7 tests):** Validates backdrop click, Escape key dismiss, close button handler, title render, and conditional rendering.
- **`ProtectedRoute.test.jsx` (5 tests):** Validates authentication loading spinner, unauthenticated redirect to `/login`, authenticated pass-through, and role-based rejection screen.
- **`AuthContext.test.jsx` (5 tests):** Validates initial state from `localStorage`, successful login token caching, role authorization helper `hasRole()`, logout purge, and event listener for `ub_auth_expired`.
- **`Login.test.jsx` (4 tests):** Validates username/password inputs, submission event, loading state during login dispatch, and alert error display.
- **`apiError.test.jsx` (3 tests):** Validates error extraction from structured API responses, fallback string formatting, and network error handling.

---

## 5. Frontend Bugs Identified & Resolved During Automation

During the implementation and execution of the browser test suites, seven frontend contract bugs were identified and fixed:

| # | Bug Description | Component / File | Root Cause | Solution Implemented |
| :-: | :--- | :--- | :--- | :--- |
| **1** | Express API 404 on login | `frontend/.env` | `VITE_API_BASE_URL` was set to `/api` instead of `/api/v1` | Updated `.env` to `http://localhost:5000/api/v1` and rebuilt frontend bundle. |
| **2** | Immediate logout bounce on login | `frontend/src/services/api.js` | `authApi.getProfile` called `/auth/me` (non-existent route) | Updated endpoint to `/auth/profile`. |
| **3** | `[object Object]` displayed on login failure | `frontend/src/services/api.js` | Express error payload `{ error: { message: ... } }` was not unwrapped as string | Added recursive message extractor in API client `request()` helper. |
| **4** | Token persistence after session expiration | `frontend/src/context/AuthContext.jsx` | `handleAuthExpired` updated state but didn't remove `ub_token` from `localStorage` | Added explicit `localStorage.removeItem('ub_token')` in listener. |
| **5** | Blank screen crash on `/orders` | `frontend/src/pages/Orders.jsx` | Backend returned `name` and `id`, while code accessed `item_name` and `category_id` | Normalized menu item and category objects during fetch. |
| **6** | Empty table "No ingredients found" | `frontend/src/pages/Inventory.jsx` | Backend returned direct array `res.data: [...]`, code accessed `res.data.stock` | Normalized array responses across stock, batches, and movements. |
| **7** | Submit button failed on `/purchase-orders` | `frontend/src/pages/PurchaseOrders.jsx` | Purchase orders endpoint returns `id`, whereas frontend passed `po.purchase_order_id` | Normalized orders in `fetchOrders` with `purchase_order_id: po.purchase_order_id || po.id`. |

---

## 6. Screenshot Evidence Inventory

All screenshots generated during the test run were saved to [`frontend/playwright-report/screenshots/`](file:///e:/Inventory%20Management%20System%20Project/frontend/playwright-report/screenshots):

| Screenshot File | Resolution | Description & Verified Elements |
| :--- | :---: | :--- |
| `01_admin_dashboard.png` | 1440 x 900 | Admin session, full sidebar navigation with Staff Management, 4 KPI cards. |
| `02_dashboard_kpis.png` | 1440 x 900 | Dashboard KPI cards with live metrics, quick action buttons, recent orders table. |
| `03_inventory_table.png` | 1440 x 900 | Inventory stock balance ledger, par levels, stock status badges. |
| `04_pos_ticket.png` | 1440 x 900 | POS order builder, Crispy French Fries + Fresh Lime Soda, Subtotal & GST breakdown. |
| `04_order_completed.png` | 1440 x 900 | Fulfilled order history, Table 4 release, green `PAID` badge. |
| `05_forecasting_dashboard.png` | 1440 x 900 | 7-day demand projections, RandomForest metadata banner, interpretive notes. |
| `05_procurement_recommendations.png` | 1440 x 900 | Reorder point analysis, shortage indicators, suggested order quantities. |
| `05_draft_po_modal.png` | 1440 x 900 | Draft PO conversion modal, vendor grouping breakdown, estimated cost summary. |
| `05_submitted_po.png` | 1440 x 900 | Purchase Orders ledger showing transitioned `SUBMITTED` purchase order. |
| `06_desktop_1440x900.png` | 1440 x 900 | Desktop wide view, static sidebar, zero horizontal overflow. |
| `06_tablet_768x1024.png` | 768 x 1024 | Tablet viewport, open mobile drawer, dimmed backdrop overlay. |
| `06_mobile_390x844.png` | 390 x 844 | Mobile iPhone viewport, wrapped POS layout, responsive table container. |

---

## 7. Conclusion & System Readiness

With the successful execution of **30 Playwright E2E browser tests** and **33 Vitest component tests**, the Urban Bites React application has been proven to be fully functional, resilient, and responsive.

All critical UI workflows—authentication, navigation, inventory ledger management, stock adjustments, POS ticketing, kitchen FEFO confirmation, cash payments, AI demand forecasting, and automated draft purchase order generation—operate flawlessly in actual browser environments without defects or regressions.

