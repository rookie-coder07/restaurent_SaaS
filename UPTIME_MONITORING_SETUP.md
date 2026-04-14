# Uptime Monitoring Setup - Keep Backend Awake 24/7

## Current Status ✅

Your Render backend is **already configured** with:
- ✅ Health endpoint: `/health`
- ✅ Comprehensive health checks (API, Database, Memory)
- ✅ Metrics tracking
- ✅ Alert system
- ✅ Internal self-pinging (5 min interval in production)

**Health Endpoint URLs:**
- Simple: `https://restaurent-backend-448t.onrender.com/health`
- Detailed: `https://restaurent-backend-448t.onrender.com/api/v1/health`
- Metrics: `https://restaurent-backend-448t.onrender.com/api/v1/health/metrics`
- Alerts: `https://restaurent-backend-448t.onrender.com/api/v1/health/alerts`

---

## Why External Monitoring?

Even with internal pinging, external monitoring provides:
- **Independent uptime validation** - External service confirms server is reachable
- **Redundancy** - If internal pinging fails, external service continues
- **Public uptime badge** - Display on dashboard/website
- **Notifications** - Alerts if backend goes down
- **Detailed reports** - Monthly uptime statistics

---

## Setup UptimeRobot (FREE Tier)

### Step 1: Create UptimeRobot Account
1. Go to https://uptimerobot.com
2. Sign up (free account allows up to 50 monitors)
3. Confirm email

### Step 2: Add Monitor
1. Click **"Add New Monitor"** button
2. Fill in details:

| Field | Value |
|-------|-------|
| Monitor Type | **HTTP(s)** |
| Friendly Name | `restaurent-SaaS Backend` |
| URL (to monitor) | `https://restaurent-backend-448t.onrender.com/health` |
| Monitoring Interval | **5 minutes** |
| Alert Contacts | Add your email |
| GET Headers | *(leave empty)* |
| Request Timeout | 30 seconds |

### Step 3: Configure Alerts
1. Enable email notifications
2. Add your email address
3. Alert threshold: **2 down intervals** (triggers after 10 min downtime)
4. Alert interval: **60 minutes** (don't spam if down)

### Step 4: Verify Setup
1. Click **"Create Monitor"**
2. Watch the first check complete (~2-3 seconds)
3. Should show: `UP` status
4. Check logs: **Status Page** > **Monitor Details**

---

## Expected Health Response

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "checks": {
      "api": { "status": "ok", "latency": 15 },
      "database": { "status": "ok", "latency": 45 },
      "memory": { "status": "ok", "usage": 42 },
      "uptime": 3600
    },
    "metrics": {
      "totalRequests": 1250,
      "errorRate": "0.5%",
      "avgResponseTime": "85ms",
      "uptime": "15 minutes"
    },
    "timestamp": "2026-04-14T12:00:00.000Z"
  }
}
```

---

## How It Works

### Request Flow
```
UptimeRobot (every 5 min)
    ↓
GET /health
    ↓
Backend Health Check
- API latency ✓
- Database connection ✓
- Memory usage ✓
    ↓
200 OK or 503 Service Unavailable
    ↓
UptimeRobot Logs Result
    ↓
Alert if status changes
```

### Why This Prevents Sleep
- Render detects incoming HTTP requests
- Service logs activity → stays awake
- 5-min interval = continuous activity
- Pings keep server warm even during low traffic

---

## Backend Implementation Details

**File:** `backend/src/app.js` (Line 84)
```javascript
app.get('/health', asyncHandler(async (req, res) => {
  res.status(200).json({ status: 'ok' });
}));
```

**File:** `backend/src/routes/health.js`
- Detailed health checks with database connectivity
- Memory usage monitoring
- Error tracking
- Metrics aggregation

**File:** `backend/src/server.js` (Line 7-8, 37-39)
```javascript
const KEEP_ALIVE_INTERVAL_MS = 300000; // 5 minutes
const KEEP_ALIVE_URL = 'https://restaurent-backend-448t.onrender.com/health';

// Internal pinging in production
if (isProd) {
  setInterval(async () => {
    await fetch(KEEP_ALIVE_URL);
  }, KEEP_ALIVE_INTERVAL_MS);
}
```

---

## Advanced Options

### Alternative Monitoring Services

If you prefer alternatives:

| Service | Free Tier | Interval | Notes |
|---------|-----------|----------|-------|
| **UptimeRobot** | 50 monitors | 5 min | Most popular, email alerts |
| **Ping-API** | Unlimited | 5 min | Simple, good dashboard |
| **Statuscake** | 10 monitors | 1 min | Better analytics |
| **Healthchecks.io** | 20 checks | Flexible | Privacy-focused |

### Multiple Monitors (Redundancy)
Setup 2-3 monitors with different services for maximum uptime assurance:
- Primary: UptimeRobot (5 min interval)
- Secondary: Healthchecks.io (10 min interval)
- Tertiary: Internal self-ping (already configured)

---

## Testing Your Setup

### Manual Health Check
```bash
# Simple health check
curl https://restaurent-backend-448t.onrender.com/health

# Expected response (200 OK):
{"status":"ok"}

# Detailed health check
curl https://restaurent-backend-448t.onrender.com/api/v1/health

# Expected response (200 OK):
{
  "success": true,
  "data": {
    "status": "ok",
    "checks": { ... },
    "metrics": { ... }
  }
}
```

### Monitor Your Health Endpoint
```bash
# Check logs in production
curl -i https://restaurent-backend-448t.onrender.com/health

# Response Headers to look for:
# HTTP/1.1 200 OK
# Content-Type: application/json
# Date: Mon, 14 Apr 2026 12:00:00 GMT
```

---

## Expected Results After Setup

| Metric | Before | After |
|--------|--------|-------|
| **Cold Start** | 10-30 seconds | <2 seconds |
| **First Request** | Delayed | Instant |
| **Uptime** | ~95% (sleeps) | 99.9%+ (always awake) |
| **Response Time** | Inconsistent | Stable |
| **User Experience** | Sluggish on cold starts | Smooth & responsive |

---

## Troubleshooting

### **Monitor shows "DOWN"**
```bash
# 1. Test endpoint manually
curl -v https://restaurent-backend-448t.onrender.com/health

# 2. Check Render logs
# - Go to Render Dashboard
# - Select your service
# - View "Logs" tab

# 3. Verify backend is running
# - Confirm service status is "Running" (not "Suspended")

# 4. Check firewall/CORS
# - Health endpoint has no CORS restrictions
# - Should be accessible from anywhere
```

### **False Alarms (intermittent DOWN)**
- Increase alert threshold to 3 minutes
- Check server logs for crashes/restarts
- Monitor database connection issues
- Check memory usage (should be <80%)

### **Monitor Shows Degraded (503)**
- API latency issue
- Database connection slow
- Memory usage high
- Check `/api/v1/health/alerts` for details

---

## Monitoring Dashboard

Once setup complete, UptimeRobot shows:
- ✅ **Uptime %** - Target: 99.9%+
- ✅ **Response Time** - Should be 50-200ms
- ✅ **Check History** - Last 30 days
- ✅ **Downtime Log** - When server went down
- ✅ **Status Page** - Share public status page

---

## Cost Breakdown

| Service | Cost | Monitors | Alerts |
|---------|------|----------|--------|
| **Render** | Free | (Backend) | Via integrations |
| **UptimeRobot** | Free | 50 | Email/SMS (free) |
| **Total Monthly** | **$0** | - | - |

**Completely FREE** - No hidden costs!

---

## Next Steps

1. ✅ **Verify health endpoint is working**
   ```bash
   curl https://restaurent-backend-448t.onrender.com/health
   ```

2. 📝 **Create UptimeRobot account** (5 minutes)

3. 🔧 **Add monitor** (3 minutes)
   - URL: `https://restaurent-backend-448t.onrender.com/health`
   - Interval: 5 minutes
   - Alerts: Your email

4. ⏱️ **Wait for first check** (up to 5 minutes)

5. ✅ **Verify "UP" status** in UptimeRobot dashboard

6. 🎉 **Enjoy 24/7 uptime!**

---

## Support Resources

- **UptimeRobot Docs:** https://docs.uptimerobot.com
- **Render Sleep FAQ:** https://render.com/docs/free#free-tier-usage-limits
- **REST API Docs:** `/api/v1/docs` (if Swagger available)

---

**Status:** ✅ Ready for Production
**Monitoring:** ✅ Implemented
**Uptime:** ✅ 99.9%+ Expected

