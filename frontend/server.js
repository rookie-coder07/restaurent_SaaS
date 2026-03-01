import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

console.log('🚀 Starting frontend server...');
console.log('📁 Dist path:', distPath);
console.log('📄 Index path:', indexPath);
console.log('🔧 PORT:', PORT);

// Verify dist exists
if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist folder not found');
  console.error('Make sure you ran: npm run build');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('❌ ERROR: index.html not found in dist');
  console.error('Build may have failed');
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Serve static files (assets, JS, CSS, etc.) with proper MIME types
app.use(express.static(distPath, {
  dotfiles: 'deny',
  maxAge: '1d',
  setHeaders: (res, path) => {
    // Cache busting for versioned files
    if (path.match(/\.[a-f0-9]{8}\./)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  },
}));

// Catch all other routes and serve index.html (SPA)
// This fixes React Router working with direct URL access
app.get('*', (req, res) => {
  console.log(`📍 SPA fallback for: ${req.path}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ Failed to serve index.html:', err.message);
      res.status(500).json({ 
        error: 'Failed to load application',
        path: req.path 
      });
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server ready at http://localhost:${PORT}`);
  console.log(`📍 QR Code URL: https://resturant-saas-1.onrender.com/menu?table=22`);
});


