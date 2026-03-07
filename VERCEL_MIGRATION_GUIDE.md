# Migration to Vercel: Frontend Deployment Guide

## Overview

This guide explains the migration of the RestroMaxx frontend from Render to Vercel while keeping the backend on Render.

**Architecture:**
- **Frontend**: Vercel (React/Vite SPA)
- **Backend**: Render (Node.js/Express REST API)
- **Database**: Supabase (unchanged)

---

## Changes Made

### 1. Removed Render-Specific Frontend Configuration

| File | Action | Reason |
|------|--------|--------|
| `render.yaml` | Removed frontend service definition | Backend stays on Render; frontend now on Vercel |
| `Procfile` | Replaced with deprecation notice | Vercel manages deployment automatically |
| `build.sh` | Replaced with deprecation notice | Vercel handles build process via `npm run build` |
| `server.js` | Replaced with deprecation notice | Vercel serves static files with SPA fallback automatically |

### 2. Updated Environment Files

#### `.env.example` (Development Template)
```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
VITE_FRONTEND_URL=http://localhost:5173
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_name
VITE_APP_NAME=Restaurant Management SaaS
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### `.env.production` (Production - Vercel)
```dotenv
VITE_API_BASE_URL=https://resturant-saas.onrender.com/api
VITE_FRONTEND_URL=https://restromaxsaas.vercel.app
VITE_CLOUDINARY_CLOUD_NAME=dof234wuj
VITE_APP_NAME=Restaurant Management SaaS
VITE_SUPABASE_URL=https://pzjjuuqwpbfbfosgblzv.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_h2HoLV5oiZpBIaMK4EQHiQ_UY6HjMZn
```

### 3. Created `vercel.json`

New configuration file for Vercel deployment:

```json
{
  "projectId": "prj_restaurant_saas",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "nodeVersion": "18.x",
  "env": {
    "VITE_API_BASE_URL": "https://resturant-saas.onrender.com/api",
    ...
  },
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
}
```

**Key Features:**
- Specifies Node.js version 18.x (matches backend)
- Sets environment variables for production
- Configures SPA routing (all routes → index.html)
- Clean URLs enabled
- Trailing slashes disabled

### 4. Frontend Configuration Maintained

**API Integration** (`frontend/src/services/api.js`):
- Already uses `import.meta.env.VITE_API_BASE_URL`
- Automatically picks up environment variable during build
- Development: Uses localhost
- Production: Uses Render backend URL

**Vite Build Configuration** (`frontend/vite.config.js`):
- Build output: `dist/` directory
- Minifier: terser (now properly installed)
- Proxy: Only used during dev (`npm run dev`)
- Alias: `@` points to `src/` directory

---

## Deployment to Vercel

### Prerequisites

1. **Vercel Account**: [Sign up at vercel.com](https://vercel.com)
2. **GitHub Repository**: Push code to GitHub (Vercel integrates with GitHub)
3. **Backend Running**: Ensure Render backend is deployed and accessible

### Step 1: Connect GitHub Repository to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Connect your GitHub account and select the repository
4. Vercel will auto-detect it's a Vite application

### Step 2: Configure Project Settings

1. **Framework Preset**: Select "Vite"
2. **Root Directory**: Set to `frontend/`
3. **Build Command**: Should auto-fill as `npm run build`
4. **Output Directory**: Should auto-fill as `dist`

### Step 3: Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```
VITE_API_BASE_URL = https://resturant-saas.onrender.com/api
VITE_FRONTEND_URL = https://your-vercel-url.vercel.app
VITE_CLOUDINARY_CLOUD_NAME = dof234wuj
VITE_APP_NAME = Restaurant Management SaaS
VITE_SUPABASE_URL = https://pzjjuuqwpbfbfosgblzv.supabase.co
VITE_SUPABASE_ANON_KEY = sb_publishable_h2HoLV5oiZpBIaMK4EQHiQ_UY6HjMZn
```

**Note:** After first deployment, update `VITE_FRONTEND_URL` with actual Vercel domain.

### Step 4: Deploy

1. Click "Deploy"
2. Vercel will:
   - Clone repository
   - Run `npm run build` in `frontend/` directory
   - Optimize and serve `dist/` files
   - Configure SPA routing automatically

3. Deployment URL will be provided (e.g., `https://restaurant-management.vercel.app`)

### Step 5: Custom Domain (Optional)

1. In Vercel Dashboard → Domains
2. Add your custom domain (e.g., `restromaxsaas.vercel.app`)
3. Update DNS records as instructed
4. Update `VITE_FRONTEND_URL` in environment variables

---

## API Communication

### How It Works

1. **Frontend** (Vercel) makes API calls to `https://resturant-saas.onrender.com/api/...`
2. **Backend** (Render) receives requests with credentials
3. **CORS**: Backend must allow Vercel origin in CORS headers

### Backend CORS Configuration

Ensure `backend/src/app.js` includes:

```javascript
const corsOptions = {
  origin: [
    'https://restromaxsaas.vercel.app',  // Production Vercel URL
    'http://localhost:5173'                // Local development
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Testing API Calls

**From Vercel Console:**
```bash
curl https://resturant-saas.onrender.com/api/health
# Should return: { "status": "OK" }
```

**From Frontend (Browser Console):**
```javascript
fetch('https://resturant-saas.onrender.com/api/health')
  .then(r => r.json())
  .then(d => console.log(d))
```

---

## QR Code Flow

The QR code generation now points to the Vercel frontend:

**Before (Render):**
```
QR → https://resturant-saas-1.onrender.com/menu?table=1
```

**After (Vercel):**
```
QR → https://restromaxsaas.vercel.app/menu?table=1
```

Update QR generation in backend to use the new Vercel frontend URL:

```javascript
const baseUrl = process.env.FRONTEND_URL || 'https://restromaxsaas.vercel.app';
const qrUrl = `${baseUrl}/menu?table=${tableId}`;
```

---

## Troubleshooting

### Build Fails: "Module Not Found"

**Solution:**
```bash
cd frontend
npm install
npm run build
```

### Frontend Shows "API Error"

**Check:**
1. Backend is running: `curl https://resturant-saas.onrender.com/api/health`
2. Environment variable: Vercel Dashboard → `VITE_API_BASE_URL`
3. CORS headers in backend: Verify Vercel URL is in `corsOptions.origin`

### Static Assets Not Loading

**Cause:** Build output directory mismatch

**Solution:**
1. Verify `vite.config.js` has `outDir: 'dist'`
2. Verify `vercel.json` has `"outputDirectory": "dist"`
3. Clear Vercel cache: Project Settings → Deployments → Clear Cache

### Environment Variables Not Loading

**Solution:**
1. Vercel Dashboard → Environment Variables
2. Add variables for all environments (Production, Preview, Development)
3. Redeploy after adding variables

### SPA Routes Returning 404

**Fix:** Already configured in `vercel.json`:
```json
{
  "rewrites": [{ "source": "/:path*", "destination": "/index.html" }]
}
```

If still failing, manually add to Vercel project:
- Project Settings → Build & Development Settings
- Add Rewrite: Source: `/:path*` → Destination: `/index.html`

---

## Local Development

### Install Dependencies

```bash
cd frontend
npm install
```

### Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5173` with:
- Hot Module Replacement (HMR)
- Automatic API proxy to `http://localhost:3000/api`

### Build for Production

```bash
npm run build
```

Creates optimized `dist/` folder ready for deployment.

### Preview Production Build

```bash
npm run preview
```

Serves the built `dist/` locally on `http://localhost:4173`

---

## Environment Variables Summary

| Variable | Development | Production |
|----------|-------------|------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | `https://resturant-saas.onrender.com/api` |
| `VITE_FRONTEND_URL` | `http://localhost:5173` | `https://restromaxsaas.vercel.app` |
| `VITE_CLOUDINARY_CLOUD_NAME` | `dmy6lfb8b` | `dof234wuj` |
| `VITE_SUPABASE_URL` | Same | Same |
| `VITE_SUPABASE_ANON_KEY` | Same | Same |

---

## Deployment Checklist

- [ ] Backend deployed to Render (`https://resturant-saas.onrender.com`)
- [ ] Backend CORS configured for Vercel URL
- [x] Frontend environment files updated
- [x] `vercel.json` created
- [x] Frontend builds successfully (`npm run build`)
- [ ] Vercel account created and project connected
- [ ] Environment variables set in Vercel Dashboard
- [ ] First deployment successful
- [ ] API calls working from Vercel frontend
- [ ] QR codes updated to point to Vercel frontend
- [ ] Custom domain configured (optional)
- [ ] DNS records updated (if custom domain)

---

## Rollback Plan

If needed to revert to Render:

1. Restore `render.yaml` with frontend service
2. Restore `Procfile`, `build.sh`, `server.js`
3. Restore `.env.production` with Render URLs
4. Push to GitHub → Render auto-redeploys

---

## Next Steps

1. **Deploy Backend** (if not already done):
   - Ensure Render backend is running
   - Verify health check: `https://resturant-saas.onrender.com/api/health`

2. **Deploy Frontend to Vercel**:
   - Follow "Deployment to Vercel" section above
   - Verify all environment variables are set

3. **Test Application**:
   - Log in and create orders
   - Verify QR codes point to Vercel
   - Check kitchen dashboard updates
   - Verify analytics work

4. **Monitor**:
   - Check Vercel Analytics Dashboard
   - Monitor Render backend logs
   - Set up error tracking (Sentry recommended)

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Vite Docs**: https://vitejs.dev/guide/
- **React Router**: https://reactrouter.com/en/main
- **Render Docs**: https://render.com/docs

---

**Migration Date**: March 7, 2026  
**Status**: ✅ Ready for Deployment
