import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');
const INDEX = path.join(DIST, 'index.html');

console.log('🚀 Starting server...');
console.log('📁 DIST:', DIST);
console.log('✅ DIST exists:', fs.existsSync(DIST));
console.log('✅ index.html exists:', fs.existsSync(INDEX));

if (!fs.existsSync(DIST) || !fs.existsSync(INDEX)) {
  console.error('❌ Build files missing! Exiting...');
  process.exit(1);
}

const app = express();

// Serve all static files (JS, CSS, assets, etc)
app.use(express.static(DIST, {
  maxAge: '1d',
  index: false  // Disable automatic index.html serving so we can handle it ourselves
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(INDEX);
});

// SPA fallback - ALL other routes serve index.html
// This is critical for React Router to work on direct URL access
app.get('*', (req, res) => {
  console.log(`📍 SPA route: ${req.path}`);
  res.sendFile(INDEX);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 URL: https://resturant-saas-1.onrender.com`);
});



