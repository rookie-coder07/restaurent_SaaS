import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');

const app = express();

// Verify build exists
if (!fs.existsSync(DIST)) {
  console.error('❌ ERROR: dist/ not found! Run: npm run build');
  process.exit(1);
}

const INDEX = path.join(DIST, 'index.html');
if (!fs.existsSync(INDEX)) {
  console.error('❌ ERROR: dist/index.html not found!');
  process.exit(1);
}

console.log('📁 Serving from:', DIST);
console.log('🔧 PORT:', PORT);

// Serve static assets
app.use(express.static(DIST, { maxAge: '1d' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// SPA fallback - serve index.html for all routes
app.use((req, res) => {
  res.sendFile(INDEX);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend running on port ${PORT}`);
});



