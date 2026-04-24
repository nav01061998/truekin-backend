# ELK Production Setup Guide

## Option 1: Elastic Cloud (RECOMMENDED - Easiest & Fastest) ⭐

### Advantages:
- ✅ No infrastructure management
- ✅ Automatic backups and scaling
- ✅ 14-day free trial
- ✅ 5 minutes to set up
- ✅ Production-grade security

### Step 1: Create Elastic Cloud Account
1. Go to https://cloud.elastic.co
2. Sign up for free trial (no credit card needed for 14 days)
3. Create a deployment in your preferred region

### Step 2: Get Credentials
After deployment is created:
1. Copy **Elasticsearch Endpoint** (looks like: `https://xxxxx.us-central1.gcp.cloud.es.io:9243`)
2. Copy **Username** (default: `elastic`)
3. Copy **Password** (auto-generated)

### Step 3: Environment Variables (.env.production)
```bash
# ELK Configuration
ELK_ENABLED=true
ELK_NODE=https://elastic:PASSWORD@xxxxx.us-central1.gcp.cloud.es.io:9243
NODE_ENV=production
LOG_LEVEL=info
```

### Step 4: Deploy and Start Logging
Your application will automatically send logs to Elastic Cloud once deployed with these env vars.

### Step 5: Access Kibana Dashboard
1. Go to your Elastic Cloud deployment
2. Click "Open Kibana"
3. Login with credentials from Step 2
4. Logs will appear under `truekin-logs-*` indices

---

## Option 2: Self-Hosted with Docker Compose

### Advantages:
- ✅ Full control
- ✅ No subscription costs
- ✅ Can customize everything
- ❌ You manage infrastructure

### Prerequisites
- Docker & Docker Compose installed
- At least 4GB RAM available
- Ports 9200 (ES), 5601 (Kibana) available

### Step 1: Production Environment Setup

Create `.env.production`:
```bash
# Node Environment
NODE_ENV=production
LOG_LEVEL=info

# ELK Configuration
ELK_ENABLED=true
ELK_NODE=http://elasticsearch:9200

# Docker network
COMPOSE_PROJECT_NAME=truekin-prod
```

### Step 2: Production Docker Compose

Create `docker-compose.production.yml`:
```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    container_name: truekin-es-prod
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"  # For production
      - logger.level=warn  # Reduce ES logging noise
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    healthcheck:
      test: curl -s http://localhost:9200 >/dev/null || exit 1
      interval: 10s
      timeout: 10s
      retries: 5
    restart: always
    networks:
      - truekin-network

  logstash:
    image: docker.elastic.co/logstash/logstash:8.10.0
    container_name: truekin-logstash-prod
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
      - logstash-data:/usr/share/logstash/data
    ports:
      - "5000:5000"
    depends_on:
      elasticsearch:
        condition: service_healthy
    environment:
      - "LS_JAVA_OPTS=-Xmx1g -Xms1g"  # For production
    restart: always
    networks:
      - truekin-network

  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.0
    container_name: truekin-kibana-prod
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - KIBANA_DEFAULTAPPID=discover
    ports:
      - "5601:5601"
    depends_on:
      elasticsearch:
        condition: service_healthy
    restart: always
    networks:
      - truekin-network
    healthcheck:
      test: curl -s http://localhost:5601 >/dev/null || exit 1
      interval: 10s
      timeout: 10s
      retries: 5

volumes:
  elasticsearch-data:
    driver: local
  logstash-data:
    driver: local

networks:
  truekin-network:
    driver: bridge
```

### Step 3: Start ELK Stack
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Step 4: Access Kibana
- Kibana: http://your-server-ip:5601
- Username: elastic
- Password: changeme (default)

---

## Option 3: AWS Managed OpenSearch (For AWS Users)

### Advantages:
- ✅ AWS ecosystem integration
- ✅ Auto-scaling
- ✅ VPC integration
- ✅ AWS IAM authentication

### Quick Setup
1. Go to AWS Console → OpenSearch Service
2. Create domain (choose `ds2.xlarge` for testing, `m5.large` for prod)
3. Get endpoint: `https://xxxxx.us-east-1.aoss.amazonaws.com`
4. Set env var: `ELK_NODE=https://aws-opensearch-endpoint`

---

## Production Configuration Details

### logger.ts Updates (Already Done)
The logger is already configured to:
- Read `ELK_ENABLED` from environment
- Read `ELK_NODE` from environment
- Send logs to Elasticsearch with proper formatting
- Flush logs every 2 seconds
- Sanitize sensitive data

### Environment Variables Checklist

**Development:**
```bash
ELK_ENABLED=false
NODE_ENV=development
LOG_LEVEL=debug
```

**Staging:**
```bash
ELK_ENABLED=true
ELK_NODE=https://elastic:password@staging-es.example.com:9243
NODE_ENV=staging
LOG_LEVEL=info
```

**Production:**
```bash
ELK_ENABLED=true
ELK_NODE=https://elastic:password@prod-es.example.com:9243
NODE_ENV=production
LOG_LEVEL=info
```

---

## Creating Kibana Dashboards

Once logs are flowing, create dashboards to monitor:

### Dashboard 1: API Performance
1. Go to Kibana → Dashboards → Create
2. Add visualizations:
   - Avg response time by endpoint
   - Request count by status code
   - Error rate over time
   - Top slowest endpoints

### Dashboard 2: Authentication
1. Monitor login failures
2. Session validation failures
3. Unauthorized access attempts
4. Token expiration events

### Dashboard 3: Medicines API
1. Add medicines count by status
2. Pagination usage patterns
3. Empty state frequency
4. Error rates by operation

### Dashboard 4: Documents API
1. Prescriptions fetch count
2. Reports fetch count
3. Average pagination depth
4. Filter usage patterns

### Sample Kibana Query (Search)
```json
{
  "event": "MEDICINES_LIST_API_SUCCESS",
  "environment": "production"
}
```

---

## Log Format in Production

All logs from your application now use this format:

```json
{
  "@timestamp": "2026-04-24T10:30:00Z",
  "message": "MEDICINES_LIST_API_SUCCESS",
  "severity": "info",
  "service": "truekin-backend",
  "environment": "production",
  "fields": {
    "requestId": "med-list-1713967890123-abc123",
    "userId": "user-123",
    "consumingCount": 10,
    "consumingTotal": 25,
    "pastSections": 3
  }
}
```

---

## Log Retention & Cleanup

### Elasticsearch Index Management

**Daily Index Pattern:**
- `truekin-logs-2026-04-24`
- `truekin-logs-2026-04-25`
- etc.

**Cleanup Old Logs:**

```bash
# Delete logs older than 30 days
DELETE /truekin-logs-2026-03-*

# Or use Index Lifecycle Management (ILM)
# Automatically delete after 30 days in Kibana
```

---

## Monitoring Checklist

- [ ] ELK stack running in production
- [ ] Environment variables configured
- [ ] Logs flowing to Elasticsearch (visible in Kibana)
- [ ] Dashboards created for key metrics
- [ ] Alerts configured for errors/warnings
- [ ] Index retention policy configured (30 days)
- [ ] Backup strategy in place

---

## Production Best Practices

### 1. Log Levels
- `error` - Application errors (auto-alerting)
- `warn` - Warnings (monitor but don't alert)
- `info` - Important events (API calls, auth, etc.)
- `debug` - Development only (not in production)

### 2. Security
- ✅ Sanitize sensitive data (tokens, passwords)
- ✅ Use HTTPS for Elasticsearch
- ✅ Use strong credentials
- ✅ Limit Kibana access to team members only
- ✅ Use VPC for self-hosted Elasticsearch

### 3. Performance
- ✅ Set appropriate Java heap size (2GB+ for production)
- ✅ Use SSD storage for Elasticsearch
- ✅ Configure log rotation/retention
- ✅ Monitor Elasticsearch heap usage
- ✅ Monitor disk space

### 4. Reliability
- ✅ Set up monitoring/alerting for ELK stack health
- ✅ Configure backups
- ✅ Have rollback plan
- ✅ Test log shipping regularly

---

## Cost Comparison

### Elastic Cloud (Recommended)
- **Free Tier**: 14 days
- **Paid Tier**: ~$15-50/month depending on usage
- **Best For**: Small to medium applications

### Self-Hosted Docker
- **Cost**: Just server resources (~$10-50/month for small VPS)
- **Best For**: Full control, high volume logs

### AWS OpenSearch
- **Cost**: Variable based on instance size and data
- **Best For**: AWS ecosystem users

---

## Quick Start Summary

### Fastest Path (Elastic Cloud) - 5 minutes
1. Go to https://cloud.elastic.co
2. Sign up for free trial
3. Create deployment
4. Copy endpoint and credentials
5. Update `.env` with `ELK_NODE`
6. Deploy your app
7. Access Kibana dashboard

### Alternative Path (Docker) - 15 minutes
1. Copy `docker-compose.production.yml`
2. Run `docker-compose up -d`
3. Update `.env` with `ELK_NODE=http://elasticsearch:9200`
4. Deploy your app
5. Access Kibana at `localhost:5601`

---

## Troubleshooting

### Logs Not Appearing in Kibana

1. **Check env variables:**
   ```bash
   echo $ELK_ENABLED
   echo $ELK_NODE
   ```

2. **Check connectivity:**
   ```bash
   curl -X GET $ELK_NODE
   ```

3. **Check app logs:**
   ```bash
   docker logs truekin-backend
   ```

4. **Check Elasticsearch health:**
   ```bash
   curl -X GET http://localhost:9200/_health
   ```

### High Elasticsearch CPU/Memory

1. Increase Java heap size in docker-compose
2. Delete old indices (older than 30 days)
3. Adjust log level to `warn` in production

### Kibana Not Accessible

1. Check if container is running: `docker ps`
2. Check port binding: `docker logs truekin-kibana-prod`
3. Verify network connectivity: `docker network ls`

---

## Next Steps

1. **Choose your setup** (Elastic Cloud or Docker)
2. **Configure environment variables**
3. **Deploy to production**
4. **Create Kibana dashboards** for Medicines and Documents APIs
5. **Set up alerts** for errors and warnings
6. **Monitor and optimize** based on real production data

Would you like help with any specific step?
