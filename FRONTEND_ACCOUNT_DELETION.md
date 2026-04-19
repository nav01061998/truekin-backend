# Account Deletion - Frontend Integration Guide

## Overview

Users can permanently delete their account via the settings screen. This is an irreversible action that deletes all user data.

---

## API Endpoint

### Delete Account

**Endpoint**: `POST /v1/profile/delete`

**Authentication Required**: Yes
- `x-user-id`: User's UUID
- `x-session-token`: Session token
- `Content-Type: application/json`

**Request Body**:
```json
{
  "reason": "dont_want_to_use" | "using_another_account" | "too_many_notifications" | "app_not_working" | "other"
}
```

**Deletion Reasons** (enum):
| Reason | Description |
|--------|-------------|
| `dont_want_to_use` | User doesn't want to use the app |
| `using_another_account` | User switched to another account |
| `too_many_notifications` | Too many notifications |
| `app_not_working` | App not working properly |
| `other` | Other reason |

---

## API Responses

### Success Response (200)

```json
{
  "success": true,
  "message": "Account successfully deleted"
}
```

**After this response**:
- User's profile is permanently deleted
- All sessions are invalidated
- All user data (medications, reminders, family members, health records) is deleted
- Deletion is logged for audit trail
- User should be logged out immediately

### Error Responses

**Invalid Reason (400)**:
```json
{
  "error": "Invalid deletion reason"
}
```

**Unauthorized (401)**:
```json
{
  "error": "Unauthorized"
}
```

**Other Errors (400/500)**:
```json
{
  "error": "Account deletion failed" | "error message"
}
```

---

## Frontend Implementation

### Step 1: Show Confirmation Dialog

Before calling the API, show a confirmation dialog explaining the consequences:

```typescript
const showDeletionConfirmation = () => {
  Alert.alert(
    "Delete Account",
    "This action cannot be undone. All your data including medications, reminders, and family members will be permanently deleted.",
    [
      {
        text: "Cancel",
        onPress: () => {},
        style: "cancel",
      },
      {
        text: "Delete Account",
        onPress: () => showDeletionReasonScreen(),
        style: "destructive",
      },
    ]
  );
};
```

### Step 2: Select Deletion Reason

Show a screen or modal for user to select the reason:

```typescript
interface DeletionOption {
  value: DeletionReason;
  label: string;
  icon: string;
}

const deletionReasons: DeletionOption[] = [
  {
    value: "dont_want_to_use",
    label: "I don't want to use this app",
    icon: "close-circle",
  },
  {
    value: "using_another_account",
    label: "I'm using another account",
    icon: "swap-horizontal",
  },
  {
    value: "too_many_notifications",
    label: "Too many notifications",
    icon: "bell-off",
  },
  {
    value: "app_not_working",
    label: "The app is not working properly",
    icon: "alert-circle",
  },
  {
    value: "other",
    label: "Other reason",
    icon: "more-horizontal",
  },
];

export function DeletionReasonScreen({ navigation }) {
  const [selectedReason, setSelectedReason] = useState<DeletionReason | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason");
      return;
    }

    // Show final confirmation
    Alert.alert(
      "Confirm Permanent Deletion",
      "This cannot be undone. Your account and all data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => performDeletion(selectedReason),
          style: "destructive",
        },
      ]
    );
  };

  const performDeletion = async (reason: DeletionReason) => {
    try {
      setIsDeleting(true);

      const response = await fetch(`${API_URL}/v1/profile/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": session.userId,
          "x-session-token": session.sessionToken,
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Account deletion failed");
      }

      // Clear local storage
      await AsyncStorage.removeItem("userData");
      await AsyncStorage.removeItem("session");

      // Log out and redirect to login
      clearUserSession();
      navigation.reset({
        index: 0,
        routes: [{ name: "Auth" }],
      });

      // Show success message
      Alert.alert(
        "Account Deleted",
        "Your account has been permanently deleted."
      );
    } catch (error) {
      Alert.alert(
        "Deletion Failed",
        error instanceof Error ? error.message : "Failed to delete account"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Why are you deleting your account?</Text>
      <Text style={styles.subtitle}>
        This helps us improve the app
      </Text>

      <ScrollView style={styles.optionsList}>
        {deletionReasons.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              selectedReason === option.value && styles.optionSelected,
            ]}
            onPress={() => setSelectedReason(option.value)}
          >
            <MaterialIcons
              name={option.icon}
              size={24}
              color={selectedReason === option.value ? "#e74c3c" : "#666"}
            />
            <Text
              style={[
                styles.optionText,
                selectedReason === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
            {selectedReason === option.value && (
              <MaterialIcons name="check" size={24} color="#e74c3c" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Button
        title={isDeleting ? "Deleting..." : "Delete Account"}
        disabled={!selectedReason || isDeleting}
        onPress={handleDeleteAccount}
        color="#e74c3c"
      />
    </View>
  );
}
```

### Step 3: Add to Settings Screen

```typescript
// In ProfileScreen or SettingsScreen
<TouchableOpacity
  style={styles.dangerZone}
  onPress={() => showDeletionConfirmation()}
>
  <MaterialIcons name="delete-forever" size={24} color="#e74c3c" />
  <Text style={styles.dangerZoneText}>Delete Account</Text>
</TouchableOpacity>
```

---

## Session Handling

After deletion, the user's session becomes invalid:

1. Backend immediately invalidates all sessions
2. Frontend should clear all local data
3. User should be logged out
4. Redirect to login screen

```typescript
const performDeletion = async (reason: DeletionReason) => {
  try {
    // Call deletion API
    await fetch(`${API_URL}/v1/profile/delete`, {
      method: "POST",
      headers: { /* ... */ },
      body: JSON.stringify({ reason }),
    });

    // Clear everything
    await AsyncStorage.multiRemove([
      "userData",
      "session",
      "profile",
      "medications",
      // Remove any other cached user data
    ]);

    // Clear auth state
    authContext.logout();

    // Navigate to login
    navigation.reset({
      index: 0,
      routes: [{ name: "Auth" }],
    });
  } catch (error) {
    // Handle error
  }
};
```

---

## UI Patterns

### Pattern 1: Settings Menu

```typescript
<Section title="Account">
  <MenuItem label="Edit Profile" icon="edit" onPress={...} />
  <MenuItem label="Privacy" icon="lock" onPress={...} />
  <MenuItem label="Security" icon="security" onPress={...} />
  <Divider />
  <MenuItem
    label="Delete Account"
    icon="delete-forever"
    color="red"
    onPress={showDeletionConfirmation}
  />
</Section>
```

### Pattern 2: Multi-Step Flow

```
Settings Screen
    ↓
"Delete Account" Button
    ↓
Confirmation Dialog (warning)
    ↓
Select Reason Screen
    ↓
Final Confirmation Dialog
    ↓
API Call
    ↓
Clear local data
    ↓
Logout & Redirect to Login
```

---

## Important Notes

1. **Irreversible**: Deletion cannot be undone. Make this very clear to user.

2. **Data Deletion**: All user data is permanently deleted:
   - Profile
   - Medications
   - Reminders
   - Family members
   - Health records
   - Sessions
   - All other related data

3. **Audit Trail**: Backend logs all deletions with:
   - User ID
   - Deletion reason
   - Timestamp
   - IP address
   - User agent

4. **Session Invalidation**: User's sessions become invalid immediately.

5. **Offline Handling**: If user is offline, local data should still be cleared when they try to use the app again.

---

## Error Handling

```typescript
try {
  await deleteUserAccount();
} catch (error) {
  if (error.response?.status === 401) {
    // Session invalid - logout
    clearUserSession();
    navigation.navigate("Auth");
  } else if (error.response?.status === 400) {
    // Validation error
    Alert.alert("Error", error.response.data.error);
  } else {
    // Network or server error
    Alert.alert(
      "Error",
      "Failed to delete account. Please try again later."
    );
  }
}
```

---

## Testing Checklist

- [ ] Deletion confirmation shows warning
- [ ] User can select deletion reason
- [ ] Final confirmation dialog appears
- [ ] API call succeeds (200 response)
- [ ] Local data cleared after deletion
- [ ] User logged out after deletion
- [ ] Redirect to login screen works
- [ ] Error handling shows appropriate message
- [ ] Button disabled while deletion in progress
- [ ] Network error handled gracefully

---

## API Client Helper Function

```typescript
// lib/api.ts
export async function deleteAccount(
  auth: ApiAuthHeaders,
  reason: "dont_want_to_use" | "using_another_account" | "too_many_notifications" | "app_not_working" | "other"
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/v1/profile/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": auth.userId,
      "x-session-token": auth.sessionToken,
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Account deletion failed");
  }

  return response.json();
}
```

---

**Status**: ✅ Backend Ready  
**Frontend Implementation**: Follow patterns above  
**Database Migration**: Apply `010_account_deletion_audit.sql` to Supabase
