import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');
const INDEX = path.join(DIST, 'index.html');

// Verify files exist
if (!fs.existsSync(DIST)) {
  console.error('❌ FATAL: dist/ not found');
  process.exit(1);
}

if (!fs.existsSync(INDEX)) {
  console.error('❌ FATAL: dist/index.html not found');
  console.error('Available files:', fs.readdirSync(DIST));
  process.exit(1);
}

const app = express();

// CRITICAL: Serve static files first, then SPA fallback
app.use(express.static(DIST));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// SPA fallback for ALL routes - must be last
app.get('*', (req, res) => {
  res.sendFile(INDEX, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).json({ error: 'Failed to load app' });
    }
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Frontend server running on port ' + PORT);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});



