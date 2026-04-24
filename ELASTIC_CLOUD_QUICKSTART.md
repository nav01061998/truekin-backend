# Elastic Cloud Quick Start - 5 Minutes

## Step 1: Create Elastic Cloud Account (2 minutes)

**URL**: https://cloud.elastic.co

### Actions:
1. Click "Start free trial"
2. Enter your email
3. Create password
4. Click "Create account"

**Note**: No credit card needed for 14-day trial

---

## Step 2: Create Elasticsearch Deployment (2 minutes)

After login, you'll see the deployment creation page:

1. **Select Region**: Choose closest to your servers (e.g., `us-west-1` for US, `eu-west-1` for EU)
2. **Choose Deployment Template**: Keep default "Elasticsearch"
3. **Deployment Name**: Enter `truekin-prod`
4. **Deployment Size**: Keep default (or reduce for testing)
5. Click **"Create deployment"**

⏳ Wait 2-3 minutes for deployment to initialize

---

## Step 3: Get Your Credentials (1 minute)

Once deployment is ready:

1. Go to your deployment dashboard
2. Click **"Copy endpoint"** - save this as your `ELK_NODE`
   - Format: `https://xxxxx.us-west-1.cloud.es.io:9243`
3. Copy **username**: `elastic` (default)
4. Copy **password**: (auto-generated, save this!)

**⚠️ Important**: Save these credentials securely!

---

## Step 4: Update Environment Variables

Create `.env.production` in your project root:

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ELK Configuration (from Elastic Cloud)
ELK_ENABLED=true
ELK_NODE=https://elastic:YOUR_PASSWORD@your-deployment-id.us-west-1.cloud.es.io:9243

# Database (existing)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx-your-key-xxxxx

# Other configs
SESSION_SECRET=your-session-secret
CORS_ORIGIN=https://your-frontend-domain.com
```

**Replace with your actual values:**
- `YOUR_PASSWORD` → Password from Elastic Cloud
- `your-deployment-id` → Your deployment ID from endpoint
- Rest of your existing configs

---

## Step 5: Build & Deploy

### Build Docker Image

```bash
# Build for production
npm run build

# Create Docker image
docker build -t truekin-backend:latest -f Dockerfile.production .

# Test locally with ELK disabled (optional)
docker run \
  -e NODE_ENV=production \
  -e ELK_ENABLED=false \
  -e PORT=3000 \
  -p 3000:3000 \
  truekin-backend:latest
```

### Push to Registry

```bash
# Login to your registry (Docker Hub, AWS ECR, etc.)
docker login

# Tag image
docker tag truekin-backend:latest your-registry/truekin-backend:latest

# Push
docker push your-registry/truekin-backend:latest
```

### Deploy to Production

**Option A: Docker Compose**

```yaml
# docker-compose.yml
version: '3.8'
services:
  truekin-backend:
    image: your-registry/truekin-backend:latest
    container_name: truekin-backend-prod
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      ELK_ENABLED: "true"
      ELK_NODE: "${ELK_NODE}"
      LOG_LEVEL: info
      SUPABASE_URL: "${SUPABASE_URL}"
      SUPABASE_KEY: "${SUPABASE_KEY}"
    restart: always
    healthcheck:
      test: curl -f http://localhost:3000/health || exit 1
      interval: 30s
      timeout: 10s
      retries: 3
```

**Deploy**:
```bash
# Create .env file on your server (or export variables)
export ELK_NODE="https://elastic:password@xxxxx.cloud.es.io:9243"
export SUPABASE_URL="your-url"
export SUPABASE_KEY="your-key"

# Deploy
docker-compose up -d
```

**Option B: Cloud Platform (AWS, GCP, Azure)**

Use their deployment interface to set environment variables and deploy the image.

---

## Step 6: Verify Logs in Kibana (1 minute)

Once application is running:

1. Go back to Elastic Cloud dashboard
2. Click **"Open Kibana"**
3. Login with `elastic` / your password

### Verify Logs Appear

In Kibana:
1. Click **"Discover"** (left menu)
2. You should see `truekin-logs-*` index
3. If not, create it:
   - Management → Data Views
   - Create: `truekin-logs-*`
   - Timestamp: `@timestamp`
4. You should see recent logs from your application

**Success!** Logs are flowing to Elasticsearch ✅

---

## Step 7: Create Kibana Dashboards

Now you have logs in Kibana. Create monitoring dashboards:

### Quick Dashboard Creation

1. Go to **Kibana → Dashboards**
2. Click **"Create dashboard"**
3. Click **"Add panels"**
4. Click **"Create visualization"**

### Dashboard 1: Medicines API Monitoring

**Visualization 1: Request Count**
- Type: Bar chart
- Metrics: Count
- Breakdown by: `fields.event.keyword`
- Filter: `service:truekin-backend AND (fields.event:MEDICINES_LIST_API_SUCCESS OR fields.event:MEDICINES_ADD_SUCCESS)`

**Visualization 2: Response Time**
- Type: Line chart
- Y-axis: Average of `fields.duration`
- X-axis: Time
- Filter: `service:truekin-backend AND fields.event:MEDICINES*`

**Visualization 3: Error Rate**
- Type: Metric
- Aggregation: Count
- Filter: `service:truekin-backend AND (fields.event:MEDICINES_ADD_ERROR OR fields.event:MEDICINES_LIST_API_FATAL_ERROR)`

### Dashboard 2: Documents API Monitoring

Similar setup for Documents API - follow same pattern with `DOCUMENTS_*` event filters

### Dashboard 3: System Health

- Request count by status code
- Error timeline
- Response time distribution
- Latest errors table

---

## Step 8: Test Everything Works

### Test 1: API Requests Logged

```bash
# Make a request to your API
curl -X GET "https://your-api.com/v1/medicines" \
  -H "x-user-id: test-user" \
  -H "x-session-token: test-token"
```

### Test 2: Check Kibana for Logs

1. Go to Kibana → Discover
2. Search: `fields.userId:test-user`
3. Should see your request logged with:
   - requestId
   - userId
   - event type (MEDICINES_LIST_API_SUCCESS)
   - duration
   - All step-by-step logs

### Test 3: Error Logging

```bash
# Test error by omitting auth header
curl -X GET "https://your-api.com/v1/medicines"
```

Check Kibana - should see 401 error logged with full error context

---

## Step 9: Set Up Alerts (Optional but Recommended)

In Kibana:

### Alert 1: High Error Rate
1. Go to **Management → Alerts and Actions**
2. Click **"Create rule"**
3. Condition: Error count > 10 in 5 minutes
4. Action: Email notification
5. Save

### Alert 2: Slow API
1. Create rule
2. Condition: Average duration > 1000ms
3. Action: Slack/Email
4. Save

---

## Verification Checklist

- [ ] Elastic Cloud account created
- [ ] Deployment created and initialized
- [ ] Credentials saved securely
- [ ] `.env.production` created with ELK_NODE
- [ ] Application built for production
- [ ] Image pushed to registry
- [ ] Application deployed with ELK_ENABLED=true
- [ ] Application is running and healthy
- [ ] Logs appear in Kibana (Discover tab)
- [ ] Index pattern `truekin-logs-*` created
- [ ] Test API call made and logged
- [ ] Error test done (missing auth header)
- [ ] Kibana dashboards created
- [ ] Can see:
  - [ ] Request counts
  - [ ] Response times
  - [ ] Error logs
  - [ ] User activity
  - [ ] Pagination details

---

## What You Can Now See in Kibana

✅ **Real-time request monitoring**
- Every API call logged with requestId
- Step-by-step execution flow
- Request duration
- User activity

✅ **Error tracking**
- All errors logged with full context
- Stack traces available
- Error patterns identifiable

✅ **Performance metrics**
- Response time per endpoint
- Slowest requests
- Pagination patterns
- Database query times

✅ **User activity**
- User request counts
- Login/logout events
- Failed auth attempts
- Session validation issues

✅ **System health**
- API availability
- Error rate trends
- Resource usage
- Database health

---

## Troubleshooting

### Logs Not Appearing in Kibana?

1. **Check ELK_ENABLED**:
   ```bash
   docker logs truekin-backend-prod | grep "ELK"
   ```

2. **Verify endpoint connectivity**:
   ```bash
   curl -X GET https://elastic:YOUR_PASSWORD@your-deployment.cloud.es.io:9243/_health
   ```

3. **Check application logs**:
   ```bash
   docker logs truekin-backend-prod | tail -50
   ```

4. **Wait for logs to flush** (max 2-5 seconds)

5. **Verify index exists** in Kibana:
   - Go to Management → Data Views
   - Should see `truekin-logs-*`

### Elasticsearch Connection Error?

- Verify ELK_NODE URL is correct
- Check password doesn't have special characters (may need escaping)
- Verify deployment is running in Elastic Cloud console
- Check firewall/security groups allow HTTPS to Elasticsearch

### Kibana Access Issues?

- Clear browser cache
- Try incognito/private mode
- Verify username/password
- Check internet connection

---

## Next Steps

1. ✅ **Now**: Follow this guide to set up Elastic Cloud
2. **5 min**: Deploy your backend with ELK_ENABLED=true
3. **10 min**: Verify logs in Kibana
4. **15 min**: Create monitoring dashboards
5. **20 min**: Test API calls and verify logging
6. **Done**: Monitor production traffic in real-time!

---

## Elastic Cloud Resources

- **Dashboard**: https://cloud.elastic.co
- **Documentation**: https://www.elastic.co/guide
- **Support**: Available in Elastic Cloud console

---

## Key Points

✅ **Free for 14 days** - No credit card needed  
✅ **Production-grade** - Enterprise security built-in  
✅ **Automatic backups** - Data protected  
✅ **Easy scaling** - Handle any traffic volume  
✅ **Full Kibana included** - Complete visualization  

---

## Cost After Trial

- **14-day free trial**: $0
- **After trial**: ~$15-50/month depending on data volume
- **Easy to migrate**: To self-hosted Docker if you want to save costs
- **Cancel anytime**: No long-term commitment

---

## You're Ready! 🚀

Your backend is already fully instrumented with logging. This guide just connects it to Elastic Cloud for visualization and monitoring.

**Time to complete**: 5-10 minutes  
**Effort level**: Very easy  
**Result**: Production monitoring dashboard with real-time logs

Let's go! 💪
