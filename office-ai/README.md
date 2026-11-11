# Văn phòng AI

FastAPI backend and browser interface for IT support requests, file analysis, collaborative AI agents, report generation, and Word export.

## Connected Supabase access

This app shares Supabase Auth with the task manager. It checks the `can_use_office_ai()` database function before serving every data/API route. The manager page's administrator panel writes per-account grants; it does not depend on a service-role key.

1. Ensure `minhhien20091993@gmail.com` already exists in Supabase Auth.
2. Run `../supabase/office_ai_access.sql` and then `../supabase/office_ai_storage.sql` in that Supabase project's SQL Editor. The second migration creates RLS-protected per-account session storage and shared process settings.
3. Deploy this directory as a Docker web service.
4. Set runtime environment variables in the hosting provider: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SESSION_STORAGE=1`. Supabase stores each account's sessions and the shared process settings.
5. After deployment, set the task manager GitHub repository Actions variable `OFFICE_AI_URL` to the backend's HTTPS URL. The manager website will show a **Văn phòng AI** link after its next Pages build.

Use only the Supabase publishable key in the browser and API server configuration. Never use a Supabase secret/service-role key here. Keep the Claude API key in the hosting provider's private environment settings, not in GitHub or the image.

## Deploy online with Render

[Open the Render deployment flow](https://render.com/deploy?repo=https://github.com/minhhien20091993/quan-ly-cong-viec). The blueprint builds the Docker service from this folder on Render's Free plan. Render sleeps the service after 15 minutes without traffic, and the first request after sleep may take about a minute to wake it. Session history and shared process settings are stored in Supabase, so they are available across the user's computers and survive Render sleep/redeploy. [Render Free limitations](https://render.com/docs/free).

Claude API usage is billed separately. Render will prompt you to enter `ANTHROPIC_API_KEY`; enter it directly in Render's secret field and never paste it into GitHub.

After deployment, copy the Render HTTPS URL and add it as the GitHub Actions repository variable `OFFICE_AI_URL` in Settings → Secrets and variables → Actions → Variables. The task-manager link appears after the next Pages build. 

## Local run

Copy `.env.example` to `.env`, set the same variables, then run:

```sh
python -m pip install -r requirements.txt
python server.py
```

Open `http://127.0.0.1:8000`. Sign in using the same Supabase Auth account used by the task manager. Users need an explicit AI grant; the top-level administrator is always allowed.

## Deployment notes

GitHub Pages hosts the task manager's static React site; it cannot run this Python service. The Dockerfile listens on the hosting platform's `PORT`. Use one service instance/worker because live progress queues are held in memory. Render Free sleeps after inactivity, so a first request may be delayed; Supabase keeps saved sessions and process settings.

Sessions are private to the account that created them; the same account can open them from all three computers. The shared process setting is visible to authorized accounts. Do not upload patient identifiers or other confidential organizational data. The browser loads Three.js from a public CDN if the optional local vendor file is absent.
