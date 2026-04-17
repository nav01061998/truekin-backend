# Home API Integration Guide - Fix for Frontend Errors

## Issue 1: `Cannot read property 'url' of undefined`

### Root Cause
The `content` object or `content.update` is undefined. This happens when:
1. API request fails
2. Migration hasn't been applied to Supabase
3. Error response isn't being handled

### Expected Response Format

**Endpoint**: `POST /v1/homepage`

**Success Response (200)** - GUARANTEED STRUCTURE:
```json
{
  "content": {
    "mode": "guest" | "authenticated",
    "greeting": "Welcome back, Sarah",
    "title": "Care is easier when your next step is clear",
    "subtitle": "Start setting up your medication reminders...",
    "topBar": {
      "title": "Home",
      "navbarItems": [
        {
          "id": "notifications",
          "icon": "notifications",
          "hPos": 1,
          "pageName": "/notifications"
        },
        {
          "id": "settings",
          "icon": "settings",
          "hPos": 0,
          "pageName": "/settings"
        }
      ]
    },
    "bottomBar": {
      "items": [
        {
          "id": "home",
          "title": "Home",
          "activeIcon": "home",
          "inActiveIcon": "home",
          "hPos": 0,
          "pageName": "/(tabs)/home"
        },
        {
          "id": "medicines",
          "title": "Medicines",
          "activeIcon": "medication",
          "inActiveIcon": "medication",
          "hPos": 1,
          "pageName": "/(tabs)/medicines"
        },
        {
          "id": "family",
          "title": "Family",
          "activeIcon": "people",
          "inActiveIcon": "people-outline",
          "hPos": 2,
          "pageName": "/(tabs)/family"
        },
        {
          "id": "profile",
          "title": "Profile",
          "activeIcon": "person",
          "inActiveIcon": "person-outline",
          "hPos": 3,
          "pageName": "/(tabs)/profile"
        }
      ]
    },
    "sectionTitle": "What you can do with TrueKin",
    "cards": [
      {
        "id": "auth-medicines",
        "title": "Medicine reminders",
        "description": "Want to start adding medicines?",
        "icon": "medication",
        "ctaLabel": "Start adding medicines",
        "actionId": "add_medicine"
      }
    ],
    "update": {
      "available": false,
      "autoPrompt": false,
      "title": "New Version Available!",
      "description": "Enjoy new features...",
      "url": null
    }
  }
}
```

**Error Response (400)** - WHEN MIGRATION NOT APPLIED OR QUERY FAILS:
```json
{
  "error": "Failed to load homepage configuration: ..."
}
```

### Frontend Fix: Safe Access Pattern

```typescript
// ❌ WRONG - Causes the error
const updateUrl = content?.update.url ?? null;

// ✅ CORRECT - Safe access
const updateUrl = content?.update?.url ?? null;

// ✅ ALTERNATIVE - With proper error handling
const content = await fetchHomepage();
if (!content) {
  // Show error UI
  return <ErrorScreen />;
}
const updateUrl = content.update?.url ?? null;
```

### Complete Correct Implementation

```typescript
// home.tsx
import { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

export function HomeScreen() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHomepage();
  }, []);

  const loadHomepage = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('YOUR_API_URL/v1/homepage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          is_logged_in: !!userId,
          display_name: userName || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if content exists before accessing nested properties
      if (!data?.content) {
        throw new Error('Invalid response format');
      }

      setContent(data.content);
    } catch (err) {
      console.error('Failed to load homepage:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ SAFE - Handles undefined gracefully
  const updateUrl = useMemo(
    () => content?.update?.url ?? null,
    [content]
  );

  const handleUpdatePress = () => {
    if (updateUrl) {
      // Open update URL
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return (
      <View>
        <Text>Error loading home: {error}</Text>
        <Button title="Retry" onPress={loadHomepage} />
      </View>
    );
  }

  if (!content) {
    return <View><Text>No content available</Text></View>;
  }

  return (
    <View>
      <Text>{content.greeting}</Text>
      <Text>{content.title}</Text>
      {/* Rest of UI using content */}
    </View>
  );
}
```

---

## Issue 2: User Journey Skip Button Requires Double Press

### Problem
Skip button requires pressing twice to navigate. Need immediate navigation without loading.

### Root Cause
Likely reasons:
1. Navigation state not updating immediately
2. `await markJourneyShown()` blocking navigation
3. State updates queuing before navigation

### Solution: Skip Without API Call During Skip

**Correct Flow:**
```
Skip Pressed
    ↓
Immediately call markJourneyShown() (without awaiting)
    ↓
Immediately navigate to Home (don't wait for API)
    ↓
On Home screen load → API call happens for homepage content
    ↓
Update bottom tabs, top nav, etc. from homepage API
```

### Implementation for User Journey Screen

```typescript
// screens/UserJourney.tsx
import { useNavigation } from '@react-navigation/native';
import { markJourneyShown } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function UserJourneyScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();

  // ✅ CORRECT - Skip without waiting
  const handleSkip = () => {
    // Mark as shown in background (fire and forget)
    // Don't await this
    markJourneyShown({
      userId: session.userId,
      sessionToken: session.sessionToken,
    }).catch(err => {
      console.error('Failed to mark journey shown:', err);
      // Still continue - frontend flag can be local
    });

    // Navigate immediately (no loading)
    navigation.replace('Home'); // Use replace, not navigate
  };

  // ❌ WRONG - Waiting for API before navigation
  const handleSkip_WRONG = async () => {
    try {
      // This makes user wait
      const { profile } = await markJourneyShown({
        userId: session.userId,
        sessionToken: session.sessionToken,
      });
      
      // Then navigate
      navigation.replace('Home');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSelectJourney = async (journey) => {
    // For actual selection, mark as shown and wait for profile
    const { profile } = await markJourneyShown({
      userId: session.userId,
      sessionToken: session.sessionToken,
    });

    // Update local cache
    updateUserProfile(profile);

    // Then navigate
    navigation.replace('Home');
  };

  return (
    <View>
      <Button title="Skip" onPress={handleSkip} />
      <Button 
        title="Select Journey" 
        onPress={() => handleSelectJourney('selected')} 
      />
    </View>
  );
}
```

---

## Complete Home Screen Flow

### App Launch Sequence

```
App Launches
    ↓
Check if onboarding complete
    ├─ NO → Show Onboarding screens
    └─ YES → Check journey shown
         ├─ NO → Show Journey Selection screen
         └─ YES → Load Home Screen
              ↓
              POST /v1/homepage (THIS HAS LOADING)
              ↓
              Get topBar config
              Get bottomBar config
              Get all tab configurations
              ↓
              Render Tabs with bottom bar
              Render top nav
              Render content
```

### Home Screen Loading State

```typescript
// screens/Home.tsx
export function HomeScreen() {
  const [homeContent, setHomeContent] = useState(null);
  const [isLoadingHome, setIsLoadingHome] = useState(true);
  const [tabsConfig, setTabsConfig] = useState(null);

  useEffect(() => {
    loadHomeContent();
  }, []);

  const loadHomeContent = async () => {
    try {
      setIsLoadingHome(true);

      const response = await fetch('YOUR_API/v1/homepage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          is_logged_in: true,
          display_name: profile.display_name,
        }),
      });

      const data = await response.json();

      if (!data?.content) {
        throw new Error('Invalid response');
      }

      setHomeContent(data.content);
      
      // Extract tabs config for use in _layout.tsx
      setTabsConfig(data.content.bottomBar?.items);
    } catch (error) {
      console.error('Failed to load home:', error);
    } finally {
      setIsLoadingHome(false);
    }
  };

  return (
    <View>
      {isLoadingHome ? (
        <ActivityIndicator size="large" />
      ) : (
        <HomeContent content={homeContent} tabsConfig={tabsConfig} />
      )}
    </View>
  );
}
```

### Tabs Layout with Dynamic Navigation

```typescript
// app/(tabs)/_layout.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export function TabLayout({ tabsConfig }) {
  const Tab = createBottomTabNavigator();

  // Sort tabs by hPos (horizontal position)
  const sortedTabs = (tabsConfig || []).sort((a, b) => a.hPos - b.hPos);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
        },
      }}
    >
      {sortedTabs.map((tab) => (
        <Tab.Screen
          key={tab.id}
          name={tab.id}
          component={getScreenComponent(tab.id)}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <MaterialIcons
                name={focused ? tab.activeIcon : tab.inActiveIcon}
                size={size}
                color={color}
              />
            ),
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#999',
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
```

---

## API Response Validation Checklist

Before accessing any nested properties:

```typescript
// Always check structure before using
const validateHomepageResponse = (data) => {
  if (!data) return false;
  if (!data.content) return false;
  if (!data.content.update) return false;
  if (!data.content.topBar) return false;
  if (!data.content.bottomBar) return false;
  if (!data.content.cards) return false;
  return true;
};

// Usage
const data = await fetchHomepage();
if (!validateHomepageResponse(data)) {
  console.error('Invalid response structure');
  return;
}

// Safe to use all properties now
const updateUrl = data.content.update.url;
const tabs = data.content.bottomBar.items;
```

---

## Network Request Debugging

Add logging to verify API response:

```typescript
const loadHomepage = async () => {
  const response = await fetch('/v1/homepage', {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify(/* ... */),
  });

  console.log('Status:', response.status);
  console.log('Headers:', response.headers);

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok && data.content) {
    setContent(data.content);
  } else {
    console.error('Invalid response:', data);
  }
};
```

---

## Checklist for Frontend Implementation

- [ ] Migration `008_homepage_config.sql` applied to Supabase
- [ ] Migration `009_add_user_journey_flag.sql` applied to Supabase
- [ ] Using safe optional chaining: `content?.update?.url` not `content?.update.url`
- [ ] Handling error responses (400/500 codes)
- [ ] Journey skip: No await before navigation
- [ ] Home screen: Loading only for `/v1/homepage` API call
- [ ] Tabs configuration from API response
- [ ] Top nav configuration from API response
- [ ] AsyncStorage updated with response data
- [ ] API validation before accessing nested properties

---

## Summary

| Issue | Fix |
|-------|-----|
| `Cannot read property 'url'` | Use `content?.update?.url` with safe optional chaining |
| Error handling | Check `data?.content` before accessing nested properties |
| Skip double-press | Fire `markJourneyShown()` without await, navigate immediately |
| Home loading | Only load homepage API on Home screen, not during skip |
| Tabs config | Fetch from `/v1/homepage` response, use `bottomBar.items` |

**Backend Status**: ✅ All APIs ready and tested  
**Frontend Action**: Apply fixes above and implement error handling
