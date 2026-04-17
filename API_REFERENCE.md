# TrueKin Backend API Reference

Complete API endpoint documentation with examples and implementation details.

## Table of Contents
1. [Authentication](#authentication)
2. [Onboarding Endpoints](#onboarding-endpoints)
3. [Profile Endpoints](#profile-endpoints)
4. [App Management](#app-management)
5. [Error Handling](#error-handling)
6. [Testing Guide](#testing-guide)

---

## Authentication

All authenticated endpoints require these headers:

```
x-user-id: {string}          // UUID of the user
x-session-token: {string}    // Session token from auth
Content-Type: application/json
```

**Note**: The `/v1/app/version-check` endpoint does NOT require authentication.

---

## Onboarding Endpoints

### 1. POST /onboarding/name

Save user's display name during onboarding.

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/name \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Sarah"}'
```

**Request Body**:
```json
{
  "display_name": "string (required, 1-50 chars)"
}
```

**Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": null,
    "date_of_birth": null,
    "health_conditions": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

**Error (400)**:
```json
{
  "error": "Name is required"
}
```

---

### 2. POST /onboarding/gender

Save user's gender during onboarding.

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/gender \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"gender": "Male"}'
```

**Request Body**:
```json
{
  "gender": "Male | Female | Other | Prefer not to say"
}
```

**Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": "male",
    "date_of_birth": null,
    "health_conditions": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

**Error (400)**:
```json
{
  "error": "Invalid gender value. Must be one of: Male, Female, Other, Prefer not to say"
}
```

---

### 3. POST /onboarding/date-of-birth

Save user's date of birth during onboarding.

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/date-of-birth \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"date_of_birth": "1985-06-15"}'
```

**Request Body**:
```json
{
  "date_of_birth": "YYYY-MM-DD (required)"
}
```

**Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": "male",
    "date_of_birth": "1985-06-15",
    "health_conditions": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

**Errors (400)**:
```json
{
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```

```json
{
  "error": "Future date not allowed"
}
```

---

### 4. POST /onboarding/details

Save user's health conditions during onboarding.

**Request** (Multiple conditions):
```bash
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "health_conditions": ["Diabetes", "Hypertension"]
  }'
```

**Request** (With custom condition):
```bash
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "health_conditions": ["Asthma", "Migraine headaches"]
  }'
```

**Request** (No health conditions):
```bash
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "health_conditions": ["None"]
  }'
```

**Request Body**:
```json
{
  "health_conditions": ["string[] (required, min 1 item)"]
}
```

**Valid Preset Values**:
- Diabetes
- Hypertension
- Asthma
- Heart Disease
- Thyroid
- None (special value for no conditions)
- Custom text (any user-entered string, max 100 chars)

**Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": "male",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["Diabetes", "Hypertension"],
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

**Error (400)**:
```json
{
  "error": "At least one health condition is required"
}
```

---

### 5. POST /onboarding/routine

Save user's preferred medicine routine times.

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/routine \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "routine_times": ["morning", "evening"]
  }'
```

**Request Body**:
```json
{
  "routine_times": ["morning | afternoon | evening | night"]
}
```

**Response (200)**:
```json
{
  "success": true,
  "onboarding_completed": true
}
```

**Error (400)**:
```json
{
  "error": "At least one routine time is required"
}
```

---

## Profile Endpoints

### 1. GET /v1/profile/me

Get current user's profile.

**Request**:
```bash
curl -X GET http://localhost:4000/v1/profile/me \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789"
```

**Response (200)**:
```json
{
  "success": true,
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": "male",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["Diabetes"],
    "avatar_url": null,
    "onboarding_completed": true
  }
}
```

---

### 2. POST /v1/profile/update

Update user's display name.

**Request**:
```bash
curl -X POST http://localhost:4000/v1/profile/update \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Sarah Johnson"}'
```

**Response (200)**:
```json
{
  "success": true,
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah Johnson",
    "gender": "male",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["Diabetes"],
    "avatar_url": null,
    "onboarding_completed": true
  }
}
```

---

### 3. POST /v1/profile/complete-onboarding

Mark onboarding as complete.

**Request**:
```bash
curl -X POST http://localhost:4000/v1/profile/complete-onboarding \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Onboarding completed"
}
```

---

## App Management

### 1. POST /v1/app/version-check

Check app version and update availability. **No authentication required**.

**Request** (Optional Update Available):
```bash
curl -X POST http://localhost:4000/v1/app/version-check \
  -H "Content-Type: application/json" \
  -d '{
    "appVersion": "1.0.0",
    "appName": "TrueKin",
    "platform": "ios",
    "buildNumber": "42",
    "osVersion": "14.5",
    "deviceModel": "iPhone12,1"
  }'
```

**Request Body**:
```json
{
  "appVersion": "1.0.0 (required, X.Y.Z format)",
  "appName": "TrueKin (required)",
  "platform": "ios | android (required)",
  "buildNumber": "string (optional)",
  "osVersion": "string (optional)",
  "deviceModel": "string (optional)"
}
```

**Response - Optional Update (200)**:
```json
{
  "success": true,
  "updateAvailable": true,
  "updateRequired": false,
  "currentVersion": "1.0.0",
  "latestVersion": "1.2.0",
  "minimumSupportedVersion": "1.0.0",
  "updateType": "optional",
  "updateUrl": "https://apps.apple.com/app/truekin/id123456",
  "releaseNotes": "New features and bug fixes...",
  "changeLog": [
    {
      "version": "1.2.0",
      "date": "2026-04-17",
      "features": ["Feature 1", "Feature 2"],
      "bugFixes": ["Fix 1", "Fix 2"]
    }
  ],
  "skipAvailable": true
}
```

**Response - Force Update Required (200)**:
```json
{
  "success": true,
  "updateAvailable": true,
  "updateRequired": true,
  "currentVersion": "0.9.0",
  "latestVersion": "1.2.0",
  "minimumSupportedVersion": "1.0.0",
  "updateType": "required",
  "updateUrl": "https://play.google.com/store/apps/details?id=com.careloop.truekin",
  "releaseNotes": "Critical security update required",
  "skipAvailable": false
}
```

**Response - No Update Available (200)**:
```json
{
  "success": true,
  "updateAvailable": false,
  "updateRequired": false,
  "currentVersion": "1.2.0",
  "latestVersion": "1.2.0",
  "minimumSupportedVersion": "1.0.0",
  "updateType": "none"
}
```

---

## Error Handling

### Standard Error Responses

**Validation Error (400)**:
```json
{
  "error": "Invalid request body or validation failed"
}
```

**Unauthorized (401)**:
```json
{
  "error": "Unauthorized"
}
```

**Server Error (500)**:
```json
{
  "error": "Internal server error"
}
```

---

## Testing Guide

### Complete Onboarding Flow

```bash
#!/bin/bash

USER_ID="550e8400-e29b-41d4-a716-446655440000"
SESSION_TOKEN="abc123xyz789"

# Step 1: Save name
curl -X POST http://localhost:4000/onboarding/name \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Sarah"}'

# Step 2: Save gender
curl -X POST http://localhost:4000/onboarding/gender \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gender": "Female"}'

# Step 3: Save date of birth
curl -X POST http://localhost:4000/onboarding/date-of-birth \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date_of_birth": "1985-06-15"}'

# Step 4: Save health conditions
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"health_conditions": ["Diabetes", "Hypertension"]}'

# Step 5: Save routine
curl -X POST http://localhost:4000/onboarding/routine \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"routine_times": ["morning", "evening"]}'

# Step 6: Complete onboarding
curl -X POST http://localhost:4000/v1/profile/complete-onboarding \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Get final profile
curl -X GET http://localhost:4000/v1/profile/me \
  -H "x-user-id: $USER_ID" \
  -H "x-session-token: $SESSION_TOKEN"
```

### Version Check Testing

```bash
#!/bin/bash

# Optional update available
curl -X POST http://localhost:4000/v1/app/version-check \
  -H "Content-Type: application/json" \
  -d '{
    "appVersion": "1.0.0",
    "appName": "TrueKin",
    "platform": "ios"
  }'

# Force update required
curl -X POST http://localhost:4000/v1/app/version-check \
  -H "Content-Type: application/json" \
  -d '{
    "appVersion": "0.9.0",
    "appName": "TrueKin",
    "platform": "android"
  }'

# No update needed
curl -X POST http://localhost:4000/v1/app/version-check \
  -H "Content-Type: application/json" \
  -d '{
    "appVersion": "1.2.0",
    "appName": "TrueKin",
    "platform": "ios"
  }'
```

---

## Implementation Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /onboarding/name | ✅ Complete | Display name validation (1-50 chars) |
| POST /onboarding/gender | ✅ Complete | Enum validation, lowercase storage |
| POST /onboarding/date-of-birth | ✅ Complete | ISO format validation, future date check |
| POST /onboarding/details | ✅ Complete | Flexible health conditions array |
| POST /onboarding/routine | ✅ Complete | Valid routine times validation |
| POST /v1/profile/complete-onboarding | ✅ Complete | Marks onboarding_completed = true |
| GET /v1/profile/me | ✅ Complete | Returns full profile |
| POST /v1/profile/update | ✅ Complete | Update display name |
| POST /v1/app/version-check | ✅ Complete | No auth required, semantic versioning |

---

## Version History

- **1.1** (2026-04-17) - Added app version check endpoint
- **1.0** (2026-04-17) - Initial onboarding and profile endpoints
