/**
 * Performance monitoring and optimization utilities
 * Helps track and optimize React component renders and API calls
 */

import { useRef, useEffect } from 'react';

/**
 * Measure component render time
 */
export const useRenderTime = (componentName) => {
  const renderStartRef = useRef(Date.now());
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current += 1;
    const renderTime = Date.now() - renderStartRef.current;

    if (process.env.NODE_ENV === 'development' && renderTime > 16) { // Warn if render takes > 16ms (1 frame)
      console.warn(
        `[Performance] ${componentName} render #${renderCountRef.current} took ${renderTime}ms`,
        `(renders: ${renderCountRef.current})`
      );
    }

    renderStartRef.current = Date.now();
  });
};

/**
 * Debounce a callback function
 */
export const debounce = (callback, delayMs = 300) => {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...args);
    }, delayMs);
  };
};

/**
 * Throttle a callback function
 */
export const throttle = (callback, delayMs = 300) => {
  let lastCall = 0;
  let timeoutId;

  return (...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delayMs) {
      lastCall = now;
      callback(...args);
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        callback(...args);
      }, delayMs - timeSinceLastCall);
    }
  };
};

/**
 * Hook to measure effect performance
 */
export const useEffectTimer = (effectName, deps) => {
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const effectStartTime = Date.now();

    return () => {
      const effectDuration = Date.now() - effectStartTime;
      if (process.env.NODE_ENV === 'development' && effectDuration > 50) {
        console.warn(
          `[Performance] Effect "${effectName}" took ${effectDuration}ms`,
          deps
        );
      }
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * Get performance metrics
 */
export const getPerformanceMetrics = () => {
  if (!window.performance || !window.performance.getEntriesByType) {
    return null;
  }

  const navigationTiming = window.performance.getEntriesByType('navigation')[0];
  if (!navigationTiming) {
    return null;
  }

  return {
    dns: navigationTiming.domainLookupEnd - navigationTiming.domainLookupStart,
    tcp: navigationTiming.connectEnd - navigationTiming.connectStart,
    ttfb: navigationTiming.responseStart - navigationTiming.requestStart,
    download: navigationTiming.responseEnd - navigationTiming.responseStart,
    domInteractive: navigationTiming.domInteractive - navigationTiming.fetchStart,
    domComplete: navigationTiming.domComplete - navigationTiming.fetchStart,
    loadComplete: navigationTiming.loadEventEnd - navigationTiming.fetchStart,
  };
};

/**
 * Report performance metrics
 */
export const reportPerformance = (metricName, duration) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Metric] ${metricName}: ${duration}ms`);
  }

  // Could also send to external service for monitoring
  if (window.__reportPerformance) {
    window.__reportPerformance(metricName, duration);
  }
};

export default {
  useRenderTime,
  debounce,
  throttle,
  useEffectTimer,
  getPerformanceMetrics,
  reportPerformance,
};
