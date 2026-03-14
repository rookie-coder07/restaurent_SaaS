# RestroMaxx - Deployment Guide

Complete deployment instructions for Render (backend) and Vercel (frontend).

## Pre-Deployment Checklist

### Backend Verification
- [ ] All dependencies in `package.json` ✓
- [ ] `.env.production` has all required variables ✓
- [ ] MongoDB connection string working ✓
- [ ] Cloudinary credentials valid ✓
- [ ] JWT secrets generated ✓
- [ ] Database indexes created ✓
- [ ] CORS configured correctly ✓
- [ ] Error handling in place ✓
- [ ] Logging configured ✓

### Frontend Verification
- [ ] All components created ✓
- [ ] API endpoints configured ✓
- [ ] Routes setup correctly ✓
- [ ] Authentication flow working ✓
- [ ] Responsive design tested ✓
- [ ] Environment variables set ✓
- [ ] Build succeeds without errors ✓

---

## Phase 1: Render Backend Deployment

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub account (recommended)
3. Authorize access to repositories

### Step 2: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect GitHub repository
3. Select `Restaurant_management` repository
4. Configure:
   - **Name**: `resturant-saas`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start` (create this script in backend/package.json)
   - **Plan**: Free tier (for now)

### Step 3: Add Environment Variables

In Render dashboard, go to **Environment** and add:

```
MONGODB_URI=mongodb+srv://user:password@cluster0.mongodb.net/restaurentsaas
CLOUDINARY_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
JWT_SECRET=generate-random-string-min-32-chars
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Step 4: Update backend/package.json

Add start script:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
}
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render auto-deploys when you push to main branch
3. Wait for build to complete (2-3 minutes)
4. Copy API URL from Render dashboard

**Expected URL**: `https://resturant-saas.onrender.com`

### Verification

Test deployment:

```bash
curl https://resturant-saas.onrender.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"email":"test@example.com","password":"Test123@456"}'
```

---

## Phase 2: Vercel Frontend Deployment

### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub account
3. Authorize access

### Step 2: Deploy Frontend

1. Click **"New Project"**
2. Select GitHub repository
3. Select `frontend` directory as root
4. Vercel auto-detects Vite config

### Step 3: Configure Build Settings

Vercel should auto-detect:
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Output Directory**: `dist`

If not auto-detected, set manually:

```
Build Command: npm run build
Install Command: npm install
Output Directory: dist
```

### Step 4: Add Environment Variables

In Vercel project settings → **Environment Variables**:

```
VITE_API_URL=https://resturant-saas.onrender.com
```

### Step 5: Deploy

1. Click **"Deploy"**
2. Vercel builds and deploys automatically
3. Get frontend URL from dashboard

**Expected URL**: `https://restaurentsaas.vercel.app`

---

## Phase 3: Post-Deployment Configuration

### Update Backend CORS

Update `backend/src/app.js`:

```javascript
const corsOptions = {
  origin: [
    'https://restaurentsaas.vercel.app',  // Production
    'http://localhost:5173'               // Local development
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Update Frontend API URL

Update `frontend/.env.production`:

```
VITE_API_URL=https://resturant-saas.onrender.com
```

### Redeploy Both

Push changes to trigger automatic redeployment:

```bash
git add .
git commit -m "Update production URLs"
git push origin main
```

---

## Phase 4: Custom Domain Setup (Optional)

### Add Custom Domain to Vercel

1. In Vercel project → **Settings** → **Domains**
2. Enter your domain: `app.restaurentsaas.com`
3. Add DNS records (Vercel provides):
   ```
   CNAME: app.restaurentsaas.com → cname.vercel.com
   ```
4. Vercel auto-provisions SSL certificate

### Add Custom Domain to Render

1. In Render service → **Settings** → **Custom Domains**
2. Enter domain: `api.resturant-saas.com`
3. Add CNAME record via DNS provider:
   ```
   CNAME: api.resturant-saas.com → api.onrender.com
   ```

---

## Phase 5: Database Upgrade Plan

### Current Status
- **Tier**: MongoDB M0 (512MB)
- **Estimated Data**: ~290MB
- **Headroom**: ~220MB

### Timeline
- **Month 1-3**: Test with M0
- **Month 4**: Upgrade to M2 ($57/month)
  - Dedicated cluster
  - 10GB storage
  - Better performance

### Upgrade Steps

1. **MongoDB Atlas Dashboard**
   - Select cluster
   - Click "Tier"
   - Select M2
   - Review billing
   - Confirm upgrade

2. **No connection string changes**
   - Upgrade is transparent
   - Existing connection works
   - No downtime

---

## Phase 6: Monitoring & Logs

### Vercel Logs

1. Project → **Deployments** → Recent deployment
2. Click **"View Logs"**
3. Troubleshoot build/runtime errors

### Render Logs

1. Web service → **Logs** tab
2. Real-time application logs
3. Error tracking and debugging

### Backend Logging

Winston logs saved to:
- `logs/general.log` (local)
- `logs/error.log` (local)

For production, consider:
- [Papertrail](https://www.papertrail.com) (free tier)
- [LogDNA](https://www.logdna.com) (free tier)
- [Datadog](https://www.datadoghq.com) (enterprise)

---

## Phase 7: CI/CD Pipeline (Optional)

### Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Render
        run: curl ${{ secrets.RENDER_DEPLOY_HOOK }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

Set up webhooks:
- Render deployment hook
- Vercel authentication token

---

## Troubleshooting Deployment

### Backend Won't Deploy

**Error: "Build failed"**
```bash
# Check logs in Render
# Common issues:
1. Missing environment variables
2. Node version mismatch
3. MongoDB connection string wrong
4. Port conflict
```

**Fix:**
1. Verify all env vars in Render dashboard
2. Set `NODE_VERSION=18` in build env
3. Test MongoDB URI locally
4. Check PORT is 3000 or set dynamically

### Frontend Won't Build

**Error: "Build failed"**
```bash
# Check Vercel logs
# Common issues:
1. API_URL environment variable missing
2. TypeScript errors
3. ESLint errors
```

**Fix:**
1. Add `VITE_API_URL` to Vercel env vars
2. Test build locally: `npm run build`
3. Fix ESLint warnings

### API Calls Failing in Production

**Error: "CORS error"**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Fix:**
1. Update backend CORS configuration
2. Add Vercel frontend URL to allowed origins
3. Ensure credentials: true in both

**Error: "401 Unauthorized"**
```
Token refresh failing
```

**Fix:**
1. Check JWT_SECRET is same on backend
2. Verify token expiry times (15m access, 7d refresh)
3. Check localStorage token is being sent

### Database Performance Issues

**Error: "Slow queries"**
```bash
# Check MongoDB Atlas dashboard
# Monitor:
1. Query performance
2. Index usage
3. Storage percentage
```

**Fix:**
1. Verify indexes are created (see backend README)
2. Add index if missing column frequently queried
3. Upgrade to M2 if approaching 512MB limit

---

## Performance Optimization

### Backend

1. **Database Indexing** ✓ (already implemented)
   - restaurantId on all collections
   - Compound indices for common queries

2. **Caching** (implement if needed)
   ```javascript
   // Redis caching for menu items
   const cachedMenu = await cache.get(`menu:${restaurantId}`);
   ```

3. **API Response Compression**
   ```javascript
   app.use(compression()); // Already configured
   ```

### Frontend

1. **Code Splitting** (Vite auto-handles)
   - Routes split into chunks
   - Lazy load components

2. **Image Optimization**
   - Cloudinary URLs should use transformations
   - Example: `https://res.cloudinary.com/.../c_scale,w_800`

3. **Caching Headers**
   - Vercel auto-configures cache-control
   - Frontend bundles cached for 1 year

---

## Security Checklist for Production

- [ ] Rotate MongoDB credentials
- [ ] Regenerate Cloudinary API key
- [ ] Generate new JWT secret (min 32 chars)
- [ ] Enable HTTPS (auto-provisioned by Vercel/Render)
- [ ] Set CORS to production URLs only
- [ ] Enable rate limiting on auth endpoints ✓
- [ ] Configure security headers
- [ ] Set up WAF/DDoS protection (Cloudflare)
- [ ] Regular backups of database
- [ ] Monitor error logs daily

---

## Backup Strategy

### MongoDB

Render provides automated backups:
1. Go to Atlas Dashboard
2. **Backup** → **Restore**
3. Auto-backup every 24 hours (free tier)
4. Manual backup: **Backup Now**

### Code

GitHub acts as version control:
```bash
git log --oneline  # View all commits
git checkout <commit-hash>  # Rollback if needed
```

---

## Scaling for Growth

### Month 1-3 (MVP Phase)
- **Backend**: Render Free (auto-sleeps after 15min inactivity)
- **Frontend**: Vercel Free
- **Database**: MongoDB M0 (512MB)
- **Expected Users**: 5-10 restaurants

### Month 4+ (Growth Phase)
- **Backend**: Render Paid ($7/month minimum)
- **Frontend**: Vercel Pro ($20/month)
- **Database**: MongoDB M2 ($57/month)
- **Expected Users**: 25-100 restaurants

### Production Phase (1+ year)
- **Backend**: Render + Load Balancing
- **Frontend**: Vercel Enterprise
- **Database**: MongoDB M10 ($700+/month)
- **Cache Layer**: Redis
- **CDN**: Cloudflare
- **Expected Users**: 500+ restaurants

---

## Monitoring URLs

Once deployed, monitor:

1. **Frontend**: https://restaurentsaas.vercel.app
2. **Backend**: https://resturant-saas.onrender.com
3. **API Health**: https://resturant-saas.onrender.com/health
4. **MongoDB Atlas**: https://cloud.mongodb.com
5. **Cloudinary**: https://cloudinary.com/console

---

## Rollback Procedure

If production breaks:

### Frontend Rollback

1. Vercel Deployments → Select previous version
2. Click "Promote to Production"
3. Wait 2-3 minutes for redeployment

### Backend Rollback

1. Render Service → Deployments
2. Select previous deployment
3. Click "Deploy" to redeploy that version

### Database Rollback

1. MongoDB Atlas → Backup
2. Restore from specific point-in-time
3. Notify users of data loss

---

## Success Metrics

After deployment, track:

- **Uptime**: Target 99.5%+
- **Response Time**: Target <200ms
- **Users**: Track signup rate
- **Revenue**: Track from orders
- **Errors**: Monitor error logs daily

---

**Deployment Status**: Ready ✓  
**Estimated Setup Time**: 30-60 minutes  
**Go-Live Ready**: Yes


