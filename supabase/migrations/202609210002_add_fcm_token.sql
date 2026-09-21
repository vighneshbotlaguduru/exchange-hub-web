-- Migration: Add fcm_token to users table for Google FCM Push Notifications
-- This column stores the unique Google Cloud Messaging device token for each user's phone.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Index for fast token lookups when sending push notifications to item owners
CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON public.users(fcm_token) WHERE fcm_token IS NOT NULL;
