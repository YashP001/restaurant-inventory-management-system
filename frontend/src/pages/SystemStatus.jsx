import React from 'react';
import { Server, Database, Layers, Sparkles, AlertTriangle, ShieldCheck, CheckCircle2, Cpu } from 'lucide-react';
import { StatusCard } from '../components/StatusCard';

export function SystemStatus({ healthData, loading, lastUpdated }) {
  const { backend, mysql, mongodb, forecasting } = healthData;

  const servicesList = [
    {
      title: 'Backend API Service',
      role: 'Express.js (ES Modules)',
      target: 'http://localhost:5000/api/health',
      icon: Server,
      status: backend.status,
      latencyMs: undefined,
      details: backend.details?.nodeVersion ? `Node.js ${backend.details.nodeVersion}` : 'Node.js Express',
      error: backend.details?.error
    },
    {
      title: 'MySQL Relational Database',
      role: 'Primary Source of Truth (Transactional)',
      target: mysql.details?.port ? `localhost:${mysql.details.port}` : 'localhost:3306',
      icon: Database,
      status: mysql.status,
      latencyMs: mysql.details?.latencyMs,
      details: mysql.details?.database || 'restaurant_inventory_db',
      error: mysql.details?.error
    },
    {
      title: 'MongoDB NoSQL Database',
      role: 'Logs, Audit Trail & Metadata',
      target: 'mongodb://localhost:27017',
      icon: Layers,
      status: mongodb.status,
      latencyMs: mongodb.details?.latencyMs,
      details: mongodb.details?.database || 'restaurant_inventory_logs',
      error: mongodb.details?.error
    },
    {
      title: 'Forecasting Microservice',
      role: 'Python FastAPI (Scaffolded)',
      target: 'http://localhost:8000/health',
      icon: Cpu,
      status: forecasting.status,
      latencyMs: undefined,
      details: forecasting.details?.version ? `FastAPI v${forecasting.details.version}` : 'Port 8000',
      error: forecasting.details?.error
    }
  ];

  const allOperational = backend.status === 'UP' && mysql.status === 'UP' && mongodb.status === 'UP';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border ${
        allOperational 
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950' 
          : 'bg-amber-500/10 border-amber-500/20 text-amber-950'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${allOperational ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
              {allOperational ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {allOperational ? 'Phase 0 Technical Foundation: Healthy & Connected' : 'Phase 0 Foundation: Service Configuration in Progress'}
              </h1>
              <p className="text-sm mt-1 opacity-80">
                Monolithic Express architecture with MySQL relational transactional store and MongoDB audit records.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center font-mono text-xs px-3 py-1.5 rounded-lg bg-white/80 border border-slate-200 text-slate-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Auto-Poll (15s)</span>
          </div>
        </div>
      </div>

      {/* Grid of Service Connectivity Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {servicesList.map((svc) => (
          <StatusCard
            key={svc.title}
            title={svc.title}
            role={svc.role}
            target={svc.target}
            icon={svc.icon}
            status={svc.status}
            latencyMs={svc.latencyMs}
            details={svc.details}
            error={svc.error}
          />
        ))}
      </div>

      {/* Dual Database Strategy Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">MySQL 8 Relational Role</h3>
              <p className="text-xs text-slate-500">Strict ACID Transactions & Relational Integrity</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            MySQL acts as the single primary source of truth for all authoritative business data:
          </p>
          <ul className="space-y-2 text-xs text-slate-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Customer Profiles & Orders (Dine-in, Takeaway, Online)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Menu Items, Ingredients & Recipe BOMs (Bill of Materials)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Suppliers, Purchase Orders & Inventory Batches</span>
            </li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">MongoDB NoSQL Role</h3>
              <p className="text-xs text-slate-500">Flexible Operational Logs & Historical Telemetry</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            MongoDB is dedicated to high-velocity, append-mostly records without duplicating MySQL core business entities:
          </p>
          <ul className="space-y-2 text-xs text-slate-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>System & Security Audit Logs (User actions, logouts, overrides)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>User Notification History & System Alerts</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Demand Prediction Execution Metadata & Model Inference Run History</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
