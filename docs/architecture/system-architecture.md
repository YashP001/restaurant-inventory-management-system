# System Architecture Document

## Project Overview
**Title:** Restaurant & Food Inventory Management System with Demand Prediction and Food Waste Reduction  
**Academic Context:** DBMS Laboratory Project (Team of 3 Students)  
**Phase:** Phase 0 — Project Foundation and Architecture

---

## 1. Architectural Style: Modular Monolith
The core application is architected as a modular monolith with a dedicated satellite microservice for machine learning inference.

```
+-------------------------------------------------------+
|                    Client Browser                     |
|                 React.js (Vite + Tailwind)            |
+---------------------------+---------------------------+
                            |
                     HTTP / REST API
                            |
                            v
+-------------------------------------------------------+
|              Express.js Monolithic Backend            |
|                   (Node.js / ES Modules)              |
|                                                       |
|  +----------------+  +----------------+  +---------+  |
|  | Menu & Recipes |  | Orders & Sales |  | Stocks  |  |
|  +----------------+  +----------------+  +---------+  |
|  | Suppliers      |  | Waste Tracker  |  | Auth    |  |
|  +----------------+  +----------------+  +---------+  |
+--------------+--------------------------+-------------+
               |                          |
    Relational Queries (ACID)      NoSQL Logs & Telemetry
               |                          |
               v                          v
    +--------------------+      +--------------------+
    |   MySQL 8 Server   |      |  MongoDB Database  |
    | (Source of Truth)  |      |   (Audit & Logs)   |
    +--------------------+      +--------------------+
               ^
               | Inter-service API
               v
    +--------------------+
    | Python Forecasting |
    |  FastAPI Service   |
    +--------------------+
```

---

## 2. Component Breakdown & Technology Stack

| Layer | Technology | Primary Responsibility |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Clean, responsive dashboard UI; system status monitoring; operational forms |
| **Backend** | Node.js (v24), Express.js (ESM), dotenv, cors | Core business logic, transactional integrity, REST API endpoints |
| **Primary Relational DB** | MySQL 8 (`restaurant_inventory_db`) | Authoritative transactional store: users, orders, menu items, BOM recipes, suppliers, stock lots |
| **Operational NoSQL DB** | MongoDB (`restaurant_inventory_logs`) | Append-heavy logs, user activity audits, notification history, prediction run metadata |
| **Forecasting Service** | Python (3.13), FastAPI, Uvicorn | Time-series demand forecasting, waste minimization algorithms (Phase 4 & 5) |

---

## 3. Dual-Database Strategy & Separation of Concerns

### MySQL 8 (Transactional Source of Truth)
- Enforces strict foreign key constraints, schemas, and ACID transaction guarantees.
- Stored Entities:
  - `users`, `roles`, `permissions`
  - `customers`, `tables`, `orders`, `order_items`
  - `menu_items`, `recipes`, `ingredients` (Bill of Materials)
  - `suppliers`, `purchase_orders`, `purchase_order_items`
  - `inventory_items`, `stock_batches`, `stock_movements`
- **Rule:** Never store operational logs or high-frequency unstructured telemetry in MySQL.

### MongoDB (Audit & Telemetry Records)
- Schema-flexible, high-write performance.
- Stored Collections:
  - `audit_logs` (User mutations, privilege escalations, security alerts)
  - `activity_history` (Login sessions, search patterns)
  - `notifications` (Real-time stock alerts, manager notifications)
  - `prediction_runs` (Model inputs, forecast outputs, accuracy evaluations)
- **Rule:** Do not duplicate authoritative transactional entities (e.g. Orders, Inventory Items) inside MongoDB.

---

## 4. Team Collaboration & Git Branching Strategy
For three students collaborating on one shared repository:

```
main          ===============================================> (Production / Tested)
                ^
develop         |============================================> (Integration Branch)
                  \              \              \
feature/frontend   +--------+     |              |
feature/backend             \-----+              |
feature/forecasting                              +-----------+
```

### Conventions:
- **`main`**: Protected branch. Only stable, fully tested releases.
- **`develop`**: Central integration branch for team features.
- **Feature Branches**:
  - `feature/frontend`: UI components, layouts, pages
  - `feature/backend`: Express endpoints, middleware, controllers
  - `feature/database`: Migrations, schemas, seeders
  - `feature/forecasting`: FastAPI service, data processing, models
- **Commit Format**: `type(scope): description` (e.g., `feat(api): add health check endpoints`)
