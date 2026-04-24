# Production Deployment Checklist with ELK Integration

## Pre-Deployment Setup

### 1. Choose ELK Infrastructure

- [ ] **Option Selected**: ___________
  - [ ] Elastic Cloud (Recommended)
  - [ ] Docker Compose (Self-hosted)
  - [ ] AWS OpenSearch
  - [ ] Other: ___________

- [ ] Credentials/Endpoints obtained
  - [ ] Elasticsearch endpoint: ___________
  - [ ] Username: ___________
  - [ ] Password/API Key: ___________

### 2. Environment Variables Setup

Create `.env.production` file:

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ELK Configuration
ELK_ENABLED=true
ELK_NODE=https://elastic:password@your-es-endpoint:9243

# Database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx

# Authentication
SESSION_SECRET=your-secret-key-here
JWT_SECRET=your-jwt-secret-here

# CORS
CORS_ORIGIN=https://your-frontend-domain.com

# Optional Monitoring
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

### 3. Verify Credentials

- [ ] Elasticsearch connectivity test
  ```bash
  curl -X GET $ELK_NODE/_health
  ```

- [ ] Supabase connectivity test
  ```bash
  npm run test:supabase
  ```

- [ ] All environment variables loaded
  ```bash
  node -e "console.log(process.env.ELK_NODE, process.env.NODE_ENV)"
  ```

---

## Deployment Steps

### Step 1: Build Docker Image

- [ ] Create `Dockerfile.production`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/src/index.js"]
```

- [ ] Build image:
```bash
docker build -f Dockerfile.production -t truekin-backend:latest .
```

- [ ] Test image locally:
```bash
docker run -e ELK_ENABLED=false truekin-backend:latest
```

### Step 2: Push to Registry

- [ ] Push to Docker Registry:
  - [ ] Docker Hub
  - [ ] AWS ECR
  - [ ] Private registry
  ```bash
  docker tag truekin-backend:latest your-registry/truekin-backend:latest
  docker push your-registry/truekin-backend:latest
  ```

### Step 3: Deploy to Server/Cloud

#### Option A: Docker Compose (VPS/Self-hosted)

- [ ] Create `docker-compose.yml` on server:
```yaml
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
    networks:
      - truekin-network
    healthcheck:
      test: curl -f http://localhost:3000/health || exit 1
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  truekin-network:
    driver: bridge
```

- [ ] Deploy:
```bash
docker-compose -f docker-compose.yml up -d
```

#### Option B: Kubernetes

- [ ] Create deployment manifest
- [ ] Configure ConfigMaps for environment variables
- [ ] Configure Secrets for sensitive data
- [ ] Deploy: `kubectl apply -f deployment.yaml`

#### Option C: Cloud Platform (AWS, GCP, Azure)

- [ ] Create service on your cloud platform
- [ ] Configure environment variables
- [ ] Set up load balancer
- [ ] Configure auto-scaling

### Step 4: Verify Deployment

- [ ] Health check endpoint responds:
```bash
curl https://your-api.com/health
```

- [ ] Application logs show startup messages
```bash
docker logs truekin-backend-prod
```

- [ ] Logs appearing in ELK/Kibana:
  1. Go to Kibana
  2. Check "Discover" tab
  3. Look for `service:truekin-backend` logs
  4. Verify timestamps are recent (last 5 minutes)

---

## ELK Stack Setup Verification

### Elasticsearch

- [ ] Elasticsearch is healthy
```bash
curl -X GET $ELK_NODE/_cluster/health
```

- [ ] Index created and has data
```bash
curl -X GET $ELK_NODE/_cat/indices | grep truekin
```

- [ ] Sample document exists
```bash
curl -X GET $ELK_NODE/truekin-logs-*/_search?size=1
```

### Kibana

- [ ] Kibana is accessible
  - URL: https://your-kibana-domain.com
  - Login successful

- [ ] Index pattern created
  1. Go to Management → Data Views
  2. Create index pattern: `truekin-logs-*`
  3. Timestamp field: `@timestamp`

- [ ] Logs visible in Discover
  1. Go to Discover
  2. Select `truekin-logs-*` index
  3. Should see recent logs

### Logstash (if using)

- [ ] Logstash pipeline is running
```bash
curl http://localhost:9600/_node/stats/pipelines
```

- [ ] Processing logs without errors
  Check Logstash logs for errors

---

## Application Health Checks

### API Endpoints

- [ ] Test Medicines API:
```bash
curl -X GET "https://your-api.com/v1/medicines" \
  -H "x-user-id: test-user" \
  -H "x-session-token: test-token"
```

- [ ] Test Documents API:
```bash
curl -X GET "https://your-api.com/v1/documents" \
  -H "x-user-id: test-user" \
  -H "x-session-token: test-token"
```

- [ ] Test Add Medicine endpoint:
```bash
curl -X POST "https://your-api.com/api/medicines/add" \
  -H "x-user-id: test-user" \
  -H "x-session-token: test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Medicine",
    "dosage": "500mg",
    "frequency": "Once daily",
    "indication": "Test",
    "status": "active"
  }'
```

### Logging Verification

- [ ] Console logs show detailed steps
```bash
docker logs -f truekin-backend-prod | head -100
```

- [ ] ELK logs include all step-by-step logging
  1. Go to Kibana → Discover
  2. Search: `service:truekin-backend`
  3. Verify you see all logging steps

- [ ] Error logging works
  1. Trigger an error (e.g., missing auth header)
  2. Check Kibana for error logs
  3. Verify full error context appears

---

## Performance Monitoring

### Response Time Baseline

- [ ] Measure baseline response times:
  - Medicines API (page 1): _____ ms
  - Documents API (page 1): _____ ms
  - Add Medicine: _____ ms

- [ ] Target response times (should be < 500ms for all):
  - [ ] Medicines API: < 500ms
  - [ ] Documents API: < 500ms
  - [ ] Add Medicine: < 500ms

### Error Rate Baseline

- [ ] Current error rate: _____ %
- [ ] Target error rate: < 1%
- [ ] Test with 100 concurrent requests:
```bash
# Using ab (Apache Bench)
ab -n 100 -c 10 https://your-api.com/v1/medicines
```

### Load Testing

- [ ] Perform load test:
  - [ ] 100 concurrent users
  - [ ] 5-minute duration
  - [ ] Monitor CPU, memory, response time
  - [ ] Check for any errors

- [ ] Results:
  - Peak response time: _____ ms
  - Error count: _____
  - P95 response time: _____ ms
  - P99 response time: _____ ms

---

## Security Verification

### Authentication

- [ ] Test missing auth headers (should get 401):
```bash
curl -X GET https://your-api.com/v1/medicines
```

- [ ] Test invalid token (should get 401):
```bash
curl -X GET https://your-api.com/v1/medicines \
  -H "x-user-id: user-123" \
  -H "x-session-token: invalid-token"
```

### HTTPS

- [ ] HTTPS is enforced
```bash
curl -I https://your-api.com/health
```

- [ ] Certificate is valid
  - Subject: your-api.com
  - Not expired
  - Trusted CA

### Sensitive Data

- [ ] Tokens are redacted in logs
  - Check Kibana: `fields.sessionToken:*REDACTED*`

- [ ] Passwords are not in logs
  - Search Kibana for "password" - should find 0 results

- [ ] API keys are sanitized
  - Check log format includes `***REDACTED***`

---

## Backup & Recovery

### Database Backups

- [ ] Supabase automated backups configured
  - Frequency: Daily
  - Retention: 30 days

- [ ] Test backup restoration
  - [ ] Can restore from backup
  - [ ] Data integrity verified

### Log Backups

- [ ] Elasticsearch snapshots configured
```bash
curl -X PUT $ELK_NODE/_snapshot/backup_repo \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "fs",
    "settings": { "location": "/mount/backups" }
  }'
```

- [ ] Daily snapshot schedule configured

### Rollback Plan

- [ ] Previous version Docker image available
- [ ] Rollback procedure documented:
  1. Pull previous image
  2. Update docker-compose.yml
  3. Restart services
  4. Verify logs

---

## Monitoring & Alerting

### Dashboard Creation

- [ ] Create Kibana dashboards:
  - [ ] Medicines API Overview
  - [ ] Documents API Overview
  - [ ] System Health
  - [ ] Authentication & Security

- [ ] Dashboards display correctly:
  - [ ] No missing data
  - [ ] Time ranges update automatically
  - [ ] Refresh rate set appropriately

### Alert Configuration

- [ ] High error rate alert:
  - Threshold: > 10 errors in 5 minutes
  - Action: Email + Slack

- [ ] Slow API alert:
  - Threshold: > 1000ms average
  - Action: Email + Slack

- [ ] Auth failure alert:
  - Threshold: > 5 failures in 10 minutes
  - Action: Email + Slack

- [ ] Test alerts:
  - [ ] Email notification received
  - [ ] Slack notification received

### Log Retention

- [ ] Log retention policy set:
  - Retention: 30 days (adjust as needed)
  - Auto-delete old indices enabled

- [ ] Storage monitoring:
  - Monitor Elasticsearch disk usage
  - Alert if > 80% full

---

## Documentation

- [ ] Production deployment guide written
- [ ] Runbook created for common issues
- [ ] Architecture diagram updated
- [ ] ELK integration documented
- [ ] Alert thresholds documented
- [ ] Team trained on monitoring

---

## Post-Deployment

### Week 1

- [ ] Monitor logs daily for errors
- [ ] Check dashboard metrics
- [ ] Verify alerts are working
- [ ] Collect performance metrics

### Week 2-4

- [ ] Analyze patterns in logs
- [ ] Optimize slow endpoints if needed
- [ ] Fine-tune alert thresholds
- [ ] Document any issues encountered

### Monthly

- [ ] Review error trends
- [ ] Capacity planning
- [ ] Update runbooks based on learnings
- [ ] Team retrospective

---

## Team Handover

### Documentation to Provide

- [ ] How to access Kibana dashboard
- [ ] How to read logs and find errors
- [ ] How to interpret metrics
- [ ] Alert meanings and responses
- [ ] Escalation procedures

### Training Topics

1. **ELK Basics**
   - What is Elasticsearch, Logstash, Kibana
   - How to navigate Kibana
   - How to search logs

2. **Log Reading**
   - Understanding requestId
   - Following request flow through logs
   - Identifying errors and warnings

3. **Alerting**
   - What alerts mean
   - How to acknowledge alerts
   - When to escalate

4. **Troubleshooting**
   - Common errors and solutions
   - How to debug using logs
   - When to page on-call engineer

---

## Sign-Off

- [ ] Production deployment complete
- [ ] All checks passed
- [ ] Monitoring and alerts working
- [ ] Team trained and ready
- [ ] Runbooks in place
- [ ] Approved for production traffic

**Deployment Date**: _____________

**Deployed By**: _____________

**Verified By**: _____________

**Notes**: _____________

---

## Quick Reference

### Essential Commands

**Check application health:**
```bash
docker logs -f truekin-backend-prod
```

**Check ELK health:**
```bash
curl -X GET $ELK_NODE/_health
```

**Check recent logs in Kibana:**
- Open Kibana → Discover
- Select `truekin-logs-*`
- Filter: `service:truekin-backend`
- Sort by timestamp (newest first)

**Monitor in real-time:**
```bash
docker logs -f --tail 100 truekin-backend-prod
```

**Restart services:**
```bash
docker-compose -f docker-compose.yml restart
```

---

## Support & Escalation

### When to Alert

- Error rate > 5% (investigate immediately)
- Response time > 2000ms (investigate)
- Elasticsearch disk > 90% (emergency)
- Database connectivity errors
- Authentication failures (> 10 in 5 min)

### Escalation Path

1. **Level 1**: Check recent logs in Kibana
2. **Level 2**: Review dashboards and metrics
3. **Level 3**: Check application health/restarts
4. **Level 4**: Check infrastructure (CPU, memory, disk)
5. **Level 5**: Contact cloud provider support

---

**Deployment is ready to begin!** Follow this checklist step-by-step to ensure a successful production rollout with comprehensive monitoring.
