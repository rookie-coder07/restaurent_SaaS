import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');

console.log('🚀 Starting frontend server...');
console.log('📁 Serving from:', distPath);
console.log('🔧 PORT:', PORT);
console.log('📍 NODE_ENV:', process.env.NODE_ENV);

// Verify dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist folder not found at', distPath);
  console.error('Build may have failed. Check Render build logs.');
  process.exit(1);
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Serve static assets (JS, CSS, images, etc)
app.use(express.static(distPath, {
  maxAge: '1d',
  etag: false,
  // Don't return 404 for missing files, let the next middleware handle it
}));

// SPA fallback: serve index.html for all non-static routes
app.use((req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  
  // Log the request for debugging
  console.log(`📱 Request: ${req.method} ${req.path}`);
  
  if (!fs.existsSync(indexPath)) {
    console.error('❌ index.html not found at', indexPath);
    return res.status(500).json({ error: 'Application failed to load' });
  }
  
  try {
    res.sendFile(indexPath);
  } catch (err) {
    console.error('❌ Error serving index.html:', err);
    res.status(500).json({ error: 'Failed to load app' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server ready on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
});

