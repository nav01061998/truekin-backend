# Frontend Integration Guide

## Quick Start

### 1. Authentication Flow

#### Step 1: Send OTP
```typescript
// Request OTP
POST /v1/auth/otp/send
Content-Type: application/json

{
  "phone": "918547032018"  // or "+918547032018" or "8547032018"
}

// Response
{
  "success": true,
  "message": "OTP sent to your phone"
}
```

#### Step 2: Verify OTP & Get Session
```typescript
// Verify OTP
POST /v1/auth/otp/verify
Content-Type: application/json

{
  "phone": "918547032018",
  "otp": "123456"
}

// Response (SUCCESS)
{
  "error": null,
  "is_new_user": false,
  "onboardingCompleted": true,
  "userProfile": {
    "id": "67172ba7-4268-42d2-8fcf-cae3b563368f",
    "phone": "918547032018",
    "display_name": "John Doe",
    "gender": "male",
    "date_of_birth": "1994-01-15",
    "health_conditions": [],
    "avatar_url": null,
    "onboarding_completed": true,
    "user_journey_selection_shown": false,
    "completion_percentage": 50
  },
  "sessionToken": "abc123def456ghi789...",
  "userId": "67172ba7-4268-42d2-8fcf-cae3b563368f"
}

// Response (ERROR)
{
  "error": "Invalid OTP",
  "is_new_user": false
}
```

#### Step 3: Store Session Data
```typescript
// Store in secure storage
localStorage.setItem('sessionToken', response.sessionToken);
localStorage.setItem('userId', response.userId);
localStorage.setItem('userProfile', JSON.stringify(response.userProfile));

// Or use more secure storage:
// - AsyncStorage (React Native)
// - SecureStorage (mobile)
// - Session storage (web)
```

---

## 2. Making Authenticated Requests

### Required Headers
```typescript
const headers = {
  'x-user-id': userId,
  'x-session-token': sessionToken,
  'Content-Type': 'application/json'
};
```

### Example: Get User Profile
```typescript
// GET /v1/profile/me
fetch('http://localhost:4000/v1/profile/me', {
  method: 'GET',
  headers: {
    'x-user-id': userId,
    'x-session-token': sessionToken,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    // Update user profile in app state
    setUserProfile(data.profile);
  } else {
    // Handle error
  }
});
```

---

## 3. Profile Management

### 3.1 Update Display Name
```typescript
POST /v1/profile/update
Headers: x-user-id, x-session-token
Content-Type: application/json

{
  "display_name": "John Doe"
}

// Response
{
  "success": true,
  "profile": { ... }
}
```

### 3.2 Update Address
```typescript
POST /v1/profile/address
Headers: x-user-id, x-session-token
Content-Type: application/json

{
  "address": "123 Main Street, New York, NY 10001"
}

// Response
{
  "success": true,
  "profile": { ... }
}
```

### 3.3 Profile Completion Percentage

The profile includes `completion_percentage` field:

```typescript
const percentage = userProfile.completion_percentage;  // 0-100

if (percentage === 100) {
  // Show "Profile Complete" badge
} else if (percentage >= 50) {
  // Show "Profile 50% Complete" with progress bar
} else {
  // Show "Complete Your Profile" prompt
}
```

**Scoring Breakdown:**
- Each field completion = 1/10 of its category (10%)
- Personal Info (50%): display_name, gender, date_of_birth, email+verified, address
- Health Info (50%): health_conditions, blood_group, height, weight, allergies

---

## 4. Email Verification (Profile OTP)

### 4.1 Send Email Verification OTP
```typescript
POST /v1/profile/email/send-otp
Headers: x-user-id, x-session-token

{
  "email": "user@example.com"
}

// Response
{
  "success": true,
  "message": "OTP sent to your email",
  "masked_email": "us***@example.com"
}
```

### 4.2 Verify Email OTP
```typescript
POST /v1/profile/email/verify-otp
Headers: x-user-id, x-session-token

{
  "email": "user@example.com",
  "otp": "123456"
}

// Response
{
  "success": true,
  "message": "Email verified successfully",
  "profile": { ... }
}
```

---

## 5. Error Handling

### Common Error Codes

| Status | Error | Solution |
|--------|-------|----------|
| 400 | "Invalid phone format" | Ensure phone is 10 or 12 digits starting with 6-9 or 91 |
| 400 | "OTP expired or not found" | Request new OTP |
| 400 | "Invalid OTP" | Check OTP digits |
| 401 | "Unauthorized" | Headers missing or invalid session |
| 400 | "Session expired. Please sign in again." | Re-authenticate |
| 429 | "Maximum OTP verification attempts exceeded" | Wait before retrying |

### Error Response Example
```typescript
{
  "error": "Session expired. Please sign in again.",
  "is_new_user": false
}

// Handle errors
if (response.error) {
  if (response.error.includes('Unauthorized')) {
    // Redirect to login
  } else if (response.error.includes('Session expired')) {
    // Refresh session or redirect to login
  } else {
    // Show error message to user
  }
}
```

---

## 6. Session Management

### 6.1 Session Expiration
- Sessions expire in 30 days
- Check for 401 responses and redirect to login
- Store session token securely

### 6.2 Logout
```typescript
// Clear stored session data
localStorage.removeItem('sessionToken');
localStorage.removeItem('userId');
localStorage.removeItem('userProfile');

// Redirect to login
navigate('/login');
```

### 6.3 Session Validation
```typescript
// Check if session is valid before making requests
const isSessionValid = () => {
  const sessionToken = localStorage.getItem('sessionToken');
  const userId = localStorage.getItem('userId');
  return sessionToken && userId;
};

if (!isSessionValid()) {
  navigate('/login');
}
```

---

## 7. Support Tickets

### 7.1 Submit Support Ticket
```typescript
POST /v1/support/submit-ticket
Headers: x-user-id, x-session-token

{
  "issue_type": "bug",  // or "feature_request", "other"
  "subject": "App crashes on login",
  "message": "The app crashes whenever I try to login with my phone number..."
}

// Response
{
  "success": true,
  "message": "Ticket submitted successfully",
  "ticket_id": "TKT-20260420-0001"
}
```

### 7.2 Get User's Tickets
```typescript
GET /v1/support/tickets
Headers: x-user-id, x-session-token

// Response
{
  "success": true,
  "tickets": [
    {
      "id": "uuid",
      "ticket_id": "TKT-20260420-0001",
      "user_id": "uuid",
      "issue_type": "bug",
      "subject": "App crashes on login",
      "message": "...",
      "status": "open",  // or "in-progress", "resolved"
      "created_at": "2026-04-20T10:00:00Z",
      "updated_at": "2026-04-20T10:00:00Z",
      "resolved_at": null
    }
  ]
}
```

### 7.3 Get Ticket Details
```typescript
GET /v1/support/tickets/TKT-20260420-0001
Headers: x-user-id, x-session-token

// Response
{
  "success": true,
  "ticket": { ... }
}
```

---

## 8. Testing with Bypass Phone

**For development/testing only**

### Bypass Phone Number
```
918547032018  (with country code)
or
8547032018    (without country code)
```

### Testing Steps
```typescript
// Step 1: Send OTP (bypass mode)
POST /v1/auth/otp/send
{ "phone": "918547032018" }

// Response: { "success": true, "message": "OTP sent to your phone (test mode - bypass enabled)" }

// Step 2: Verify with ANY 6-digit code
POST /v1/auth/otp/verify
{ 
  "phone": "918547032018",
  "otp": "000000"  // Any 6 digits work!
}

// Step 3: Get full session and profile
// Response includes: sessionToken, userId, userProfile
```

---

## 9. State Management Recommendations

### React/Redux Example
```typescript
// authSlice.ts
const initialState = {
  sessionToken: null,
  userId: null,
  userProfile: null,
  isLoading: false,
  error: null,
  isAuthenticated: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (state, action) => {
      state.sessionToken = action.payload.sessionToken;
      state.userId = action.payload.userId;
      state.userProfile = action.payload.userProfile;
      state.isAuthenticated = true;
    },
    clearSession: (state) => {
      state.sessionToken = null;
      state.userId = null;
      state.userProfile = null;
      state.isAuthenticated = false;
    },
    updateProfile: (state, action) => {
      state.userProfile = action.payload;
    }
  }
});

// Usage
dispatch(setSession({
  sessionToken: response.sessionToken,
  userId: response.userId,
  userProfile: response.userProfile
}));
```

### React Context Example
```typescript
// AuthContext.tsx
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    sessionToken: null,
    userId: null,
    userProfile: null,
    isAuthenticated: false
  });

  const login = async (phone, otp) => {
    const response = await verifyOtp(phone, otp);
    if (!response.error) {
      setAuth({
        sessionToken: response.sessionToken,
        userId: response.userId,
        userProfile: response.userProfile,
        isAuthenticated: true
      });
    }
    return response;
  };

  const logout = () => {
    setAuth({
      sessionToken: null,
      userId: null,
      userProfile: null,
      isAuthenticated: false
    });
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## 10. Common Patterns

### 10.1 API Call Helper
```typescript
const apiCall = async (endpoint, method = 'GET', body = null) => {
  const sessionToken = localStorage.getItem('sessionToken');
  const userId = localStorage.getItem('userId');

  if (!sessionToken || !userId) {
    throw new Error('Unauthorized');
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-session-token': sessionToken
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`http://localhost:4000${endpoint}`, options);
  const data = await response.json();

  if (response.status === 401) {
    // Session expired - redirect to login
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');
    window.location.href = '/login';
  }

  return data;
};

// Usage
const profile = await apiCall('/v1/profile/me');
const updated = await apiCall('/v1/profile/update', 'POST', { display_name: 'Jane' });
```

### 10.2 Loading & Error States
```typescript
const [state, setState] = useState({
  loading: false,
  data: null,
  error: null
});

const fetchProfile = async () => {
  setState({ loading: true, data: null, error: null });
  try {
    const response = await apiCall('/v1/profile/me');
    if (response.success) {
      setState({ loading: false, data: response.profile, error: null });
    } else {
      setState({ loading: false, data: null, error: response.error });
    }
  } catch (err) {
    setState({ loading: false, data: null, error: err.message });
  }
};
```

---

## 11. TypeScript Interfaces

```typescript
interface UserProfile {
  id: string;
  phone: string;
  display_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  health_conditions: string[] | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  user_journey_selection_shown: boolean;
  completion_percentage: number;
}

interface AuthResponse {
  error: string | null;
  isNewUser: boolean;
  onboardingCompleted: boolean;
  userProfile?: UserProfile;
  sessionToken?: string;
  userId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
  message?: string;
}
```

---

## 12. Base URL Configuration

```typescript
// config.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// Use throughout the app
const response = await fetch(`${API_BASE_URL}/v1/auth/otp/send`, options);
```

**.env.local:**
```
REACT_APP_API_URL=http://localhost:4000
REACT_APP_API_URL_PROD=https://api.truekin.app
```

---

## 13. Debugging Tips

### Check Session Headers
```typescript
// Verify headers are being sent
fetch('http://localhost:4000/v1/profile/me', {
  headers: {
    'x-user-id': userId,
    'x-session-token': sessionToken
  }
}).then(r => {
  console.log('Response Status:', r.status);
  console.log('Headers Sent:', r.request.headers); // May not work in all browsers
  return r.json();
}).then(console.log);
```

### Monitor API Calls
```typescript
// Use browser DevTools Network tab
// Filter by /v1/ to see all API calls
// Check:
// - Status code (200, 401, 400, etc.)
// - Request headers
// - Response body
// - Response time
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 401 errors | Check sessionToken and userId in headers |
| Session expires | Implement refresh mechanism or re-login |
| CORS errors | Ensure backend has proper CORS headers |
| 400 errors | Check request body format and validation |
| Slow responses | Check network tab, may be rate limiting |

---

**Last Updated:** 2026-04-20
**API Version:** v1
**Backend Base URL:** http://localhost:4000 (development)
