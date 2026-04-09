import React from 'react';
import './HourlyHeatmap.css';

export default function HourlyHeatmap({ data }) {
  const getIntensity = (value, max) => Math.round((value / max) * 100);
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  return (
    <div className="heatmap-container">
      <div className="heatmap-grid">
        {data.map((hourData) => (
          <div
            key={hourData.hour}
            className="heatmap-cell"
            style={{
              backgroundColor: `hsl(135, 70%, ${100 - getIntensity(hourData.orders, maxOrders) * 0.5}%)`,
            }}
            title={`${hourData.hour}:00 - ${hourData.orders} orders`}
          >
            <div className="heatmap-hour">{hourData.hour}h</div>
            <div className="heatmap-value">{hourData.orders}</div>
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: '#dcfce7' }}></div>
          <span>Low</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: '#86efac' }}></div>
          <span>Medium</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: '#22c55e' }}></div>
          <span>High</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: '#16a34a' }}></div>
          <span>Peak 🔥</span>
        </div>
      </div>
    </div>
  );
}
