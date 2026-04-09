import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TopItemsChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis type="number" stroke="#666" />
        <YAxis dataKey="name" type="category" width={150} stroke="#666" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
          formatter={(value) => `${value} sold`}
        />
        <Bar dataKey="quantity" fill="#f59e0b" />
      </BarChart>
    </ResponsiveContainer>
  );
}
