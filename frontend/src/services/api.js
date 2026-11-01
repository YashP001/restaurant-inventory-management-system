const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Fetches the system aggregate health status from the Express backend
 */
export async function getSystemHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Cannot reach Express backend service'
    };
  }
}

/**
 * Fetches dedicated MySQL health status from Express backend
 */
export async function getMySQLHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health/mysql`);
    const data = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Backend unreachable'
    };
  }
}

/**
 * Fetches dedicated MongoDB health status from Express backend
 */
export async function getMongoDBHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health/mongodb`);
    const data = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Backend unreachable'
    };
  }
}

/**
 * Checks connectivity with the FastAPI forecasting service directly
 */
export async function getForecastingServiceHealth() {
  try {
    const res = await fetch('http://localhost:8000/health');
    const data = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message || 'Forecasting service unreachable'
    };
  }
}
