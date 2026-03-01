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

console.log('🚀 Frontend server starting...');
console.log('📁 Dist directory:', distPath);
console.log('📁 Dist exists:', fs.existsSync(distPath));
console.log('📄 Index.html exists:', fs.existsSync(indexPath));
console.log('🔧 PORT:', PORT);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);

// Verify build output exists
if (!fs.existsSync(distPath)) {
  console.error('❌ FATAL: dist/ directory not found!');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('❌ FATAL: dist/index.html not found! Build incomplete.');
  console.log('📁 Contents of dist/:', fs.readdirSync(distPath));
  process.exit(1);
}

console.log('✅ Build files verified');

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check');
  res.status(200).json({ 
    status: 'OK',
    env: process.env.NODE_ENV,
    port: PORT,
    distPath: distPath
  });
});

// Serve static files - but don't send 404 for missing files
app.use(express.static(distPath, {
  dotfiles: 'deny',
  maxAge: '1d',
}));

// SPA Fallback - MUST be last
app.get('*', (req, res, next) => {
  console.log(`📍 SPA Fallback: ${req.method} ${req.path}`);
  
  const file = path.join(distPath, req.path);
  
  // If it's a static file that doesn't exist, still serve index.html
  // This allows React Router to handle all routes
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ Error serving index.html:', err.message);
      res.status(500).send('Error loading application');
    }
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     ✅ RESTAURANT FRONTEND SERVER RUNNING              ║');
  console.log(`║     🔧 Port: ${PORT}`);
  console.log(`║     🌐 URL: https://resturant-saas-1.onrender.com       ║`);
  console.log('║                                                        ║');
  console.log('║     📱 QR Code URL:                                     ║');
  console.log('║  https://resturant-saas-1.onrender.com/menu?table=22  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('❌ Server closed');
    process.exit(0);
  });
});



