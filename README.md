# Personal Task Manager

A task-management dashboard built with React, Vite, and Supabase. Supabase Auth is required; staff, departments, categories, and tasks are stored in one shared workspace. The previous local demo data is not copied to Supabase.

## Run locally

1. Install Node.js (LTS) and npm.
2. Open a terminal in the `app` folder.
3. Run `npm install` once, then `npm run dev -- --host 127.0.0.1`.
4. Open the local URL shown by Vite. For cloud sync, set the two variables shown in `app/.env.example` (the project publishable key is also configured in the public app).

## Supabase setup

1. Run `supabase/schema.sql` once in the project's Supabase SQL Editor.
2. In Supabase Authentication settings, keep **Allow new users to sign up** disabled. Create the owner account from Authentication > Users > Add user; create additional accounts only for people who should access the shared workspace.
3. Open the GitHub Pages website and sign in with that account. Use the same account on other devices. Changes are saved to the shared Supabase workspace; reload another already-open device to fetch the latest data.

The browser uses only the Supabase publishable key. Row Level Security limits table access to authenticated accounts. Never put a Supabase secret or service-role key in this public repository. The category password `761311` only hides the category screen and is not an authorization boundary. Do not use real patient or confidential organizational data in this public demo.

The application does not call paid AI APIs.
