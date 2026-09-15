# BorrowHub

BorrowHub is a React and Supabase borrowing library. The existing UI is backed by Supabase Auth, PostgreSQL with RLS, and one Edge Function for proximity-based emergency alerts.

## Setup

1. Create a Supabase project, then copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never add a service-role key to this file.
2. In Supabase Dashboard, enable Email OTP and add your local/production URLs under **Authentication → URL Configuration**. The app accepts `@srmist.edu.in` accounts; the database trigger enforces this too.
3. Apply `supabase/migrations/202608140001_initial_schema.sql` in the SQL editor, or run `supabase db push` after linking the project.
4. Deploy the protected alert endpoint with `supabase functions deploy create-emergency-request`. It uses the platform-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY` and needs no frontend secret.
5. Run `npm install` and `npm run dev`.

To make the first admin, create/confirm the user in Supabase Auth, then run this in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'admin@example.com';
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb where email = 'admin@example.com';
```

Admin password sign-in uses Supabase Email/Password; regular members use email OTP.

## Data and authorization

- `profiles`: one profile per Auth user; members can read/update only themselves, admins can read all.
- `listings`: members create pending listings and see approved inventory or their own listings; admins approve/edit/delete all listings.
- `borrow_requests` and `messages`: only the borrower, listing owner, or admin can read them; messages can only be created by request participants.
- `member_locations`: private to the member. Locations are not exposed to other users.
- `emergency_requests` and `emergency_recipients`: the requester and selected nearby recipients can read the alert. Matching is performed through the Edge Function/RPC and expires after 15 minutes.

All tables have RLS enabled. The `is_admin()` database function checks the signed-in profile; it is never trusted from browser state alone.

## Client services

- `src/services/authService.js`: OTP registration/login, administrator password login, sign out.
- `src/services/borrowService.js`: catalogue CRUD, borrowing requests, chat, private location updates, and emergency alerts.
- `src/lib/supabase.js`: the sole Supabase client configuration.

## API

The frontend uses Supabase’s authenticated REST APIs through the service layer. The custom endpoint is:

`POST /functions/v1/create-emergency-request`

```json
{ "itemTitle": "Phone charger", "note": "USB-C", "latitude": 12.9, "longitude": 80.2 }
```

It requires a valid bearer token and returns `{ "requestId": "uuid", "recipientCount": 0 }`. Invalid or unauthenticated calls return `{ "error": "..." }` with HTTP 400/401.

## Verification

`npm run build` completes successfully. Test RLS with two non-admin accounts: neither should be able to read the other’s private requests, chat, or location; an admin should manage listings only.

