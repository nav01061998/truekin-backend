# Debugging "Failed to save date of birth" Error

## Problem
You're getting `Failed to save date of birth: [ApiError: Failed to save date of birth]` when trying to save date of birth.

## Root Causes

### 1. **Missing Database Columns** (Most Likely)
The migration `005_add_onboarding_fields.sql` hasn't been applied to your Supabase database.

**Check if columns exist**:
- Go to Supabase dashboard → SQL Editor
- Run this query:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

**Expected columns** (you should see):
- `id` (uuid)
- `phone` (text)
- `display_name` (text)
- `date_of_birth` (date) ← Should exist
- `health_conditions` (jsonb) ← Should exist
- `gender` (text)
- `avatar_url` (text)
- `onboarding_completed` (boolean)

### 2. **Invalid Session**
The user's session token might be invalid or expired.

**Check**:
- Ensure `x-user-id` and `x-session-token` headers are correct
- Verify session hasn't expired (7 days TTL)
- Check `auth_sessions` table in Supabase

### 3. **Database Connection Issue**
Supabase credentials might be incorrect.

**Check `.env` file**:
```bash
cat .env | grep SUPABASE
```

Should have:
- `SUPABASE_URL` - Project URL
- `SUPABASE_ANON_KEY` - Anon key (for browser)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for backend)

---

## Solution: Apply Missing Migrations

### Option 1: Manual SQL (Recommended for Development)

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query with this SQL:

```sql
-- Add onboarding fields to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS health_conditions JSONB DEFAULT '[]';

-- Add index for date_of_birth
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth ON profiles(date_of_birth);
```

3. Click **Run**
4. You should see: `Query successful`

### Option 2: Using Supabase CLI (Recommended for Production)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push

# Check migration status
supabase migration list
```

---

## Verify Fix

After applying migrations, test the endpoint:

```bash
curl -X POST http://localhost:4000/onboarding/date-of-birth \
  -H "x-user-id: YOUR_USER_UUID" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date_of_birth": "1985-06-15"}'
```

Expected success response:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "phone": "...",
    "display_name": "...",
    "date_of_birth": "1985-06-15",
    "health_conditions": null,
    "gender": null,
    "avatar_url": null,
    "onboarding_completed": false
  }
}
```

---

## Common Error Messages

### `Failed to save date of birth`
- Missing `date_of_birth` column in database
- Supabase service role key doesn't have write permissions
- RLS policies blocking the update

**Fix**: Apply migrations (Option 1 or 2 above)

### `Unauthorized`
- Invalid or missing session token
- Session expired (> 7 days)
- User doesn't exist in auth.users

**Fix**: 
- Get fresh session by completing auth/OTP flow
- Check if user exists in Supabase auth

### `Invalid date format. Use YYYY-MM-DD`
- Date format is wrong
- Examples of valid: "1985-06-15", "2000-01-01"

**Fix**: Ensure date is in ISO format YYYY-MM-DD

### `Future date not allowed`
- Date of birth is in the future

**Fix**: Select a date before today

---

## Row Level Security (RLS)

The `profiles` table has RLS enabled. Make sure policies allow updates:

```sql
-- This policy should exist and be enabled:
CREATE POLICY "Users can update own profile" ON profiles 
  FOR UPDATE 
  USING (auth.uid() = id);
```

To check RLS policies in Supabase:
1. Go to SQL Editor
2. Run: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`

---

## Debug Logs

Start the backend with debug output:

```bash
DEBUG=* npm run dev
```

Look for logs related to:
- Supabase connection
- Profile update query
- Session validation errors

---

## Get Help

If migrations are applied but still getting error:

1. **Check Supabase logs**:
   - Go to Supabase Dashboard → Logs
   - Filter for errors on `profiles` table

2. **Verify RLS policies**:
   - Make sure UPDATE policy exists and is enabled
   - Make sure `auth.uid() = id` correctly identifies the user

3. **Check session validity**:
   - User ID in header must match `id` in `auth.users` table
   - Session token must exist and not be expired

4. **Test with Supabase Studio**:
   - Edit profiles row directly in Supabase Studio
   - If you can edit, RLS is fine
   - If you can't, RLS policy issue

---

## Files Involved

- Migration: `supabase/migrations/005_add_onboarding_fields.sql`
- Service: `src/services/profile-service.ts` (saveDateOfBirth function)
- Route: `src/routes/onboarding.ts` (/onboarding/date-of-birth endpoint)
- DB Schema: Check via Supabase Dashboard
