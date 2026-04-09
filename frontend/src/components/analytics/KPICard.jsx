import React from 'react';
import './KPICard.css';

export default function KPICard({ title, value, icon, trend, subtitle, loading }) {
  if (loading) {
    return (
      <div className="kpi-card skeleton">
        <div className="skeleton-content"></div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-icon">{icon}</span>
        <h4 className="kpi-title">{title}</h4>
      </div>
      <div className="kpi-value">{value}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
      {trend && (
        <div className="kpi-trend">
          <span className={`trend-${trend > 0 ? 'up' : 'down'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );
}
