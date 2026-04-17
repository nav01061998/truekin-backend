# User Journey Selection Flag - Frontend Integration Guide

## Overview

The backend now tracks whether the **User Journey Selection screen** has been shown to the user. This prevents showing the screen multiple times and improves user experience.

---

## Data Structure

### User Profile Field

All profile responses now include:

```typescript
{
  user: {
    id: string;
    phone: string;
    display_name: string | null;
    gender: string | null;
    date_of_birth: string | null;
    health_conditions: string[] | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
    user_journey_selection_shown: boolean;  // <-- NEW FIELD
  }
}
```

### Field Details

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `user_journey_selection_shown` | boolean | false | Whether user journey selection screen has been shown to user |

---

## API Endpoints

### 1. Get User Profile (Existing)

Returns the user's profile including the `user_journey_selection_shown` flag.

**Endpoint**: `GET /v1/profile/me`

**Request Headers**:
```
x-user-id: {UUID}
x-session-token: {string}
```

**Response**:
```json
{
  "success": true,
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": "Female",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["Diabetes", "Hypertension"],
    "avatar_url": null,
    "onboarding_completed": true,
    "user_journey_selection_shown": false
  }
}
```

### 2. Mark Journey Selection as Shown (NEW)

Call this endpoint after displaying the user journey selection screen to the user.

**Endpoint**: `POST /v1/profile/mark-journey-shown`

**Request Headers**:
```
x-user-id: {UUID}
x-session-token: {string}
Content-Type: application/json
```

**Request Body**: 
Empty or no body required

```json
{}
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "User journey selection marked as shown",
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "display_name": "Sarah",
    "gender": "Female",
    "date_of_birth": "1985-06-15",
    "health_conditions": ["Diabetes", "Hypertension"],
    "avatar_url": null,
    "onboarding_completed": true,
    "user_journey_selection_shown": true  // <-- NOW TRUE
  }
}
```

**Response Error (401 - Unauthorized)**:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Response Error (400 - Failed)**:
```json
{
  "success": false,
  "error": "Failed to mark journey as shown"
}
```

---

## Frontend Integration Flow

### On App Launch / Home Screen Load

```typescript
import { getProfile, markJourneyShown } from "@/lib/api";

// Step 1: Get user profile
const { profile } = await getProfile(auth);

// Step 2: Check if journey screen was shown before
if (!profile.user_journey_selection_shown) {
  // Step 3: Show user journey selection screen
  navigation.navigate("UserJourneySelection");
} else {
  // User already saw the screen, show home
  navigation.navigate("Home");
}
```

### After User Completes Journey Selection

```typescript
import { markJourneyShown } from "@/lib/api";

// User selected their journey/path, now mark it as shown
const { profile } = await markJourneyShown(auth);

// Save to AsyncStorage for offline support
await saveUserData({
  session: auth,
  profile: profile,  // This now includes user_journey_selection_shown: true
  timestamp: Date.now(),
});

// Navigate to home or next screen
navigation.navigate("Home");
```

### Storage Persistence

Store the flag in AsyncStorage along with other profile data:

```typescript
interface StoredUserData {
  session: {
    userId: string;
    sessionToken: string;
  };
  profile: {
    id: string;
    phone: string;
    display_name: string | null;
    gender: string | null;
    date_of_birth: string | null;
    health_conditions: string[] | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
    user_journey_selection_shown: boolean;  // <-- NEW
  };
  timestamp: number;
}

// Retrieve and use
const userData = await AsyncStorage.getItem("userData");
const { profile } = JSON.parse(userData);

if (!profile.user_journey_selection_shown) {
  // Show journey screen
}
```

---

## Usage Patterns

### Pattern 1: Show Journey Only Once

```typescript
// On app startup
const { profile } = await getProfile();

if (!profile.user_journey_selection_shown) {
  // Show journey selection screen
  showJourneySelectionModal();
}
```

### Pattern 2: Mark After Journey Selection

```typescript
const handleJourneySelection = async (selectedJourney) => {
  // User selected their journey path
  
  // Mark as shown in backend
  await markJourneyShown();
  
  // Update local cache
  const userData = JSON.parse(await AsyncStorage.getItem("userData"));
  userData.profile.user_journey_selection_shown = true;
  await AsyncStorage.setItem("userData", JSON.stringify(userData));
  
  // Navigate to next screen
  navigation.navigate("Home");
};
```

### Pattern 3: Handle Offline Scenario

```typescript
// Check local flag first (offline)
const localProfile = getCachedProfile();
if (!localProfile?.user_journey_selection_shown) {
  showJourneySelectionScreen();
} else {
  showHome();
}

// When online, sync with backend
if (isNetworkConnected()) {
  try {
    const { profile } = await getProfile();
    // Update local cache with latest from server
    updateCachedProfile(profile);
  } catch (error) {
    // Network error, use cached value
    console.log("Using cached journey flag");
  }
}
```

---

## Database Migration

The following migration adds the field to the database:

**Migration**: `009_add_user_journey_flag.sql`

```sql
ALTER TABLE profiles
ADD COLUMN user_journey_selection_shown BOOLEAN DEFAULT false;

CREATE INDEX idx_profiles_user_journey_shown ON profiles(user_journey_selection_shown);
```

**Required Action**: Apply this migration to Supabase before using the feature.

---

## Testing Checklist

- [ ] GET `/v1/profile/me` returns `user_journey_selection_shown: false` for new users
- [ ] GET `/v1/profile/me` returns `user_journey_selection_shown: true` after calling mark endpoint
- [ ] POST `/v1/profile/mark-journey-shown` with valid auth returns updated profile
- [ ] POST `/v1/profile/mark-journey-shown` without auth returns 401 Unauthorized
- [ ] Flag persists in AsyncStorage between app sessions
- [ ] Journey screen shows only when flag is false
- [ ] Journey screen hidden when flag is true
- [ ] Calling mark endpoint twice doesn't cause issues (idempotent)
- [ ] Offline: Local flag is used when network unavailable
- [ ] Online sync: Backend flag is fetched and updates local cache

---

## Example Implementation (React Native / Expo)

```typescript
// screens/Home.tsx
import { useEffect } from 'react';
import { getProfile, markJourneyShown } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useAsyncStorage } from '@react-native-async-storage/async-storage';

export function HomeScreen({ navigation }) {
  const { session } = useAuth();
  const { getItem, setItem } = useAsyncStorage('userData');
  
  useEffect(() => {
    checkAndShowJourney();
  }, []);
  
  const checkAndShowJourney = async () => {
    try {
      // Get user profile
      const { profile } = await getProfile({
        userId: session.userId,
        sessionToken: session.sessionToken,
      });
      
      // Check if journey was shown
      if (!profile.user_journey_selection_shown) {
        // Show journey selection screen
        navigation.navigate('UserJourney');
      }
    } catch (error) {
      console.error('Failed to check journey status:', error);
    }
  };
  
  return (
    <View>
      {/* Home content */}
    </View>
  );
}

// screens/UserJourney.tsx
export function UserJourneyScreen({ navigation }) {
  const { session } = useAuth();
  const { setItem } = useAsyncStorage('userData');
  
  const handleJourneySelection = async (journey) => {
    try {
      // Mark as shown in backend
      const { profile } = await markJourneyShown({
        userId: session.userId,
        sessionToken: session.sessionToken,
      });
      
      // Update local cache
      const userData = {
        session,
        profile,
        timestamp: Date.now(),
      };
      await setItem(JSON.stringify(userData));
      
      // Navigate to home
      navigation.replace('Home');
    } catch (error) {
      console.error('Failed to mark journey shown:', error);
    }
  };
  
  return (
    <View>
      {/* Journey selection UI */}
      <Button 
        title="Select Journey" 
        onPress={() => handleJourneySelection('selected')} 
      />
    </View>
  );
}
```

---

## API Client Helper Functions

Add these to your `lib/api.ts`:

```typescript
// Mark user journey selection as shown
export async function markJourneyShown(auth: ApiAuthHeaders): Promise<{ profile: Profile }> {
  const response = await fetch(`${API_BASE}/v1/profile/mark-journey-shown`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': auth.userId,
      'x-session-token': auth.sessionToken,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to mark journey shown: ${response.statusText}`);
  }
  
  return response.json();
}
```

---

## Notes

- The flag defaults to `false` for new users
- Backend automatically creates the field when user profile is first created
- The flag is write-once (set to true once, never goes back to false)
- This is different from `onboarding_completed` - journey selection is optional for some flows
- Persists across app sessions automatically (stored in database)
- Network-independent (works offline using cached value)
- Idempotent - calling endpoint multiple times is safe

---

**Backend Ready**: ✅  
**Frontend Implementation**: Start building with the patterns above  
**Database Migration**: Apply `009_add_user_journey_flag.sql` to Supabase
