<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# My Church Bible Study

Record or upload Sunday's sermon and get a 5 or 7 day Bible study built from it.
One React codebase runs as a website and, through Capacitor, as Android and iOS apps.

- `docs/MOBILE_APP_PLAN.md` the plan and where it stands
- `docs/RELEASING.md` how to build, test, deploy and release
- `website/` the marketing site

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in
3. `npm run build && PORT=8080 node --env-file=.env.local server.js` for the server
4. `npm run dev` for the web app with live reload (it forwards `/api` to port 8080)
