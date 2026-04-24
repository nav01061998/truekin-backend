# ELK Integration - Complete Setup Guide

## ✅ COMPLETE: Production ELK Setup with Kibana Monitoring

All documentation and infrastructure configurations are ready for integrating ELK with your production environment.

---

## What's Included

### 1. **ELK_PRODUCTION_SETUP.md** (424 lines)
Complete guide for setting up ELK in production with three deployment options:

**Option 1: Elastic Cloud (RECOMMENDED) ⭐**
- Easiest and fastest (5 minutes)
- No infrastructure management
- 14-day free trial (no credit card needed)
- Production-grade security built-in
- Cost: ~$15-50/month after trial

**Option 2: Self-Hosted Docker Compose**
- Full control and customization
- Cost-effective for small deployments
- Runs on your own server/VPS
- Detailed production docker-compose included

**Option 3: AWS Managed OpenSearch**
- For AWS ecosystem users
- Auto-scaling and VPC integration
- IAM authentication support
- Integration with AWS services

### 2. **KIBANA_DASHBOARD_CONFIG.md** (455 lines)
Pre-configured Kibana dashboards for monitoring your APIs:

**4 Production Dashboards:**
1. **Medicines API Monitoring** - Request count, response time, errors, pagination patterns
2. **Documents API Monitoring** - Prescriptions/reports fetch count, status codes
3. **System Health & Performance** - API latency by endpoint, error timeline, total requests
4. **Authentication & Security** - Login success rate, failed attempts, invalid sessions

**Additional Resources:**
- KQL (Kibana Query Language) examples for debugging
- Saved search configurations
- Alert configuration templates
- Dashboard best practices

### 3. **PRODUCTION_DEPLOYMENT_CHECKLIST.md** (587 lines)
Complete deployment checklist covering:

- Pre-deployment setup verification
- Deployment steps for all platforms
- ELK stack health verification
- Application health checks
- Performance monitoring baselines
- Security verification
- Backup and recovery procedures
- Monitoring and alerting configuration
- Post-deployment validation
- Team handover procedures

---

## Quick Start - 3 Different Paths

### Path 1: Fastest (Elastic Cloud) - 5 Minutes ⭐

```bash
# 1. Go to https://cloud.elastic.co
# 2. Sign up for free (no credit card for 14 days)
# 3. Create deployment
# 4. Copy your endpoint from Elastic Cloud
# 5. Create .env.production with:
ELK_ENABLED=true
ELK_NODE=https://elastic:PASSWORD@your-es-instance.cloud.es.io:9243
NODE_ENV=production
LOG_LEVEL=info

# 6. Deploy your application
npm run build && docker build -t truekin:latest .
docker push your-registry/truekin:latest

# 7. Logs automatically flow to Kibana
# 8. Access Kibana dashboard
```

### Path 2: Self-Hosted Docker - 15 Minutes

```bash
# 1. Use docker-compose.production.yml from ELK_PRODUCTION_SETUP.md
# 2. Start ELK stack
docker-compose -f docker-compose.production.yml up -d

# 3. Set environment variables
ELK_ENABLED=true
ELK_NODE=http://elasticsearch:9200
NODE_ENV=production

# 4. Deploy your backend
docker-compose up -d

# 5. Access Kibana at http://localhost:5601
```

### Path 3: AWS OpenSearch

```bash
# 1. Create OpenSearch domain in AWS Console
# 2. Get endpoint: https://xxxxx.aoss.amazonaws.com
# 3. Set environment variable:
ELK_NODE=https://your-opensearch-endpoint

# 4. Deploy your application
# 5. Logs flow to AWS OpenSearch
# 6. View in OpenSearch Dashboards
```

---

## What Gets Monitored

Your application is already instrumented with comprehensive logging:

### Medicines API Logging
```
Step 1: Extract auth from headers
Step 2: Validate session
Step 3: Parse query parameters
Step 4: Fetch medicines list
Step 5: Return response

Service layer (8 steps):
  Step 1: Parse pagination parameters
  Step 2: Fetch active medicines
  Step 3: Transform data
  Step 4: Apply pagination
  Step 5: Fetch past medicines
  Step 6: Transform data
  Step 7: Group by date
  Step 8: Build response
```

### Documents API Logging
Similar 5-step route + service logging with full error context

### Key Metrics Captured
- ✅ Request ID for complete tracing
- ✅ User ID for activity tracking
- ✅ Response duration for performance
- ✅ Pagination details (page, limit, offset, hasMore)
- ✅ Full error context (type, message, stack)
- ✅ Database operation details
- ✅ Step-by-step execution flow

---

## Kibana Dashboards Provided

### Medicines API Dashboard
Shows:
- API request count by endpoint
- Response time distribution (target: < 500ms)
- Error rate over time (target: < 1%)
- Top users by request count
- Pagination patterns (how many users access each page)

### Documents API Dashboard
Shows:
- Prescriptions vs reports fetch count
- Average fetch time
- Prescriptions count distribution
- Reports sections breakdown
- Status code distribution

### System Health Dashboard
Shows:
- API response times by endpoint
- Error events timeline
- Request count by environment
- Total requests metric
- Error rate percentage
- Latest errors table

### Security Dashboard
Shows:
- Login success rate (target: > 99%)
- Failed login attempts timeline
- Invalid session attempts
- Top users by request count
- Session validation failure patterns

---

## Environment Variables

### For Elastic Cloud
```bash
ELK_ENABLED=true
ELK_NODE=https://elastic:your-password@your-deployment-id.cloud.es.io:9243
NODE_ENV=production
LOG_LEVEL=info
```

### For Docker Self-Hosted
```bash
ELK_ENABLED=true
ELK_NODE=http://elasticsearch:9200
NODE_ENV=production
LOG_LEVEL=info
```

### For AWS OpenSearch
```bash
ELK_ENABLED=true
ELK_NODE=https://your-opensearch-endpoint.aoss.amazonaws.com
NODE_ENV=production
LOG_LEVEL=info
```

---

## Production Monitoring Flow

```
Application (Medicines API, Documents API)
    ↓
Winston Logger (src/lib/logger.ts)
    ↓
Console Output (immediate debugging)
    ↓
File Logs (logs/error.log, logs/combined.log)
    ↓
Elasticsearch Transport (winston-elasticsearch)
    ↓
Elasticsearch Cluster
    ↓
Kibana Dashboard
    ↓
Monitoring & Alerting
    ↓
Slack/Email Notifications (if configured)
```

---

## Alerts Configuration

### Alert 1: High Error Rate
- **Threshold**: > 10 errors in 5 minutes
- **Action**: Email + Slack notification
- **Response**: Check latest errors in Kibana

### Alert 2: Slow API Response
- **Threshold**: Average response time > 1000ms
- **Action**: Slack notification
- **Response**: Check slow endpoints dashboard

### Alert 3: Authentication Failures
- **Threshold**: > 5 failed logins in 10 minutes
- **Action**: Email notification
- **Response**: Investigate suspicious activity

### Alert 4: Database Errors
- **Threshold**: > 3 database errors in 5 minutes
- **Action**: Slack + PagerDuty
- **Response**: Check database connectivity

---

## Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time | < 500ms | > 1000ms |
| Error Rate | < 1% | > 5% |
| Login Success Rate | > 99% | < 95% |
| Database Query Time | < 100ms | > 500ms |
| Elasticsearch Disk | < 80% | > 90% |
| Log Latency | < 2s | > 5s |

---

## Deployment Checklist

Before going live:

- [ ] ELK infrastructure chosen and set up
- [ ] Elasticsearch connectivity verified
- [ ] Environment variables configured
- [ ] Application built and tested locally
- [ ] Application deployed to production
- [ ] Logs appearing in Kibana (within 2 seconds)
- [ ] Kibana dashboards created
- [ ] Alerts configured and tested
- [ ] Team trained on log reading
- [ ] Runbooks created for common issues
- [ ] Backup procedures tested
- [ ] Performance baselines established

---

## Cost Analysis

### Elastic Cloud (Recommended)
- **Free Tier**: 14 days (no credit card)
- **Paid Tier**: $15-50/month
- **Best For**: Startups, small/medium teams
- **Includes**: 200MB daily ingestion, backups, uptime SLA

### Self-Hosted Docker
- **Infrastructure Cost**: $10-50/month (VPS)
- **Setup Time**: 15 minutes
- **Best For**: Cost-conscious, need customization
- **Includes**: Full control, no recurring fees

### AWS OpenSearch
- **Variable Cost**: $100-500+/month
- **Best For**: AWS ecosystem users
- **Includes**: Auto-scaling, VPC integration

**Recommendation**: Start with Elastic Cloud free trial (14 days) to evaluate, then migrate to self-hosted if needed.

---

## Kibana Access

Once ELK is running:

**Elastic Cloud:**
- Go to your Elastic Cloud deployment
- Click "Open Kibana"
- Login with `elastic` / your password

**Self-Hosted Docker:**
- URL: `http://your-server:5601`
- Username: `elastic`
- Password: `changeme` (change in production!)

**AWS OpenSearch:**
- Open AWS Console → OpenSearch Service
- Click your domain → OpenSearch Dashboards
- Use AWS IAM authentication

---

## Log Search Examples

Once logs are flowing, search in Kibana:

**Find all API requests:**
```
service:truekin-backend AND fields.event:*API*
```

**Find slow requests:**
```
service:truekin-backend AND fields.duration > 500
```

**Find Medicines API errors:**
```
service:truekin-backend AND fields.event:*MEDICINES* AND level:error
```

**Find specific user activity:**
```
fields.userId:user-123
```

**Find requests with specific requestId:**
```
fields.requestId:med-list-1713967890123-abc123
```

**Find failed auth attempts:**
```
fields.event:AUTH_EVENT AND fields.success:false
```

---

## Next Steps

### Immediate (Day 1)
1. **Choose ELK option** (Elastic Cloud recommended)
2. **Set up infrastructure** (follow chosen path)
3. **Update environment variables**
4. **Deploy application**
5. **Verify logs** appear in Kibana (within 2 seconds)

### Short Term (Week 1)
1. **Create Kibana dashboards** (use provided configs)
2. **Configure alerts** (follow alert templates)
3. **Establish performance baselines** (document current metrics)
4. **Train team** on log reading and monitoring

### Medium Term (Week 2-4)
1. **Optimize slow endpoints** (based on dashboard data)
2. **Fine-tune alert thresholds** (based on baseline)
3. **Document runbooks** (for common issues)
4. **Set up backups** (if self-hosted)

### Ongoing
1. **Daily**: Monitor error rate and response times
2. **Weekly**: Analyze trends and patterns
3. **Monthly**: Review and optimize based on data
4. **Quarterly**: Capacity planning and scaling

---

## Documentation Files

All documentation is in your repository:

1. **ELK_PRODUCTION_SETUP.md** (424 lines)
   - Setup instructions for all 3 options
   - Cost comparison
   - Troubleshooting guide

2. **KIBANA_DASHBOARD_CONFIG.md** (455 lines)
   - Dashboard creation instructions
   - KQL query examples
   - Alert configurations
   - Best practices

3. **PRODUCTION_DEPLOYMENT_CHECKLIST.md** (587 lines)
   - 50+ verification items
   - Command examples
   - Performance testing procedures
   - Security checklist

4. **ELK_INTEGRATION_COMPLETE.md** (this file)
   - Overview and quick start
   - Quick reference guide

---

## Support & Troubleshooting

### Logs Not Appearing in Kibana?

1. Check environment variable: `echo $ELK_ENABLED` (should be `true`)
2. Check Elasticsearch connectivity: `curl -X GET $ELK_NODE/_health`
3. Check application logs: `docker logs truekin-backend-prod`
4. Wait 2-5 seconds (logs have latency)
5. Check correct index pattern in Kibana: `truekin-logs-*`

### High Elasticsearch CPU/Memory?

1. Increase Java heap size in docker-compose
2. Delete old indices (older than 30 days)
3. Adjust log level from `info` to `warn`

### Can't Access Kibana?

1. Check if running: `docker ps | grep kibana`
2. Check port: `netstat -an | grep 5601`
3. Check logs: `docker logs truekin-kibana-prod`
4. For Elastic Cloud: Use their provided URL

---

## Key Takeaways

✅ **Comprehensive Logging Already in Place**
- Medicines API: 5 route steps + 8 service steps
- Documents API: 5 route steps + service steps
- All logs include requestId for complete tracing

✅ **Three Production-Ready Options**
- Elastic Cloud (fastest, recommended)
- Docker Compose (full control)
- AWS OpenSearch (AWS users)

✅ **Pre-Configured Dashboards**
- Medicines API monitoring
- Documents API monitoring
- System health dashboard
- Security dashboard

✅ **Complete Documentation**
- Setup guides for all platforms
- Dashboard configuration
- Deployment checklist
- Troubleshooting guides

✅ **Production Ready**
- Environment configuration examples
- Alert templates
- Performance baselines
- Monitoring procedures

---

## Ready to Deploy

Your backend is fully instrumented with comprehensive logging. Now you just need to:

1. **Choose your ELK platform** (Elastic Cloud recommended)
2. **Follow the setup guide** (5-15 minutes)
3. **Configure environment variables**
4. **Deploy your application**
5. **Create Kibana dashboards** (provided configs)
6. **Set up monitoring and alerts**

Everything is documented and ready to go! 🚀

For detailed instructions, see:
- **Quick Start**: ELK_PRODUCTION_SETUP.md (Choose Option 1 for fastest path)
- **Dashboards**: KIBANA_DASHBOARD_CONFIG.md
- **Deployment**: PRODUCTION_DEPLOYMENT_CHECKLIST.md
