# Kibana Dashboard Configuration for TrueKin Backend

## Dashboard Overview

This guide provides pre-configured dashboard configurations that you can import into Kibana to monitor:
- Medicines API (GET /v1/medicines, POST /api/medicines/add)
- Documents API (GET /v1/documents)
- System Health and Performance

---

## Dashboard 1: Medicines API Monitoring

### Name: TrueKin - Medicines API Overview

### How to Create:

1. **Go to Kibana** → Menu → Dashboards → Create dashboard
2. **Add Visualization 1: Request Count by Endpoint**
   - Type: Bar chart
   - Metrics: Count
   - Breakdown by: `fields.event.keyword`
   - Filter: `service:truekin-backend AND fields.event:(MEDICINES_LIST_API_SUCCESS OR MEDICINES_ADD_SUCCESS OR MEDICINES_ADD_ERROR)`

3. **Add Visualization 2: Response Time Distribution**
   - Type: Line chart
   - Y-axis: Average of `fields.duration`
   - X-axis: Time
   - Filter: `service:truekin-backend AND fields.event:MEDICINES_LIST_*`

4. **Add Visualization 3: Error Rate Over Time**
   - Type: Metric
   - Aggregation: Count
   - Filter: `service:truekin-backend AND fields.event:(MEDICINES_ADD_ERROR OR MEDICINES_LIST_API_FATAL_ERROR)`
   - Group by: Time (1 hour)

5. **Add Visualization 4: Top Users by Request Count**
   - Type: Data table
   - Metrics: Count
   - Breakdown by: `fields.userId.keyword`
   - Limit: 10

6. **Add Visualization 5: Pagination Patterns**
   - Type: Pie chart
   - Metrics: Count
   - Breakdown by: `fields.consumingPage.keyword`

### Key Metrics to Monitor:
- ✅ API response time (target: < 500ms)
- ✅ Error rate (target: < 1%)
- ✅ User activity patterns
- ✅ Pagination depth (how many pages users access)

---

## Dashboard 2: Documents API Monitoring

### Name: TrueKin - Documents API Overview

### How to Create:

1. **Go to Kibana** → Create new dashboard

2. **Add Visualization 1: Prescriptions vs Reports Fetch Count**
   - Type: Bar chart
   - Metrics: Count
   - Breakdown by: `fields.event.keyword`
   - Filter: `service:truekin-backend AND fields.event:(DOCUMENTS_API_SUCCESS OR DOCUMENTS_API_FATAL_ERROR)`

3. **Add Visualization 2: Average Fetch Time**
   - Type: Metric
   - Aggregation: Average of `fields.duration`
   - Filter: `service:truekin-backend AND fields.event:DOCUMENTS_API_SUCCESS`

4. **Add Visualization 3: Prescriptions Count Distribution**
   - Type: Histogram
   - Field: `fields.prescriptionsCount`
   - Interval: 5

5. **Add Visualization 4: Reports Sections by User**
   - Type: Data table
   - Metrics: Average of `fields.reportsTotal`
   - Breakdown by: `fields.userId.keyword`

6. **Add Visualization 5: Status Code Distribution**
   - Type: Pie chart
   - Metrics: Count
   - Breakdown by: `fields.statusCode.keyword`

### Key Metrics to Monitor:
- ✅ Prescriptions fetch count
- ✅ Reports fetch count
- ✅ Average response time
- ✅ Error distribution

---

## Dashboard 3: System Health & Performance

### Name: TrueKin - System Health

### How to Create:

1. **Add Visualization 1: API Response Times by Endpoint**
   - Type: Horizontal bar chart
   - Y-axis: `fields.event.keyword`
   - X-axis: Average of `fields.duration`
   - Filter: `service:truekin-backend`

2. **Add Visualization 2: Error Events Timeline**
   - Type: Area chart
   - Y-axis: Count
   - X-axis: Time
   - Filter: `level:(error OR ERROR)`
   - Breakdown by: Time (1 hour)

3. **Add Visualization 3: Request Count by Environment**
   - Type: Bar chart
   - Metrics: Count
   - Breakdown by: `environment.keyword`

4. **Add Visualization 4: Total Requests (Stat)**
   - Type: Metric/Stat
   - Aggregation: Count
   - Filter: `service:truekin-backend`

5. **Add Visualization 5: Error Rate (Stat)**
   - Type: Metric/Stat
   - Aggregation: Percentage of errors
   - Formula: (errors / total requests) * 100

6. **Add Visualization 6: Latest Errors Table**
   - Type: Data table
   - Columns: timestamp, level, message, errorName
   - Filter: `level:error`
   - Sort by: timestamp (newest first)
   - Limit: 20

### Key Metrics to Monitor:
- ✅ Total request count
- ✅ Error rate (target: < 1%)
- ✅ Response time distribution
- ✅ Latest errors

---

## Dashboard 4: Authentication & Security

### Name: TrueKin - Auth & Security

### How to Create:

1. **Add Visualization 1: Login Success Rate**
   - Type: Gauge chart
   - Metrics: Percentage of successful logins
   - Filter: `fields.event:AUTH_EVENT AND fields.action:LOGIN`

2. **Add Visualization 2: Failed Login Attempts**
   - Type: Bar chart
   - Metrics: Count
   - X-axis: Time
   - Filter: `fields.event:AUTH_EVENT AND fields.success:false`

3. **Add Visualization 3: Invalid Session Attempts**
   - Type: Data table
   - Columns: userId, timestamp, reason
   - Filter: `fields.event:MEDICINES_LIST_SESSION_INVALID OR fields.event:DOCUMENTS_SESSION_INVALID`
   - Limit: 20

4. **Add Visualization 4: Top Users by Request Count**
   - Type: Horizontal bar chart
   - X-axis: Count
   - Y-axis: `fields.userId.keyword`
   - Limit: 10

5. **Add Visualization 5: Session Validation Failures Timeline**
   - Type: Line chart
   - Y-axis: Count
   - X-axis: Time
   - Filter: `fields.event:(MEDICINES_LIST_SESSION_INVALID OR DOCUMENTS_SESSION_INVALID)`

### Key Metrics to Monitor:
- ✅ Login success rate (target: > 99%)
- ✅ Failed login attempts (investigate spikes)
- ✅ Invalid session attempts
- ✅ Unauthorized access attempts

---

## Creating Saved Searches (For Dashboard Building)

Before creating dashboards, create these saved searches:

### Saved Search 1: All API Requests
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "truekin-backend" } },
        { "match": { "fields.event": "*API*" } }
      ]
    }
  }
}
```

### Saved Search 2: Error Events
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "truekin-backend" } },
        { "match": { "level": "error" } }
      ]
    }
  }
}
```

### Saved Search 3: Medicines API
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "truekin-backend" } },
        { "match": { "fields.event": "*MEDICINES*" } }
      ]
    }
  }
}
```

### Saved Search 4: Documents API
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "truekin-backend" } },
        { "match": { "fields.event": "*DOCUMENTS*" } }
      ]
    }
  }
}
```

---

## Alerts Configuration

### Alert 1: High Error Rate
- **Condition**: Error count > 10 in last 5 minutes
- **Action**: Send email notification
- **Filter**: `service:truekin-backend AND level:error`

### Alert 2: Slow API Response
- **Condition**: Average response time > 1000ms
- **Action**: Send Slack notification
- **Filter**: `service:truekin-backend AND fields.duration > 1000`

### Alert 3: Auth Failures
- **Condition**: Failed logins > 5 in last 10 minutes
- **Action**: Send email notification
- **Filter**: `fields.event:AUTH_EVENT AND fields.success:false`

### Alert 4: Database Errors
- **Condition**: Database errors > 3 in last 5 minutes
- **Action**: Send Slack notification
- **Filter**: `fields.event:DATABASE_OPERATION AND fields.success:false`

---

## Kibana Query Language (KQL) Examples

### Useful Queries for Debugging:

**Find all requests for a specific user:**
```
service:truekin-backend AND fields.userId:user-123
```

**Find slow requests (> 500ms):**
```
service:truekin-backend AND fields.duration > 500
```

**Find all Medicines API errors:**
```
service:truekin-backend AND fields.event:*MEDICINES* AND level:error
```

**Find requests with specific requestId:**
```
service:truekin-backend AND fields.requestId:"med-list-1713967890123-abc123"
```

**Find failed session validations:**
```
fields.event:(MEDICINES_LIST_SESSION_INVALID OR DOCUMENTS_SESSION_INVALID)
```

**Find all API responses (exclude logs):**
```
service:truekin-backend AND fields.event:*API_SUCCESS
```

---

## Dashboard Best Practices

### 1. Real-Time Monitoring
- Set dashboard refresh to **10 seconds** for live monitoring
- Pin critical visualizations at the top
- Use color coding for severity levels

### 2. Performance Optimization
- Group related metrics together
- Use aggregations (don't fetch raw data)
- Set appropriate time ranges (last 24h for overview, last 1h for troubleshooting)

### 3. Actionability
- Include drill-down capabilities
- Show "View in Logs" links
- Include error messages and stack traces in tables

### 4. Documentation
- Add descriptions to each visualization
- Include metrics definitions
- Document alert thresholds

---

## Sample Dashboard JSON (For Import)

You can create this dashboard manually in Kibana UI, or if Kibana supports import, use this JSON structure:

```json
{
  "title": "TrueKin - Medicines API Overview",
  "panels": [
    {
      "id": "medicines-request-count",
      "type": "visualization",
      "config": {
        "query": {
          "match_all": {}
        },
        "filter": [
          {
            "match": {
              "service": "truekin-backend"
            }
          },
          {
            "match": {
              "fields.event": "*MEDICINES*"
            }
          }
        ]
      }
    }
  ]
}
```

---

## Monitoring Workflow

### Daily Checks
1. Check error rate (target: < 1%)
2. Check average response time (target: < 500ms)
3. Check failed logins (should be rare)
4. Review latest errors

### Weekly Review
1. Analyze pagination patterns
2. Identify slow endpoints
3. Review top users
4. Check data retention/storage usage

### Monthly Review
1. Analyze trends
2. Identify optimization opportunities
3. Review and adjust alert thresholds
4. Capacity planning (storage, performance)

---

## Integration with Slack/Email Alerts

### Slack Integration
1. Go to Kibana → Management → Alerts and Actions
2. Create action: Slack (provide webhook URL)
3. Create rule for high error rate
4. Test alert

### Email Integration
1. Go to Kibana → Management → Alerts and Actions
2. Create action: Email (configure SMTP)
3. Create rule for critical errors
4. Test alert

---

## Troubleshooting Dashboard Issues

### No Data Appearing
1. Check if logs are indexed: Go to Management → Index Management
2. Verify index name: `truekin-logs-*`
3. Check time range selector (top right of Kibana)
4. Verify query syntax

### Slow Dashboard Loading
1. Reduce time range (use last 24h instead of last 30d)
2. Increase aggregation intervals
3. Use filters to reduce data volume
4. Check Elasticsearch health

### Incomplete Data
1. Check if some log fields are missing
2. Verify logger.ts is sending all required fields
3. Check for errors in application logs
4. Verify Elasticsearch disk space

---

## Dashboard Export/Import

### Export Dashboard
1. Dashboard → Share → Export
2. Save JSON file
3. Version control the JSON

### Import Dashboard
1. Kibana → Stack Management → Saved Objects
2. Import → Select JSON file
3. Adjust index patterns if needed
4. Save

---

## Next Steps

1. **Set up ELK** (Elastic Cloud or Docker)
2. **Deploy application** with ELK_ENABLED=true
3. **Verify logs** appear in Kibana
4. **Create dashboards** using this guide
5. **Set up alerts** for critical events
6. **Monitor and optimize** based on real data

All log events are already being sent by the Medicines and Documents APIs with the comprehensive logging we implemented!
