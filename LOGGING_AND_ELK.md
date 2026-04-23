# Logging and ELK Stack Integration

## Overview

The TrueKin backend now includes comprehensive logging with ELK (Elasticsearch, Logstash, Kibana) stack integration for:

- 📊 **Request/Response Tracking** - All API requests logged with request IDs
- 🐛 **Error Logging** - Detailed error messages with stack traces
- 📈 **Performance Monitoring** - Response times and slow request detection
- 🔍 **Centralized Logging** - All logs stored in Elasticsearch
- 📉 **Visualization** - Kibana dashboards for log analysis
- 🔐 **Security** - Sensitive data redaction in logs

---

## Features

### 1. Request ID Tracking
Every API request gets a unique request ID that's:
- Generated automatically (UUID)
- Included in response headers (`x-request-id`)
- Tracked across all logs for correlation
- Useful for debugging user issues

### 2. Comprehensive Logging
Logs capture:
- **API Requests**: Method, path, query params, headers
- **API Responses**: Status code, response size, duration
- **Errors**: Error message, stack trace, error type
- **Database Operations**: Query type, table, duration
- **Authentication Events**: Login, logout, token validation
- **Business Events**: Custom events for business logic

### 3. Sensitive Data Protection
Automatic redaction of:
- Passwords
- Tokens and session tokens
- API keys
- Authorization headers
- Cookies

### 4. Error Response Improvements
All API errors now include:
- Human-readable error message
- Structured error code
- Request ID for tracking
- Timestamp
- Specific HTTP status code

Example error response:
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired session token",
  "code": "UNAUTHORIZED",
  "requestId": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "timestamp": "2026-04-23T10:30:45.123Z"
}
```

---

## Quick Start

### 1. Enable ELK Stack

Update your `.env` file:
```env
ELK_ENABLED=true
ELK_NODE=http://localhost:9200
LOG_LEVEL=info
```

Or update `.env.logging`:
```bash
cp .env.logging .env.logging.local
# Edit .env.logging.local and set:
# ELK_ENABLED=true
# LOG_LEVEL=info
```

### 2. Start ELK Stack

Using Docker Compose:
```bash
docker-compose -f docker-compose.elk.yml up -d
```

This starts:
- **Elasticsearch** (port 9200) - Log storage and indexing
- **Logstash** (port 5000) - Log processing
- **Kibana** (port 5601) - Visualization

### 3. Access Kibana Dashboard

Open your browser:
```
http://localhost:5601
```

### 4. Create Index Pattern in Kibana

1. Go to **Management** → **Stack Management** → **Index Patterns**
2. Click **Create Index Pattern**
3. Index pattern: `truekin-logs-*`
4. Time field: `@timestamp`
5. Click **Create**

### 5. View Logs

Go to **Analytics** → **Discover** to search and analyze logs

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ELK_ENABLED` | false | Enable ELK stack integration |
| `ELK_NODE` | http://localhost:9200 | Elasticsearch endpoint |
| `ELK_USERNAME` | elastic | Elasticsearch username |
| `ELK_PASSWORD` | changeme | Elasticsearch password |
| `LOG_LEVEL` | info | Log level (error, warn, info, debug) |
| `LOG_DIR` | ./logs | Directory for local log files |
| `LOG_REQUESTS` | true | Log all API requests |
| `LOG_RESPONSES` | true | Log all API responses |
| `LOG_ERRORS` | true | Log all errors |
| `LOG_DATABASE_QUERIES` | true | Log database queries |
| `SLOW_REQUEST_THRESHOLD` | 5000 | Request duration threshold (ms) |

### Log Levels

- **error** - Only errors
- **warn** - Warnings and errors
- **info** - Info, warnings, and errors (recommended for production)
- **debug** - Everything (verbose, use for development)

---

## Logging Functions

### 1. Log API Request
```typescript
import { logRequest } from "@/lib/logger";

logRequest(
  requestId,
  method,
  path,
  userId,
  queryParams,
  headers
);
```

### 2. Log API Response
```typescript
import { logResponse } from "@/lib/logger";

logResponse(
  requestId,
  method,
  path,
  statusCode,
  duration,
  userId,
  responseSize
);
```

### 3. Log Error
```typescript
import { logError } from "@/lib/logger";

logError(
  requestId,
  method,
  path,
  statusCode,
  error,
  userId,
  duration
);
```

### 4. Log Database Operation
```typescript
import { logDatabase } from "@/lib/logger";

logDatabase(
  requestId,
  operation,    // "SELECT", "INSERT", "UPDATE", etc.
  table,        // Table name
  duration,     // Query duration in ms
  success,      // Boolean
  error         // Error message if failed
);
```

### 5. Log Authentication Event
```typescript
import { logAuth } from "@/lib/logger";

logAuth(
  requestId,
  action,       // "LOGIN", "LOGOUT", "SIGNUP", "TOKEN_VALIDATION"
  userId,
  success,
  reason        // Optional reason if failed
);
```

### 6. Log Business Event
```typescript
import { logBusiness } from "@/lib/logger";

logBusiness(
  requestId,
  eventType,    // e.g., "MEDICINE_ADDED", "PROFILE_UPDATED"
  userId,
  data          // Optional event data
);
```

---

## Error Handling

### Using Error Handler Utilities

```typescript
import {
  sendError,
  handleAuthError,
  handleValidationError,
  handleNotFoundError,
  handleGenericError
} from "@/lib/error-handler";

// Send auth error
handleAuthError(error, requestId, reply);

// Send validation error
handleValidationError("Field 'name' is required", requestId, reply);

// Send not found error
handleNotFoundError("User", requestId, reply);

// Send generic error
handleGenericError(error, requestId, reply, "adding medicine");
```

### Error Codes

Common error codes used across the API:

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | Invalid/expired session |
| FORBIDDEN | 403 | Not authenticated |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| VALIDATION_ERROR | 400 | Invalid input data |
| DATABASE_ERROR | 500 | Database operation failed |
| INTERNAL_ERROR | 500 | Unexpected server error |

---

## Kibana Queries

### Find All Errors
```
level: error
```

### Find Requests by User
```
userId: "user123"
```

### Find Slow Requests
```
duration > 5000
```

### Find API Endpoint Errors
```
method: POST AND path: "/api/medicines/add" AND level: error
```

### Find Authentication Failures
```
action: "LOGIN" AND success: false
```

### Find Requests by Request ID
```
requestId: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
```

### Find Database Errors
```
operation: "INSERT" AND success: false
```

---

## Monitoring & Alerts

### 1. Create Dashboard

In Kibana, create visualizations for:
- **API Request Rate** - Requests per minute
- **Error Rate** - Errors per minute
- **Response Times** - Average, p95, p99
- **Top Endpoints** - Most called APIs
- **Error Types** - Distribution of error codes
- **User Activity** - Active users over time

### 2. Set Up Alerts

Configure alerts for:
- Error rate > 5% in 5 minutes
- Average response time > 5 seconds
- Database operation failures
- Authentication failures > 10/minute

### 3. Monitor Performance

Track metrics:
- Slow queries (> 1000ms)
- Slow API responses (> 5000ms)
- Request queue buildup
- Database connection issues

---

## Development vs Production

### Development
```env
ELK_ENABLED=false
LOG_LEVEL=debug
LOG_REQUESTS=true
LOG_RESPONSES=true
```

Logs written to:
- Console (structured JSON)
- `logs/combined.log`
- `logs/error.log`

### Production
```env
ELK_ENABLED=true
ELK_NODE=https://elasticsearch.prod.example.com
LOG_LEVEL=info
LOG_REQUESTS=true
LOG_RESPONSES=true
```

Logs sent to:
- Elasticsearch (centralized)
- Local files as backup
- Kibana for visualization

---

## Example Request Flow with Logging

```
User makes API request
    ↓
Logging middleware generates request ID
    ↓
Log incoming request (logRequest)
    ↓
Route handler processes request
    ↓
On success:
  - Validate data (log validation errors)
  - Query database (logDatabase)
  - Execute business logic (logBusiness)
  - Send response (logResponse)
    ↓
On error:
  - Catch error (log with logError)
  - Handle error type (handleAuthError, handleValidationError, etc.)
  - Send error response with request ID
    ↓
All logs sent to Elasticsearch
    ↓
Visible in Kibana dashboard
    ↓
Developer can search by:
  - Request ID
  - User ID
  - Timestamp
  - Error type
  - Endpoint
```

---

## Docker Commands

```bash
# Start ELK stack
docker-compose -f docker-compose.elk.yml up -d

# View logs
docker-compose -f docker-compose.elk.yml logs -f

# Stop ELK stack
docker-compose -f docker-compose.elk.yml down

# Stop and remove volumes (deletes all logs)
docker-compose -f docker-compose.elk.yml down -v

# Check service status
docker-compose -f docker-compose.elk.yml ps
```

---

## Troubleshooting

### Elasticsearch not starting
```bash
# Increase memory
docker-compose -f docker-compose.elk.yml up -d elasticsearch
# Check logs
docker logs truekin-elasticsearch
```

### No logs appearing in Kibana
1. Verify ELK_ENABLED=true in .env
2. Check Elasticsearch is running: `curl http://localhost:9200`
3. Verify application is logging: Check `logs/combined.log`
4. Check Logstash is running: `docker logs truekin-logstash`
5. Create index pattern if not exists

### High memory usage
Adjust in `docker-compose.elk.yml`:
```yaml
environment:
  - "ES_JAVA_OPTS=-Xms256m -Xmx256m"  # Reduce from 512m
```

### Permission denied on logs directory
```bash
mkdir -p logs
chmod 755 logs
```

---

## Best Practices

### 1. Always Include Request ID
Every error response includes `requestId` for tracing

### 2. Log Sensitive Operations
- User login/logout
- Permission changes
- Data modifications
- Payment transactions

### 3. Don't Log Sensitive Data
Automatic redaction prevents logging:
- Passwords
- Tokens
- API keys
- Credit card numbers

### 4. Use Appropriate Log Levels
- **ERROR**: Unexpected failures that need attention
- **WARN**: Unusual but handled conditions
- **INFO**: User actions, business events
- **DEBUG**: Variable values, execution flow

### 5. Include Context
Log relevant data:
```typescript
logError(requestId, method, path, status, error, userId, duration);
// Better than just:
logger.error(error.message);
```

### 6. Monitor in Production
Regularly review:
- Error rates
- Response times
- Database performance
- User activity patterns

---

## Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "winston": "^3.11.0",
    "winston-elasticsearch": "^0.17.4",
    "uuid": "^9.0.0"
  }
}
```

Install:
```bash
npm install winston winston-elasticsearch uuid
```

---

## Summary

✅ All APIs now log requests/responses  
✅ Comprehensive error handling with clear messages  
✅ Request ID tracking for debugging  
✅ Sensitive data automatic redaction  
✅ ELK stack integration for centralized logging  
✅ Kibana dashboards for visualization  
✅ Ready for production monitoring  

**Next Steps:**
1. Enable ELK_ENABLED in production
2. Set up Kibana dashboards
3. Create alert rules
4. Monitor error rates and performance
5. Use logs for debugging user issues
