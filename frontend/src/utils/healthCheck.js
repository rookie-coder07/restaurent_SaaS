/**
 * Backend health check and keep-alive utility
 * Helps prevent Render cold starts and maintains backend responsiveness
 */

import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks
const HEALTH_CHECK_TIMEOUT = 10000; // 10 second timeout

let healthCheckIntervalId = null;
let lastHealthCheckTime = 0;
let isHealthy = true;

/**
 * Perform a lightweight health check
 */
export const checkBackendHealth = async () => {
  try {
    const response = await Promise.race([
      axios.get(`${API_BASE_URL}/v1/health`, { timeout: HEALTH_CHECK_TIMEOUT }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
      ),
    ]);

    lastHealthCheckTime = Date.now();
    isHealthy = true;

    if (process.env.NODE_ENV === 'development') {
      console.log('[Health] Backend is healthy', response.data);
    }

    return true;
  } catch (err) {
    isHealthy = false;
    console.warn('[Health] Backend health check failed:', err.message);
    return false;
  }
};

/**
 * Start periodic health checks
 */
export const startHealthChecks = () => {
  if (healthCheckIntervalId) {
    return; // Already running
  }

  // Initial health check
  checkBackendHealth();

  // Periodic health checks
  healthCheckIntervalId = setInterval(() => {
    checkBackendHealth();
  }, HEALTH_CHECK_INTERVAL);

  if (process.env.NODE_ENV === 'development') {
    console.log('[Health] Health check interval started (every 5 minutes)');
  }
};

/**
 * Stop periodic health checks
 */
export const stopHealthChecks = () => {
  if (healthCheckIntervalId) {
    clearInterval(healthCheckIntervalId);
    healthCheckIntervalId = null;
  }
};

/**
 * Get current health status
 */
export const getHealthStatus = () => ({
  isHealthy,
  lastCheckTime: lastHealthCheckTime,
  timeSinceLastCheck: Date.now() - lastHealthCheckTime,
});

/**
 * Exponential backoff for API calls when backend is unhealthy
 */
export const getRetryDelay = (attemptNumber) => {
  // If backend is unhealthy, use longer backoff
  const baseDelay = isHealthy ? 100 : 1000;
  return Math.min(baseDelay * Math.pow(2, attemptNumber), 30000);
};

/**
 * Initialize health monitoring on app start
 */
export const initializeHealthMonitoring = () => {
  // Start health checks
  startHealthChecks();

  // Report performance metrics
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => {
      const metrics = window.performance?.timing;
      if (metrics) {
        const pageLoadTime = metrics.loadEventEnd - metrics.navigationStart;
        console.log('[Perf] Page load time:', pageLoadTime, 'ms');
      }
    });
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    stopHealthChecks();
  });
};

export default {
  checkBackendHealth,
  startHealthChecks,
  stopHealthChecks,
  getHealthStatus,
  getRetryDelay,
  initializeHealthMonitoring,
};
