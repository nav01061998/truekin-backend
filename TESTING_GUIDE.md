# TrueKin Backend - Testing Guide

## Setup

Before testing, ensure:
1. ✅ Migrations 012, 013, 014 applied to Supabase
2. ✅ Server running: `npm run dev`
3. ✅ Valid user ID and session token from database

Get test credentials:
```sql
-- Get a valid user
SELECT id FROM auth.users LIMIT 1;

-- Get a session token
SELECT user_id, token FROM auth_sessions WHERE user_id = 'YOUR_USER_ID' LIMIT 1;
```

---

## Phase 1-3: Happy Path Tests

### Test 1: Send Email OTP

```bash
curl -X POST http://localhost:4000/v1/profile/email/send-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "OTP sent to your email address",
  "masked_email": "t***@example.com"
}
```

**Check logs for OTP**:
```
[OTP] Email OTP for test@example.com: 1234
```

---

### Test 2: Verify Email OTP

```bash
curl -X POST http://localhost:4000/v1/profile/email/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "email": "test@example.com",
    "otp": "1234"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Email verified successfully",
  "profile": {
    "id": "user-id",
    "email": "test@example.com",
    "email_verified": true,
    "completion_percentage": 15,
    ...
  }
}
```

**Verify in database**:
```sql
SELECT email, email_verified FROM profiles WHERE id = 'YOUR_USER_ID';
-- Should show: email = 'test@example.com', email_verified = true

SELECT * FROM profile_audit_logs WHERE user_id = 'YOUR_USER_ID' AND action = 'EMAIL_VERIFICATION';
-- Should show: status = 'SUCCESS'
```

---

### Test 3: Send Phone OTP

```bash
curl -X POST http://localhost:4000/v1/profile/phone/send-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "new_phone": "9876543210"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "OTP sent to your phone number",
  "masked_phone": "9876****10"
}
```

---

### Test 4: Verify Phone OTP

```bash
curl -X POST http://localhost:4000/v1/profile/phone/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "new_phone": "9876543210",
    "otp": "1234"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Phone number updated successfully",
  "profile": {
    "id": "user-id",
    "phone": "9876543210",
    "completion_percentage": 15,
    ...
  }
}
```

---

## Phase 4: Rate Limiting Tests

### Test 5: Rate Limit - Email OTP

Send 6 requests to send email OTP endpoint:

```bash
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST http://localhost:4000/v1/profile/email/send-otp \
    -H "Content-Type: application/json" \
    -H "x-user-id: YOUR_USER_ID" \
    -H "x-session-token: YOUR_SESSION_TOKEN" \
    -d '{"email": "test'$i'@example.com"}' \
    -w "\nStatus: %{http_code}\n\n"
done
```

**Expected**:
- Requests 1-5: 200 OK
- Request 6: **429 Too Many Requests**

```json
{
  "success": false,
  "error": "Too many email OTP requests. Please try again after 1 hour",
  "remaining": 0,
  "resetTime": 3600
}
```

---

### Test 6: Rate Limit Headers

```bash
curl -X POST http://localhost:4000/v1/profile/email/send-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{"email": "test@example.com"}' \
  -i  # Show headers
```

**Look for headers**:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 3599
```

---

## Phase 3: Error Path Tests

### Test 7: Invalid Email Format

```bash
curl -X POST http://localhost:4000/v1/profile/email/send-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "email": "invalid-email"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Invalid request body",
  "issues": [
    {
      "path": "email",
      "message": "Invalid email"
    }
  ]
}
```

---

### Test 8: Invalid OTP

```bash
curl -X POST http://localhost:4000/v1/profile/email/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "email": "test@example.com",
    "otp": "0000"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Invalid OTP. 4 attempts remaining"
}
```

---

### Test 9: Max Attempts Exceeded

Send invalid OTP 5 times, then:

```bash
curl -X POST http://localhost:4000/v1/profile/email/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "email": "test@example.com",
    "otp": "0000"
  }'
```

**Expected Response** (429 Too Many Requests):
```json
{
  "success": false,
  "error": "Maximum OTP verification attempts exceeded. Please request a new OTP"
}
```

---

### Test 10: Expired OTP

Wait 10+ minutes, then:

```bash
curl -X POST http://localhost:4000/v1/profile/email/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "email": "test@example.com",
    "otp": "1234"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "No active OTP request found. Please request a new OTP"
}
```

---

### Test 11: Unauthorized Access

```bash
curl -X POST http://localhost:4000/v1/profile/email/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## Phase 2: Completion Percentage Tests

### Test 12: Track Completion Percentage

1. Create fresh user and track completion:

```bash
# Get profile (should be 0%)
curl -X GET http://localhost:4000/v1/profile/me \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN"
```

2. Update display_name:

```bash
curl -X POST http://localhost:4000/v1/profile/update \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{"display_name": "John Doe"}'
```

**Verify completion_percentage increased to 10%**

3. Verify email:
- Send OTP
- Verify OTP
- **Completion should now be 20%** (display_name 10% + email_verified 10%)

4. Update more fields:

```bash
curl -X POST http://localhost:4000/v1/profile/update \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -d '{
    "gender": "Male",
    "date_of_birth": "1990-05-15",
    "address": "123 Main Street, New Delhi, Delhi 110001",
    "blood_group": "O+",
    "height": 175,
    "weight": 70,
    "food_allergies": ["Peanuts"],
    "health_conditions": ["Diabetes"]
  }'
```

**Verify completion_percentage reaches 100%**

---

## Audit Logging Tests

### Test 13: Verify Audit Logs

```sql
-- Check EMAIL_VERIFICATION audit log
SELECT * FROM profile_audit_logs 
WHERE user_id = 'YOUR_USER_ID' 
AND action = 'EMAIL_VERIFICATION'
ORDER BY created_at DESC
LIMIT 1;

-- Expected columns:
-- status: SUCCESS (or FAILED)
-- action: EMAIL_VERIFICATION
-- new_value: {"email": "test@example.com", "email_verified": true}
-- ip_address: Your IP
-- user_agent: curl/... (or browser)
```

---

## Database Verification

### Verify OTP Requests Table

```sql
SELECT * FROM otp_requests 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Should show:
-- type: EMAIL_VERIFICATION or PHONE_CHANGE
-- is_verified: true (after successful verification)
-- attempt_count: incremented for failed attempts
-- expires_at: 10 minutes from created_at
```

---

## Performance Checks

### Check Memory Usage

```bash
# Monitor in-memory rate limiter
curl -X GET http://localhost:4000/admin/rate-limits \
  -H "x-user-id: YOUR_USER_ID" \
  -H "x-session-token: YOUR_SESSION_TOKEN"
```

(Optional endpoint - can be added to admin routes)

---

## Summary Checklist

- [ ] Phase 1: Database migrations applied
- [ ] Test 1-4: Happy path tests pass
- [ ] Test 5-6: Rate limiting works
- [ ] Test 7-11: Error handling works
- [ ] Test 12: Completion percentage tracking works
- [ ] Test 13: Audit logs created
- [ ] Profile completion reaches 100%
- [ ] OTP requests tracked in database
- [ ] Rate limit headers present
- [ ] No errors in server logs

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "OTP request not found" | Ensure OTP was sent first before verifying |
| "Email already verified" | Use a different email address |
| "No active OTP request" | OTP expired (10 mins) or already verified |
| Rate limit exceeded | Wait 1 hour or reset manually in DB |
| "Unauthorized" | Check x-user-id and x-session-token headers |
| completion_percentage not updating | Ensure all required fields are valid |
| Audit logs not created | Check database connection and profile_audit_logs table exists |

---

**All tests complete when all checkboxes are verified! ✅**
