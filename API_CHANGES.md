# TrueKin Backend API Changes

## Latest Updates (Session: 2026-04-20)

### Summary
This document tracks all API changes, bug fixes, and feature implementations made in this session.

---

## 1. Authentication & Session Management

### 1.1 OTP Verification Endpoint (`POST /v1/auth/otp/verify`)

**Updated Response Format:**

```json
{
  "error": null,
  "is_new_user": false,
  "onboardingCompleted": false,
  "userProfile": {
    "id": "uuid",
    "phone": "918547032018",
    "display_name": null,
    "gender": null,
    "date_of_birth": null,
    "health_conditions": null,
    "avatar_url": null,
    "onboarding_completed": false,
    "user_journey_selection_shown": false,
    "completion_percentage": 0
  },
  "sessionToken": "abc123def456...",
  "userId": "uuid"
}
```

**Changes:**
- Response now includes `sessionToken` (plain text for client to store)
- Response includes `userId` for reference

**Session Management:**
- Session is automatically created in `auth_sessions` table
- Session token is hashed (SHA256) before storage
- Sessions expire in 30 days
- Session is validated on every authenticated request

---

## 2. Profile Management

### 2.1 Get User Profile (`GET /v1/profile/me`)

**Request Headers:**
```
x-user-id: uuid
x-session-token: sessionToken
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "phone": "918547032018",
    "email": "user@example.com",
    "email_verified": false,
    "display_name": "John Doe",
    "gender": "male",
    "age": 30,
    "avatar_url": null,
    "date_of_birth": "1994-01-15",
    "address": "123 Main Street, City",
    "health_conditions": [],
    "blood_group": "O+",
    "height": 180,
    "weight": 75,
    "food_allergies": [],
    "medicine_allergies": [],
    "onboarding_completed": false,
    "user_journey_selection_shown": false,
    "completion_percentage": 25,
    "created_at": "2026-04-20T10:00:00Z",
    "updated_at": "2026-04-20T10:00:00Z"
  }
}
```

**Requirements:**
- Both `x-user-id` and `x-session-token` headers must be present
- Session token must exist in `auth_sessions` table
- Session must not be expired or revoked

---

### 2.2 Update Display Name (`POST /v1/profile/update`)

**Request:**
```json
{
  "display_name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "profile": { ... }
}
```

**Validation:**
- Name: 1-50 characters
- Completion percentage auto-updates

---

### 2.3 Update Address (`POST /v1/profile/address`)

**NEW ENDPOINT**

**Request:**
```json
{
  "address": "123 Main Street, City, State 12345"
}
```

**Response:**
```json
{
  "success": true,
  "profile": { ... }
}
```

**Validation:**
- Address: 10-200 characters
- Completion percentage auto-updates (address = 10% of personal info)

---

## 3. Profile Completion Percentage

### 3.1 Auto-Calculation

**Implemented via:**
- Database triggers on `profiles` table
- Application-level function: `calculateCompletionPercentage()`

**Scoring System (Total: 100%):**

**Personal Information (50%):**
- display_name: 10%
- gender: 10%
- date_of_birth: 10%
- email (verified): 10%
- address: 10%

**Health Information (50%):**
- health_conditions: 10%
- blood_group: 10%
- height: 10%
- weight: 10%
- food_allergies OR medicine_allergies: 10%

**When Updated:**
- Automatically recalculated on every profile update
- Returned in all API responses that include profile data
- Stored in database via trigger function

---

## 4. Authentication OTP Service

### 4.1 Bypass Login for Testing

**Phone Number:** `918547032018` (with or without country code: `8547032018`)

**Features:**
- Accepts any 6-digit OTP code
- Skips SMS delivery
- Full user creation/login flow works normally
- Returns complete session with sessionToken

**Endpoints:**
- `POST /v1/auth/otp/send` - Returns success without storing OTP
- `POST /v1/auth/otp/verify` - Accepts any 6-digit code

---

## 5. Session Management

### 5.1 Session Storage

**Table:** `auth_sessions`

**Columns:**
- `id`: UUID (primary key)
- `user_id`: UUID (references auth.users)
- `session_token_hash`: TEXT (SHA256 hash of token)
- `expires_at`: TIMESTAMPTZ (30 days from creation)
- `revoked_at`: TIMESTAMPTZ (NULL unless revoked)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

### 5.2 Session Validation

**Function:** `assertValidSession(userId, sessionToken)`

**Validates:**
1. User exists in auth.users
2. Session exists in auth_sessions
3. Session token hash matches
4. Session not revoked
5. Session not expired

**Throws:** "Unauthorized" or specific error message

---

## 6. Database Migrations

### 6.1 New Migration: `016_add_completion_percentage_trigger.sql`

**Creates:**
- `calculate_profile_completion_percentage(profile_id)` function
- `update_profile_completion_percentage()` trigger function
- BEFORE UPDATE trigger on profiles table
- AFTER INSERT trigger on profiles table
- Updates all existing profiles with calculated percentages

**Calculation Logic:**
- Matches application-level `calculateCompletionPercentage()` function
- Uses weighted scoring system (personal 50%, health 50%)

---

## 7. API Response Standardization

### 7.1 Successful OTP Verification Response

```json
{
  "error": null,
  "is_new_user": boolean,
  "onboardingCompleted": boolean,
  "userProfile": { ... },
  "sessionToken": "string",
  "userId": "uuid"
}
```

### 7.2 Error Response Format

```json
{
  "error": "error message",
  "isNewUser": false
}
```

---

## 8. Support Tickets System

### 8.1 Submit Support Ticket (`POST /v1/support/submit-ticket`)

**Request:**
```json
{
  "issue_type": "bug|feature_request|other",
  "subject": "Brief description",
  "message": "Detailed message"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ticket submitted successfully",
  "ticket_id": "TKT-20260420-0001"
}
```

**Validation:**
- Subject: 1-255 characters
- Message: 1-5000 characters

---

## 9. Commits This Session

| Commit | Description |
|--------|-------------|
| `beeeac3` | Fix: Use proper response format with sessionToken in auth endpoint |
| `45a0b7c` | Fix: Implement proper session management for auth flow |
| `35aabff` | Add address column support and create API endpoint for updating address |
| `802abec` | Fix: Select only existing profile columns to avoid migration dependency |
| `3a9c0d5` | Calculate and return completion_percentage in auth response |
| `8feab4f` | Add automatic profile completion_percentage calculation |
| `2f43100` | Add error logging for profile fetch queries |
| `edf468f` | Fix: Update API response format to match frontend contract |
| `5f81e77` | Fix: Return complete profile data in OTP verification |

---

## 10. Frontend Integration Checklist

### 10.1 After Login
- [ ] Store `sessionToken` in secure storage
- [ ] Store `userId` for reference
- [ ] Store `userProfile` object
- [ ] Check `isNewUser` to decide onboarding flow
- [ ] Check `onboardingCompleted` status

### 10.2 For Authenticated Requests
- [ ] Include headers:
  ```
  x-user-id: {userId}
  x-session-token: {sessionToken}
  ```
- [ ] Handle 401 errors (session expired)
- [ ] Handle 400 errors (profile incomplete)

### 10.3 Profile Updates
- [ ] Call `POST /v1/profile/address` to update address
- [ ] Call `POST /v1/profile/update` to update display name
- [ ] Monitor `completion_percentage` to show progress

---

## 11. Known Issues & Notes

### 11.1 Column Existence
- Optional profile columns (address, blood_group, health_conditions, etc.) return NULL if migrations haven't been applied
- Backend gracefully handles missing columns - no errors thrown

### 11.2 Phone Number Formats
- Bypass phone `918547032018` accepts both formats:
  - `918547032018` (with country code)
  - `8547032018` (without country code)
- Both resolve to same user account

### 11.3 Completion Percentage
- Auto-calculated on every profile update
- Database trigger updates the value
- Application-level function ensures consistency
- Always returns 0-100 (clamped)

---

## 12. Testing with Bypass Phone

**Bypass Phone:** `918547032018` or `8547032018`

**Steps:**
1. Call `POST /v1/auth/otp/send` with bypass phone
2. Response: `{ "success": true, "message": "OTP sent to your phone (test mode - bypass enabled)" }`
3. Call `POST /v1/auth/otp/verify` with any 6-digit OTP
4. Response: Full user profile, sessionToken, userId
5. Use sessionToken for authenticated requests

---

## 13. API Endpoints Summary

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---|---------|
| POST | `/v1/auth/otp/send` | No | Send OTP to phone |
| POST | `/v1/auth/otp/verify` | No | Verify OTP and create session |
| GET | `/v1/profile/me` | Yes | Get current user profile |
| POST | `/v1/profile/update` | Yes | Update display name |
| POST | `/v1/profile/address` | Yes | Update address |
| POST | `/v1/profile/email/send-otp` | Yes | Send email verification OTP |
| POST | `/v1/profile/email/verify-otp` | Yes | Verify email OTP |
| POST | `/v1/support/submit-ticket` | Yes | Submit support ticket |
| GET | `/v1/support/tickets` | Yes | Get user's tickets |
| GET | `/v1/support/tickets/:ticket_id` | Yes | Get ticket details |

---

## 14. Environment & Dependencies

**Node Version:** v18+
**Key Dependencies:**
- fastify
- supabase/supabase-js
- zod (validation)
- crypto (built-in)

---

**Last Updated:** 2026-04-20
**Total Commits This Session:** 9
**Files Modified:** ~15
