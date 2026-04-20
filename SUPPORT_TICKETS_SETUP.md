# Support Tickets System Setup

## Overview

A complete support ticket management system has been implemented allowing users to submit support tickets with the following features:

- Create support tickets with issue type, subject, and message
- View all user's tickets
- View specific ticket details
- Automatic ticket ID generation (e.g., TKT-20260420-0001)
- Status tracking (open, in-progress, resolved)
- Session-based authentication
- Input validation and error handling

## Files Created

### Database Migration
- `supabase/migrations/015_create_support_tickets_table.sql` — Creates support_tickets table with proper constraints and indexes

### Backend Implementation
- `src/services/support-service.ts` — Service layer with ticket management logic
- `src/routes/support.ts` — Three API endpoints (submit, list, get details)

## Setup Instructions

### Step 1: Apply Database Migration

1. Go to [Supabase Console](https://app.supabase.com)
2. Select your project: `xoznufjoozmrhyuxngiv`
3. Click **SQL Editor** in the left sidebar
4. Copy and paste the SQL from `supabase/migrations/015_create_support_tickets_table.sql`
5. Click **Run** and verify ✅ "Success"

### Verify Migration Applied

Run this query to confirm the table exists:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'support_tickets';
-- Should return 1 row
```

## API Endpoints

### 1. Submit Support Ticket

**POST** `/v1/support/submit-ticket`

**Headers:**
```
x-user-id: {userId}
x-session-token: {sessionToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "issue_type": "Technical Issue",
  "subject": "Not able to create a job post",
  "message": "Please provide your issue in detail..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Ticket submitted successfully",
  "ticket_id": "TKT-20260420-0001"
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Subject must be 255 characters or less"
}
```

---

### 2. Get User's Tickets

**GET** `/v1/support/tickets`

**Headers:**
```
x-user-id: {userId}
x-session-token: {sessionToken}
```

**Success Response (200):**
```json
{
  "success": true,
  "tickets": [
    {
      "id": "uuid",
      "ticket_id": "TKT-20260420-0001",
      "user_id": "uuid",
      "issue_type": "Technical Issue",
      "subject": "Not able to create a job post",
      "message": "Please provide your issue in detail...",
      "status": "open",
      "created_at": "2026-04-20T12:30:45.000Z",
      "updated_at": "2026-04-20T12:30:45.000Z",
      "resolved_at": null
    }
  ]
}
```

---

### 3. Get Specific Ticket Details

**GET** `/v1/support/tickets/{ticket_id}`

**Headers:**
```
x-user-id: {userId}
x-session-token: {sessionToken}
```

**Path Parameters:**
- `ticket_id` — Ticket ID (e.g., TKT-20260420-0001)

**Success Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "ticket_id": "TKT-20260420-0001",
    "user_id": "uuid",
    "issue_type": "Technical Issue",
    "subject": "Not able to create a job post",
    "message": "Please provide your issue in detail...",
    "status": "open",
    "created_at": "2026-04-20T12:30:45.000Z",
    "updated_at": "2026-04-20T12:30:45.000Z",
    "resolved_at": null
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Ticket not found"
}
```

---

## Test Commands

### Get Valid User ID and Session Token

```sql
-- Get a valid user
SELECT id FROM auth.users LIMIT 1;

-- Get a session token
SELECT user_id, token FROM auth_sessions WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
```

### Test 1: Submit Support Ticket

```bash
curl -X POST http://localhost:4000/v1/support/submit-ticket \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "issue_type": "Technical Issue",
    "subject": "Not able to create a job post",
    "message": "Please provide your issue in detail..."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Ticket submitted successfully",
  "ticket_id": "TKT-20260420-0001"
}
```

### Test 2: Get User's Tickets

```bash
curl -X GET http://localhost:4000/v1/support/tickets \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN"
```

**Expected Response:** List of all tickets for the user

### Test 3: Get Specific Ticket

```bash
curl -X GET http://localhost:4000/v1/support/tickets/TKT-20260420-0001 \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN"
```

**Expected Response:** Ticket details for the specified ticket ID

### Test 4: Invalid Input

```bash
curl -X POST http://localhost:4000/v1/support/submit-ticket \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "issue_type": "",
    "subject": "Test",
    "message": "Test message"
  }'
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Invalid request body",
  "issues": [
    {
      "path": "issue_type",
      "message": "Issue type is required"
    }
  ]
}
```

### Test 5: Unauthorized

```bash
curl -X POST http://localhost:4000/v1/support/submit-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "issue_type": "Technical Issue",
    "subject": "Test",
    "message": "Test"
  }'
```

**Expected Response (401):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## Database Schema

### support_tickets Table

```
Column            Type                    Description
─────────────────────────────────────────────────────
id                UUID PRIMARY KEY        Unique identifier (UUID)
ticket_id         VARCHAR(20) UNIQUE      Human-readable ID (e.g., TKT-20260420-0001)
user_id           UUID (FK)               References auth.users(id)
issue_type        VARCHAR(100)            Category of issue
subject           VARCHAR(255)            Issue subject/title
message           TEXT                    Detailed issue description
status            VARCHAR(20)             'open' | 'in-progress' | 'resolved'
created_at        TIMESTAMP WITH TZ       Creation timestamp
updated_at        TIMESTAMP WITH TZ       Last update timestamp
resolved_at       TIMESTAMP WITH TZ       Resolution timestamp (nullable)
```

### Indexes Created

- `idx_support_tickets_user_id` — For fast user ticket lookups
- `idx_support_tickets_status` — For filtering by status
- `idx_support_tickets_created_at` — For sorting by date
- `idx_support_tickets_ticket_id` — For fast ticket lookups by ID

---

## Validation Rules

- **issue_type**: Required, min 1 character
- **subject**: Required, min 1 character, max 255 characters
- **message**: Required, min 1 character, max 5000 characters
- **ticket_id**: Auto-generated in format TKT-YYYYMMDD-XXXX
- **status**: Default 'open', can only be 'open', 'in-progress', or 'resolved'

---

## Features

✅ Session-based authentication (x-user-id + x-session-token)
✅ Automatic ticket ID generation
✅ Input validation with detailed error messages
✅ Support for multiple issue types
✅ Ticket status tracking
✅ User isolation (users can only see their own tickets)
✅ Timestamp tracking (created_at, updated_at, resolved_at)
✅ Efficient database indexes
✅ Non-blocking error handling

---

## Future Enhancements

- [ ] Support ticket assignment to support agents
- [ ] Ticket priority levels (low, medium, high, critical)
- [ ] Ticket category tags
- [ ] Comments/replies on tickets
- [ ] File attachments
- [ ] Ticket search and filtering
- [ ] Email notifications on status updates
- [ ] SLA tracking
- [ ] Admin dashboard for managing tickets
