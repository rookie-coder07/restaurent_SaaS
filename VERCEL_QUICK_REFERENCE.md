# Quick Reference: Render → Vercel Migration

## Files Changed

### Removed/Updated Render-Specific Files

| File | Status | Notes |
|------|--------|-------|
| `render.yaml` | ⚠️ Deprecated | Kept in repo with deprecation notice |
| `Procfile` | ⚠️ Deprecated | Vercel doesn't use Procfile |
| `build.sh` | ⚠️ Deprecated | Vercel runs `npm run build` |
| `server.js` | ⚠️ Deprecated | Vercel serves static files automatically |

### Created New Files

| File | Purpose |
|------|---------|
| `frontend/vercel.json` | Vercel deployment configuration |

### Updated Files

| File | Changes |
|------|---------|
| `frontend/.env.example` | Added comprehensive comments for local dev |
| `frontend/.env.production` | Updated URLs to Vercel frontend and Render API |
| `backend/src/app.js` | ⚠️ TODO: Update CORS to include Vercel URL |

---

## Key URLs

### Before (Render)
- Frontend: `https://resturant-saas-1.onrender.com`
- Backend: `https://resturant-saas.onrender.com/api`

### After (Vercel + Render)
- Frontend: `https://restromaxsaas.vercel.app`
- Backend: `https://resturant-saas.onrender.com/api`
- QR Codes: Now point to `https://restromaxsaas.vercel.app/menu?table=X`

---

## Build & Dependencies

### New Dependency
- **terser**: Installed as dev dependency for minification

### Build Output
- **Directory**: `dist/`
- **Size**: ~750KB (before gzip)
- **Time**: ~18 seconds
- **Status**: ✅ Building successfully

---

## Environment Variables (Production)

For Vercel Dashboard, set:

```
VITE_API_BASE_URL = https://resturant-saas.onrender.com/api
VITE_FRONTEND_URL = https://restromaxsaas.vercel.app
VITE_CLOUDINARY_CLOUD_NAME = dof234wuj
VITE_APP_NAME = Restaurant Management SaaS
VITE_SUPABASE_URL = https://pzjjuuqwpbfbfosgblzv.supabase.co
VITE_SUPABASE_ANON_KEY = sb_publishable_h2HoLV5oiZpBIaMK4EQHiQ_UY6HjMZn
```

---

## Deployment Steps

1. **Create Vercel Account**: https://vercel.com
2. **Import GitHub Repository**: vercel.com/new
3. **Set Build Command**: `npm run build`
4. **Set Output Directory**: `dist`
5. **Set Root Directory**: `frontend/`
6. **Add Environment Variables**: (see above)
7. **Deploy**: Click Deploy button
8. **Update Backend CORS**: Add Vercel URL to allowed origins
9. **Test**: Verify API calls and QR codes work

---

## Verification Checklist

### Frontend Build
- [x] `npm run build` succeeds
- [x] `dist/index.html` created
- [x] `dist/assets/` contains JS and CSS

### API Configuration  
- [x] `frontend/src/services/api.js` uses `VITE_API_BASE_URL`
- [x] Environment file has correct backend URL
- [ ] Backend CORS allows Vercel origin (needs update)

### Routing
- [x] SPA routing configured in `vercel.json`
- [x] All routes fallback to `index.html`

### Deployment
- [ ] Project connected to Vercel
- [ ] Environment variables set
- [ ] Initial deployment successful
- [ ] API calls working from Vercel

---

## Troubleshooting

### Build Error: "terser not found"
✅ Fixed: `npm install --save-dev terser`

### API Returns 404
🔍 Check:
1. Backend is running at `https://resturant-saas.onrender.com`
2. Environment variable `VITE_API_BASE_URL` is correct
3. Backend CORS includes Vercel URL

### Routes Return 404
✅ Fixed: `vercel.json` has SPA rewrite rule

### Static Assets 404
🔍 Check:
1. `vite.config.js` has `outDir: 'dist'`
2. `dist/` folder exists with files
3. `vercel.json` has correct `outputDirectory`

---

## Next Actions

1. ⚠️ **Backend**: Update CORS in `backend/src/app.js`
   ```javascript
   origin: ['https://restromaxsaas.vercel.app', 'http://localhost:5173']
   ```

2. ⚠️ **QR Codes**: Update frontend URL in QR generation
   ```javascript
   const baseUrl = 'https://restromaxsaas.vercel.app'; // Or from env var
   ```

3. ✅ **Deploy to Vercel**: Follow full guide at `VERCEL_MIGRATION_GUIDE.md`

4. ⚠️ **Monitor**: Check Vercel analytics and Render logs for issues

---

## Quick Commands

```bash
# Local development
npm run dev          # Start dev server on :5173

# Build and test
npm run build        # Build for production
npm run preview      # Preview production build on :4173

# Testing
npm test             # Run tests
npm run test:e2e     # Run E2E tests with Playwright
```

---

**For detailed information, see: `VERCEL_MIGRATION_GUIDE.md`**
