# TrueKin Onboarding Flow

Complete onboarding flow documentation with examples and test cases.

## Overview

The onboarding flow consists of 4 steps that collect user information:

1. **Name** - User's display name
2. **Date of Birth** - User's date of birth (ISO format)
3. **Health Conditions** - User's health conditions
4. **Routine** - User's preferred medicine routine times (marks onboarding complete)

## Step 1: Save User Name

**Endpoint**: `POST /onboarding/name`

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/name \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Sarah"}'
```

**Success Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "date_of_birth": null,
    "health_conditions": null,
    "gender": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

**Error Response (400)**:
```json
{
  "error": "Name is required"
}
```

## Step 2: Save Date of Birth

**Endpoint**: `POST /onboarding/date-of-birth`

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/date-of-birth \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"date_of_birth": "1985-06-15"}'
```

**Success Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "date_of_birth": "1985-06-15",
    "health_conditions": null,
    "gender": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

**Error Cases**:
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

## Step 3: Save Health Conditions

**Endpoint**: `POST /onboarding/details`

### Example 1: Multiple preset conditions

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "health_conditions": ["Diabetes", "Hypertension"]
  }'
```

**Success Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["Diabetes", "Hypertension"],
    "gender": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

### Example 2: Custom condition

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "health_conditions": ["Asthma", "Migraine headaches"]
  }'
```

### Example 3: No health conditions

**Request**:
```bash
curl -X POST http://localhost:4000/onboarding/details \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "x-session-token: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "health_conditions": ["None"]
  }'
```

**Success Response**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["None"],
    "gender": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

## Step 4: Save Routine (Completes Onboarding)

**Endpoint**: `POST /onboarding/routine`

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

**Success Response (200)**:
```json
{
  "success": true,
  "onboarding_completed": true
}
```

**Valid routine_times values**:
- `morning`
- `afternoon`
- `evening`
- `night`

**Error Response (400)**:
```json
{
  "error": "At least one routine time is required"
}
```

## Complete Onboarding Sequence

### 1. User enters name
```bash
POST /onboarding/name
{display_name: "Sarah"}
→ Returns profile with onboarding_completed: false
```

### 2. User selects date of birth
```bash
POST /onboarding/date-of-birth
{date_of_birth: "1985-06-15"}
→ Returns profile with date_of_birth set, onboarding_completed: false
```

### 3. User selects health conditions
```bash
POST /onboarding/details
{health_conditions: ["Diabetes", "Hypertension"]}
→ Returns profile with health_conditions set, onboarding_completed: false
```

### 4. User selects routine (Final step)
```bash
POST /onboarding/routine
{routine_times: ["morning", "evening"]}
→ Returns {success: true, onboarding_completed: true}
→ Redirect to home screen
```

## Health Conditions Semantics

The `health_conditions` field follows these semantics:

- **`null`** = User has not yet visited the health conditions screen (show reminder on next login)
- **`[]`** = User visited the screen but didn't select any conditions (don't show again)
- **`["None"]`** = User explicitly selected "No health conditions"
- **`["Diabetes", "Hypertension"]`** = User selected these conditions

### Preset Health Conditions
These are standard options shown to the user:
- Diabetes
- Hypertension
- Asthma
- Heart Disease
- Thyroid

### Custom Conditions
Users can also enter custom health conditions when selecting "Other":
- "Migraine headaches"
- Any user-entered text (max 100 characters)

## Authentication

All endpoints require these headers:

```
x-user-id: {UUID}         // User's unique ID
x-session-token: {string} // Session token from auth
Content-Type: application/json
```

**Missing auth (401 response)**:
```json
{
  "error": "Unauthorized"
}
```

## Error Handling

### Validation Errors (400)
Returned when request data is invalid:
```json
{
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```

### Unauthorized (401)
Returned when auth headers are missing or invalid:
```json
{
  "error": "Unauthorized"
}
```

### Server Errors (500)
Returned for database or server issues:
```json
{
  "error": "Failed to save routine"
}
```

## Testing Checklist

### Name Endpoint
- [ ] Save valid name (1-50 chars)
- [ ] Empty name validation
- [ ] Name longer than 50 chars validation
- [ ] Response includes all profile fields
- [ ] Missing auth headers returns 401

### Date of Birth Endpoint
- [ ] Save valid date (YYYY-MM-DD format)
- [ ] Invalid date format validation
- [ ] Future date validation
- [ ] Invalid date (Feb 30) validation
- [ ] Response preserves previously saved name

### Health Conditions Endpoint
- [ ] Save multiple preset conditions
- [ ] Save custom condition
- [ ] Save "None" condition
- [ ] Empty array validation
- [ ] Response preserves name and DOB

### Routine Endpoint
- [ ] Save single routine time
- [ ] Save multiple routine times
- [ ] Valid values: morning, afternoon, evening, night
- [ ] Invalid routine time validation
- [ ] Empty array validation
- [ ] Response includes onboarding_completed: true

### End-to-End Flow
- [ ] Complete full 4-step onboarding
- [ ] Each step preserves data from previous steps
- [ ] Profile persists across requests
- [ ] onboarding_completed changes from false to true at routine step

## Database Impact

After completing all 4 steps, the user profile will have:

```sql
SELECT * FROM profiles WHERE id = 'user-id';
```

```
id                   | 550e8400-e29b-41d4-a716-446655440000
phone                | +1234567890
display_name         | Sarah
date_of_birth        | 1985-06-15
health_conditions    | ["Diabetes", "Hypertension"]
gender               | null
avatar_url           | null
onboarding_completed | true
created_at           | 2026-04-17T10:30:00Z
updated_at           | 2026-04-17T10:35:00Z
```

## Frontend Integration

Use the `postJson` utility from `@/lib/api`:

```typescript
const auth = {
  userId: session.userId,
  sessionToken: session.sessionToken,
};

// Step 1: Save name
const nameResponse = await postJson("/onboarding/name", {
  display_name: "Sarah"
}, auth);

// Step 2: Save date of birth
const dobResponse = await postJson("/onboarding/date-of-birth", {
  date_of_birth: "1985-06-15"
}, auth);

// Step 3: Save health conditions
const healthResponse = await postJson("/onboarding/details", {
  health_conditions: ["Diabetes", "Hypertension"]
}, auth);

// Step 4: Save routine (completes onboarding)
const routineResponse = await postJson("/onboarding/routine", {
  routine_times: ["morning", "evening"]
}, auth);

// After routine step completes with onboarding_completed: true
// → Redirect to home screen
```
