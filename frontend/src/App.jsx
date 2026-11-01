import React from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { SystemStatus } from './pages/SystemStatus';
import { useSystemHealth } from './hooks/useSystemHealth';

export function App() {
  const { healthData, loading, lastUpdated, refresh } = useSystemHealth();

  return (
    <DashboardLayout 
      onRefresh={refresh} 
      loading={loading} 
      lastUpdated={lastUpdated}
    >
      <SystemStatus 
        healthData={healthData} 
        loading={loading} 
        lastUpdated={lastUpdated} 
      />
    </DashboardLayout>
  );
}

export default App;
