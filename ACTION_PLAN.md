# 🚀 ELK Production Setup - Action Plan

## Timeline: 30 Minutes Total

---

## Phase 1: Elastic Cloud Setup (5 minutes)

### 1.1: Create Account
- [ ] Go to https://cloud.elastic.co
- [ ] Click "Start free trial"
- [ ] Sign up with your email (no credit card needed)
- [ ] Create account

### 1.2: Create Deployment
- [ ] After login, click "Create deployment"
- [ ] Name: `truekin-prod`
- [ ] Region: Choose closest to your servers
- [ ] Click "Create deployment"
- [ ] Wait 2-3 minutes for initialization

### 1.3: Get Credentials
- [ ] Once ready, click your deployment
- [ ] Copy **Elasticsearch endpoint** (format: `https://xxxxx.cloud.es.io:9243`)
- [ ] Save **Username**: `elastic`
- [ ] Save **Password** (auto-generated)
- [ ] Store these credentials securely!

---

## Phase 2: Backend Configuration (5 minutes)

### 2.1: Update Environment Variables

In your project root, create/update `.env.production`:

```bash
# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ELK Configuration (COPY FROM ELASTIC CLOUD)
ELK_ENABLED=true
ELK_NODE=https://elastic:YOUR_PASSWORD@your-deployment-id.cloud.es.io:9243

# Your Existing Database Configs
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx

# Your Other Configs
SESSION_SECRET=your-secret
CORS_ORIGIN=https://your-domain.com
```

**Replace:**
- `YOUR_PASSWORD` with Elastic Cloud password
- `your-deployment-id` with your deployment ID
- Rest with your actual values

### 2.2: Verify Configuration
```bash
# Check .env file is correct
cat .env.production
```

---

## Phase 3: Build & Deploy (10 minutes)

### 3.1: Build Docker Image

```bash
# Build production image
npm run build
docker build -t truekin-backend:latest -f Dockerfile.production .

# Test locally (optional)
docker run -e ELK_ENABLED=false -p 3000:3000 truekin-backend:latest
```

### 3.2: Push to Registry

```bash
# Login (if needed)
docker login

# Tag and push
docker tag truekin-backend:latest your-registry/truekin-backend:latest
docker push your-registry/truekin-backend:latest
```

### 3.3: Deploy to Production

**Option A: Docker Compose (Recommended for simplicity)**

```bash
# Copy docker-compose.yml to your server
# Set environment variables
export ELK_NODE="https://elastic:password@xxxxx.cloud.es.io:9243"
export SUPABASE_URL="your-url"
export SUPABASE_KEY="your-key"

# Deploy
docker-compose -f docker-compose.yml up -d

# Check it's running
docker ps
docker logs truekin-backend-prod
```

**Option B: Kubernetes / Cloud Platform**

Use your platform's deployment interface to set the environment variables and deploy the image.

---

## Phase 4: Verification (5 minutes)

### 4.1: Check Application is Running

```bash
# Check logs
docker logs -f truekin-backend-prod

# Should see:
# ✅ Application started on port 3000
# ✅ ELK enabled
# ✅ Connected to Supabase
```

### 4.2: Verify Logs in Kibana

1. Go to Elastic Cloud dashboard
2. Click **"Open Kibana"**
3. Login with `elastic` / your password
4. Go to **"Discover"** (left sidebar)
5. You should see logs from your application

**Expected logs:**
- Event: `API_REQUEST` or `API_RESPONSE`
- Service: `truekin-backend`
- Timestamp: Recent (last few minutes)

### 4.3: Test with Real Request

```bash
# Make a request to your API
curl -X GET "https://your-api.com/v1/medicines" \
  -H "x-user-id: test-user" \
  -H "x-session-token: test-token"

# In Kibana, search for:
# fields.userId:test-user
# Should see the request logged!
```

---

## Phase 5: Create Monitoring Dashboards (5 minutes)

### 5.1: Create First Dashboard

In Kibana:
1. Go to **Dashboards** → **Create dashboard**
2. Add visualization: **Bar chart**
   - Metrics: Count
   - Breakdown: `fields.event.keyword`
   - Title: "API Events"
3. Add visualization: **Line chart**
   - Y: Average of `fields.duration`
   - X: Time
   - Title: "Response Times"
4. Save dashboard: "TrueKin - Medicines API"

### 5.2: Create Alert (Optional but Recommended)

In Kibana → Management → Alerts:
1. Create rule: "High Error Rate"
2. Condition: Count > 10 in 5 minutes
3. Filter: `level:error`
4. Action: Email notification
5. Save

---

## ✅ Success Criteria

When complete, you should have:

- [ ] Elastic Cloud deployment created and running
- [ ] Application deployed with ELK_ENABLED=true
- [ ] Logs appearing in Kibana (Discover tab)
- [ ] Can see real API requests in logs
- [ ] Error logs captured with full context
- [ ] Kibana dashboard created
- [ ] Can see request counts and response times
- [ ] Can identify slow requests
- [ ] Can identify errors

---

## 📊 What You Can Now Do

✅ **Monitor in real-time**
- See every API request
- Track request duration
- Monitor error rate
- Watch user activity

✅ **Debug faster**
- Search logs by requestId
- Follow complete request flow
- See step-by-step execution
- Access full error context

✅ **Optimize performance**
- Identify slow endpoints
- See pagination patterns
- Monitor database queries
- Track peak usage times

---

## 🔧 Troubleshooting

### Logs not appearing?
```bash
# Check ELK is enabled
docker logs truekin-backend-prod | grep "ELK"

# Verify connection
curl -X GET https://elastic:PASSWORD@your-endpoint.cloud.es.io:9243/_health

# Wait 2-5 seconds for logs to flush
```

### Kibana not accessible?
```bash
# Try clearing cache
# Restart deployment
docker-compose restart

# Check application logs
docker logs truekin-backend-prod
```

### Wrong environment variables?
```bash
# Update .env file
nano .env.production

# Restart application
docker-compose down
docker-compose up -d
```

---

## 📝 Important Files

- **ELK_PRODUCTION_SETUP.md** - Detailed setup guide
- **ELASTIC_CLOUD_QUICKSTART.md** - Step-by-step instructions
- **KIBANA_DASHBOARD_CONFIG.md** - Dashboard configs
- **PRODUCTION_DEPLOYMENT_CHECKLIST.md** - Full verification checklist

---

## 💡 Pro Tips

1. **Save credentials securely**
   - Use a password manager
   - Don't commit to Git
   - Store in secure environment variable service

2. **Test locally first (optional)**
   - Run with ELK_ENABLED=false
   - Verify application works
   - Then enable ELK for production

3. **Monitor first few hours**
   - Check logs are flowing correctly
   - Verify no errors appearing
   - Adjust alert thresholds if needed

4. **Scale gradually**
   - Start with Elastic Cloud default
   - Monitor usage
   - Upgrade only if needed

---

## 🎯 Next: After Completion

1. **Week 1**: Monitor logs daily
2. **Week 2**: Create additional dashboards
3. **Week 3**: Set up more alerts
4. **Week 4**: Analyze patterns and optimize

---

## ⏱️ Time Breakdown

| Phase | Time | Status |
|-------|------|--------|
| Elastic Cloud Setup | 5 min | Ready |
| Backend Config | 5 min | Ready |
| Build & Deploy | 10 min | Ready |
| Verification | 5 min | Ready |
| Dashboards | 5 min | Ready |
| **TOTAL** | **30 min** | **To do** |

---

## 🚀 You're Ready!

Everything is set up. Now it's just execution:

1. Create Elastic Cloud account
2. Update environment variables
3. Deploy your application
4. Verify logs in Kibana
5. Create dashboards
6. Start monitoring!

**Start now**: Go to https://cloud.elastic.co

---

## Support

If anything goes wrong:
1. Check troubleshooting section above
2. Review ELASTIC_CLOUD_QUICKSTART.md
3. Check application logs: `docker logs truekin-backend-prod`
4. Verify Elasticsearch connection: `curl $ELK_NODE/_health`

Let's get this done! 💪🚀
