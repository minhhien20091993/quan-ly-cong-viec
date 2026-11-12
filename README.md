# Personal Task Manager

A task-management dashboard built with React, Vite, and Supabase. Supabase Auth is required; staff, departments, categories, and tasks are stored in one shared workspace. The previous local demo data is not copied to Supabase.

## Run locally

1. Install Node.js (LTS) and npm.
2. Open a terminal in the `app` folder.
3. Run `npm install` once, then `npm run dev -- --host 127.0.0.1`.
4. Open the local URL shown by Vite. For cloud sync, set the two variables shown in `app/.env.example` (the project publishable key is also configured in the public app).

## Supabase setup

1. Run `supabase/schema.sql` once in the project's Supabase SQL Editor.
2. Run `supabase/office_ai_access.sql` after the Supabase account `minhhien20091993@gmail.com` exists. This account becomes the highest-level Office AI administrator.
3. In Supabase Authentication settings, keep **Allow new users to sign up** disabled. Create additional accounts only for people who should access the shared workspace. New accounts are added to the protected account list automatically.
4. Open the GitHub Pages website and sign in. The highest-level administrator sees **Văn phòng AI** permissions and can grant or revoke AI access for each account.
5. Supabase RLS protects the account and permission tables. Only the publishable key is used in the browser; never put a Supabase secret or service-role key in this public repository.

The Office AI API must also validate the Supabase access token and call the `can_use_office_ai()` function before serving data or processing requests. Configuring the separate AI backend is required for the permission toggle to take effect there.

Each task has an **AI hỗ trợ** action. It checks the signed-in user's Office AI permission, sends the task to the Office AI backend in the background, and enables **AI gợi ý** when the Word report is ready. The task page passes its existing Supabase session to the backend, so users do not need to sign in to the separate Office AI page. The backend's `OFFICE_AI_CORS_ORIGINS` must include this GitHub Pages origin. When the backend is addressed by a LAN IP from HTTPS GitHub Pages, Chrome may ask once to allow local-network access. The backend machine must be on and reachable from the user's network or VPN.

The browser uses only the Supabase publishable key. Row Level Security limits table access to authenticated accounts. Never put a Supabase secret or service-role key in this public repository. The category password `761311` only hides the category screen and is not an authorization boundary. Do not use real patient or confidential organizational data in this public demo.

The application does not call paid AI APIs.
