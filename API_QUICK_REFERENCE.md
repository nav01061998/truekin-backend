# TrueKin Backend API - Quick Reference

## 17-Field UserProfile Structure

All profile endpoints return this exact structure:

```json
{
  "id": "uuid",
  "phone": "919876543210",
  "display_name": "John Doe",
  "gender": "male",
  "date_of_birth": "1990-01-15",
  "health_conditions": ["diabetes"],
  "avatar_url": "https://...",
  "onboarding_completed": true,
  "user_journey_selection_shown": true,
  "email": "john@example.com",
  "email_verified": true,
  "address": "123 Health Street, NYC",
  "blood_group": "O+",
  "height": 180,
  "weight": 75,
  "food_allergies": ["peanuts"],
  "medicine_allergies": []
}
```

## Authentication

### POST /v1/auth/otp/send
**Request**: `{ "phone": "919876543210" }`
**Response**: `{ "success": true, "message": "OTP sent..." }`

### POST /v1/auth/otp/verify
**Request**: `{ "phone": "919876543210", "otp": "123456" }`
**Response**: 
```json
{
  "success": true,
  "user_id": "uuid",
  "is_new_user": false,
  "token_hash": "session-token-abc123...",
  "user": { ...17-field UserProfile... }
}
```

## Profile Management

### GET /v1/profile/me
**Headers**: `x-user-id`, `x-session-token`
**Response**: 17-field UserProfile (direct, not wrapped)

### POST /v1/profile/update
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "display_name": "New Name" }`
**Response**: 17-field UserProfile

### POST /v1/profile/address
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "address": "123 Main St, City" }`
**Response**: 17-field UserProfile

## Onboarding

### POST /onboarding/name
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "display_name": "John" }`
**Response**: 17-field UserProfile

### POST /onboarding/gender
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "gender": "male|female|other|prefer not to say" }`
**Response**: 17-field UserProfile

### POST /onboarding/date-of-birth
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "date_of_birth": "1990-01-15" }`
**Response**: 17-field UserProfile

### POST /onboarding/details
**Headers**: `x-user-id`, `x-session-token`
**Request**:
```json
{
  "address": "string (10-200 chars)",
  "blood_group": "O+|O-|A+|A-|B+|B-|AB+|AB-",
  "height": number (100-250),
  "weight": number (20-250),
  "health_conditions": ["condition1", "condition2"],
  "food_allergies": ["peanuts"],
  "medicine_allergies": []
}
```
**Response**: 17-field UserProfile

## Email Verification

### POST /v1/profile/email/send-otp
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "email": "user@example.com" }`
**Response**: 
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "masked_email": "u***@example.com"
}
```

### POST /v1/profile/email/verify-otp
**Headers**: `x-user-id`, `x-session-token`
**Request**: `{ "email": "user@example.com", "otp": "123456" }`
**Response**: 
```json
{
  "success": true,
  "message": "Email verified successfully",
  "profile": { ...17-field UserProfile... }
}
```

## App Information

### POST /v1/app/version-check
**Request**:
```json
{
  "appVersion": "1.0.0",
  "appName": "TrueKin",
  "platform": "ios|android|web",
  "buildNumber": "42",
  "osVersion": "17.4.1",
  "deviceModel": "iPhone 14 Pro"
}
```

**Response**: 
```json
{
  "success": true,
  "updateAvailable": false,
  "updateRequired": false,
  "currentVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "minimumSupportedVersion": "0.9.0",
  "updateType": "none|optional|required"
}
```

## Standard Headers for Authenticated Endpoints

```
x-user-id: user-uuid
x-session-token: session-token-from-login
Content-Type: application/json
```

## Error Responses

### 400 Bad Request
```json
{ "error": "Invalid request body" }
```

### 401 Unauthorized
```json
{ "error": "Unauthorized" }
```

### 422 Unprocessable Entity
```json
{ "error": "Validation error message" }
```

## Testing with Bypass Phone

**Phone**: `918547032018` or `8547032018` (same user)
**OTP**: Any 6 digits work (e.g., `000000`)
**User**: Creates a test user that persists across multiple logins

## Key Points

✓ All responses return exactly 17 fields in UserProfile
✓ No `age`, `completion_percentage`, `created_at`, `updated_at` in responses
✓ Session tokens are strings (not hashed) - store on client
✓ All authenticated endpoints require both `x-user-id` and `x-session-token` headers
✓ Phone format: accepts with/without country code (918547032018 or 8547032018)
✓ Onboarding endpoints work independently or as batch via /onboarding/details

## Bypass Testing Flow

1. POST /v1/auth/otp/send with phone `918547032018` → get success message
2. POST /v1/auth/otp/verify with any OTP → get token_hash and user profile
3. Store token_hash as sessionToken locally
4. Use in all subsequent authenticated requests with headers
5. GET /v1/profile/me to fetch latest profile
6. POST to onboarding endpoints to update profile

