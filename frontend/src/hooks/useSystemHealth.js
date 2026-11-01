import { useState, useEffect, useCallback } from 'react';
import { getSystemHealth, getForecastingServiceHealth } from '../services/api';

export function useSystemHealth() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [healthData, setHealthData] = useState({
    backend: { status: 'CHECKING', details: null },
    mysql: { status: 'CHECKING', details: null },
    mongodb: { status: 'CHECKING', details: null },
    forecasting: { status: 'CHECKING', details: null }
  });

  const checkHealth = useCallback(async () => {
    setLoading(true);
    
    // Check Backend & Databases
    const backendRes = await getSystemHealth();
    // Check Python Forecasting Service
    const forecastRes = await getForecastingServiceHealth();

    const newHealth = {
      backend: {
        status: backendRes.ok ? 'UP' : 'DOWN',
        details: backendRes.data?.services?.backend || { error: backendRes.error }
      },
      mysql: {
        status: backendRes.data?.services?.mysql?.status || (backendRes.ok ? 'UNKNOWN' : 'UNREACHABLE'),
        details: backendRes.data?.services?.mysql || { error: backendRes.error }
      },
      mongodb: {
        status: backendRes.data?.services?.mongodb?.status || (backendRes.ok ? 'UNKNOWN' : 'UNREACHABLE'),
        details: backendRes.data?.services?.mongodb || { error: backendRes.error }
      },
      forecasting: {
        status: forecastRes.ok ? 'UP' : 'DOWN',
        details: forecastRes.data || { error: forecastRes.error }
      }
    };

    setHealthData(newHealth);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    healthData,
    loading,
    lastUpdated,
    refresh: checkHealth
  };
}
