# Restaurant & Food Inventory Management System
> **With Demand Prediction and Food Waste Reduction**  
> *DBMS Laboratory Project — Developed by a Team of 3 Students*

---

## 1. Project Overview
An intelligent, full-stack restaurant operations and food inventory platform that integrates:
- Customer order and Point of Sale (POS) tracking.
- Recipe Bill of Materials (BOM) & automated ingredient deductions.
- Supplier and purchase order workflows.
- Stock level tracking and batch expiration monitoring.
- Demand forecasting powered by a Python FastAPI service.
- Food waste tracking and intelligent procurement recommendations.

---

## 2. Architecture & Tech Stack

A **modular monolithic architecture** designed for high transactional consistency and operational audit trails:

- **Frontend:** React.js 18, Vite, Tailwind CSS, Lucide React
- **Backend:** Node.js (ES Modules), Express.js, dotenv, cors, mysql2, mongoose
- **Primary Database (Transactional Source of Truth):** MySQL 8 (`restaurant_inventory_db`)
- **Operational Database (Audit & Telemetry):** MongoDB Community Server (`restaurant_inventory_logs`)
- **Forecasting Microservice:** Python 3.13, FastAPI, Uvicorn

---

## 3. Repository Structure

```
restaurant-inventory-system/
│
├── frontend/               # React 18 + Vite + Tailwind CSS dashboard
├── backend/                # Express.js REST API with MySQL & MongoDB connections
├── forecasting-service/    # FastAPI microservice for future ML demand prediction
├── database/               # SQL DDL schemas, MongoDB collections, migrations & seeds
├── docs/                   # Architecture documentation & setup guides
├── .gitignore              # Monorepo git ignore rules
├── .env.example            # Environment variables template
└── README.md
```

---

## 4. Local Development Setup

### Prerequisites
- **Node.js**: v18+ (tested on v24.11.1)
- **Python**: v3.10+ (tested on v3.13.0)
- **MySQL 8 Server**: Local instance running on port 3306
- **MongoDB**: Local Community Server running on port 27017

### 1. Configure Environment Variables
Copy `.env.example` in each service (or configure the root `.env`):
- `backend/.env`:
  ```env
  PORT=5000
  FRONTEND_URL=http://localhost:5173
  NODE_ENV=development

  MYSQL_HOST=localhost
  MYSQL_PORT=3306
  MYSQL_USER=root
  MYSQL_PASSWORD=your_actual_password
  MYSQL_DATABASE=restaurant_inventory_db

  MONGODB_URI=mongodb://localhost:27017/restaurant_inventory_logs
  ```
- `frontend/.env`:
  ```env
  VITE_API_BASE_URL=http://localhost:5000/api
  ```
- `forecasting-service/.env`:
  ```env
  FORECAST_SERVICE_PORT=8000
  ```

---

## 5. Startup Commands (Windows PowerShell)

Run each service in a separate terminal:

### Terminal 1: Backend
```powershell
cd "backend"
npm run dev
```

### Terminal 2: Frontend
```powershell
cd "frontend"
npm run dev
```

### Terminal 3: Forecasting Service
```powershell
cd "forecasting-service"
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 6. Health & Diagnostics Endpoints

| Endpoint | Method | Expected Status | Description |
| :--- | :--- | :--- | :--- |
| `http://localhost:5000/api/health` | GET | `200 OK` / `207 Multi-Status` | Overall system diagnostic (Backend, MySQL, MongoDB) |
| `http://localhost:5000/api/health/mysql` | GET | `200 OK` / `503 Unavailable` | MySQL connection status and query ping latency |
| `http://localhost:5000/api/health/mongodb` | GET | `200 OK` / `503 Unavailable` | MongoDB Mongoose readyState and admin ping |
| `http://localhost:8000/health` | GET | `200 OK` | Python FastAPI forecasting service status |
| `http://localhost:5173` | GET | `200 OK` | React dashboard shell & live connectivity monitor |

---

## 7. Git Collaboration & Team Workflow
Team members should follow the Git branching model:
- `main`: Production / verified releases only.
- `develop`: Integration branch.
- Feature branches:
  - `feature/frontend`
  - `feature/backend`
  - `feature/database`
  - `feature/forecasting`

Before opening a pull request into `develop`, ensure all health endpoints pass and no credentials are committed.
