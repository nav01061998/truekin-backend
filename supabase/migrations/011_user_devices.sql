-- Create user_devices table for storing device tokens
create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  push_enabled boolean default true,
  active boolean default true,
  created_at timestamp with time zone default now(),
  last_seen timestamp with time zone default now(),
  unique(user_id, device_token)
);

-- Create indexes for efficient queries
create index idx_user_devices_user_id on public.user_devices(user_id);
create index idx_user_devices_active on public.user_devices(user_id, active);
create index idx_user_devices_created_at on public.user_devices(created_at);

-- Add comment for clarity
comment on table public.user_devices is 'Stores device tokens for push notifications. Also synced to Firestore for real-time updates.';
