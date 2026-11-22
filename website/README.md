# Marketing website

Static site for My Church Bible Study. No build step: plain HTML, one stylesheet, one script.

- `index.html` landing page
- `privacy.html`, `terms.html`, `support.html` pages the app stores require (still marked as drafts)
- `main.js` waitlist form and the example study in the phone
- `styles.css` design tokens are the custom properties at the top

Preview: `npx serve website` from the repo root, or open `index.html`.

## Before it goes live

1. Waitlist: run `supabase/migrations/003_waitlist.sql`, then put the Supabase project URL and anon key in `WAITLIST` at the top of `main.js`. Until then the form says the list is not open.
2. Replace `[support email to be added]` in the three document pages and remove their draft banners once the text is approved.
3. Point the domain at the folder (any static host works).
