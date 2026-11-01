# Phase 0 Implementation & Verification Guide

## 1. Scope Accomplished in Phase 0
- Scaffolding the entire monorepo structure.
- Initializing Git version control (`main` branch) and `.gitignore`.
- Setting up the React + Vite + Tailwind CSS frontend with a responsive restaurant operations shell and live system status monitor.
- Setting up the Node.js + Express backend with ES Modules, centralized error handling, CORS, request logging, and connection pooling for MySQL and MongoDB.
- Scaffolding the Python FastAPI forecasting service with health check endpoint.
- Providing `.env.example` configurations.

---

## 2. Directory Tree
```
restaurant-inventory-system/
│
├── frontend/                     # React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/           # Reusable UI widgets (Badge, StatusCard, MetricWidget)
│   │   ├── pages/                # SystemStatus page
│   │   ├── layouts/              # DashboardLayout, Sidebar, Header
│   │   ├── services/             # API client & health check callers
│   │   ├── hooks/                # useSystemHealth auto-polling hook
│   │   ├── context/
│   │   ├── utils/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
│
├── backend/                      # Node.js + Express (ES Modules)
│   ├── src/
│   │   ├── config/               # env.js, mysql.js pool, mongodb.js Mongoose
│   │   ├── modules/              # Modular business modules (Phase 1+)
│   │   ├── middleware/           # Centralized errorHandler, logger, notFoundHandler
│   │   ├── routes/               # Modular router & health.routes.js
│   │   ├── utils/
│   │   └── app.js                # Express app setup & middleware pipeline
│   ├── server.js                 # Server listener & startup DB diagnostics
│   ├── package.json
│   └── .env.example
│
├── forecasting-service/          # Python 3.13 + FastAPI microservice
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py               # FastAPI app & GET /health endpoint
│   ├── requirements.txt
│   ├── README.md
│   └── .env.example
│
├── database/                     # Dual-database structure
│   ├── mysql/                    # DDL schemas & table definitions
│   ├── mongodb/                  # Mongoose models & log collections
│   ├── migrations/               # Versioned migration scripts
│   ├── seeds/                    # Seed data
│   └── README.md
│
├── docs/                         # Architecture & implementation guides
│   ├── architecture/
│   │   └── system-architecture.md
│   ├── database/
│   └── implementation/
│       └── phase-0-setup.md
│
├── .gitignore
├── .env.example
└── README.md
```

---

## 3. Running Services Locally (PowerShell Commands)

### Terminal 1: Backend (Express.js)
```powershell
cd "e:\Inventory Management System Project\backend"
npm run dev
```
- Available at: `http://localhost:5000`
- Aggregate Health Check: `http://localhost:5000/api/health`
- MySQL Health Check: `http://localhost:5000/api/health/mysql`
- MongoDB Health Check: `http://localhost:5000/api/health/mongodb`

### Terminal 2: Frontend (React + Vite)
```powershell
cd "e:\Inventory Management System Project\frontend"
npm run dev
```
- Available at: `http://localhost:5173`

### Terminal 3: Forecasting Service (FastAPI)
```powershell
cd "e:\Inventory Management System Project\forecasting-service"
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Available at: `http://localhost:8000/health`

---

## 4. Database Setup & Troubleshooting

### MySQL 8
- Ensure the MySQL Windows Service is running (`MySQL80`).
- Create database if it does not exist:
  ```sql
  CREATE DATABASE IF NOT EXISTS restaurant_inventory_db;
  ```
- Set your password in `backend/.env`:
  ```env
  MYSQL_HOST=localhost
  MYSQL_PORT=3306
  MYSQL_USER=root
  MYSQL_PASSWORD=your_actual_password
  MYSQL_DATABASE=restaurant_inventory_db
  ```

### MongoDB
- Ensure MongoDB Community Server is installed and listening on port `27017`.
- Default connection string in `backend/.env`:
  ```env
  MONGODB_URI=mongodb://localhost:27017/restaurant_inventory_logs
  ```
- If MongoDB is installed as a Windows service, start with:
  ```powershell
  Start-Service -Name MongoDB
  ```
  Or run manually:
  ```powershell
  mongod --dbpath "C:\data\db"
  ```
