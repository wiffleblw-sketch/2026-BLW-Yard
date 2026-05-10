# BLW Yard

Live scoreboard for Big League Wiffleball — Season 7 · 2026.

---

## 🚀 One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwiffleblw-sketch%2Fblw-yard&env=EDIT_PASSWORD,EDIT_TOKEN&envDescription=EDIT_PASSWORD%20is%20what%20you%20type%20to%20unlock%20editing.%20EDIT_TOKEN%20is%20any%20long%20random%20string%20%E2%80%94%20just%20mash%20the%20keyboard.&stores=%5B%7B%22type%22%3A%22kv%22%7D%5D&project-name=blw-yard&repository-name=blw-yard)

Click the button above. Vercel walks you through:
1. Sign in (use your GitHub)
2. It prompts for **EDIT_PASSWORD** (what you type to unlock editing — pick something memorable) and **EDIT_TOKEN** (just mash your keyboard for a long random string)
3. It auto-creates the database (storage)
4. Deploy

You get a URL like `https://blw-yard-abc123.vercel.app`. Send that to anyone — no login needed to view. To edit, click `VIEW ONLY` in the top-right of the live site, type your password, and you're in.

---

## Two-step setup

### Step 1 — Put the code on GitHub

The Deploy button needs the code at `github.com/wiffleblw-sketch/blw-yard`.

**Easiest way (no terminal):**
1. Go to [github.com/new](https://github.com/new)
2. Repository name: `blw-yard`
3. Click **Create repository**
4. On the new empty repo page, click the **uploading an existing file** link
5. Drag every file and folder from this `blw-yard` folder into the upload area
6. Click **Commit changes** at the bottom

**With a terminal:**
```bash
cd blw-yard
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/wiffleblw-sketch/blw-yard.git
git push -u origin main
```

### Step 2 — Click the Deploy button above

The deploy runs in ~1 minute. Your live URL appears on the Vercel dashboard.

---

## (Optional) Custom domain

Buy a domain like `blwyard.com` from Namecheap or Google Domains.
In Vercel: **your project → Settings → Domains → Add**. Vercel gives you 1-2 DNS records to add at your registrar.
Cost: ~$12/year.

---

## How it works

- `app/page.js` — Server component, loads data from KV on every page load.
- `app/api/data/route.js` — GET reads, POST writes (auth-protected via cookie).
- `app/api/auth/route.js` — Sets/clears the edit cookie based on password.
- `components/Scoreboard.jsx` — All UI. Saves any change via `POST /api/data` whenever you're in edit mode.
- `lib/store.js` — Wraps Vercel KV (with a `/tmp` JSON fallback for local dev).
- `lib/data.js` — Pure logic: stat math, seed data, formatters.
- `lib/logos.js` — Base64-embedded team and shield logos.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without KV, data is stored in `/tmp/blw-yard-data.json`. Set `EDIT_PASSWORD` and `EDIT_TOKEN` in a `.env.local` file to enable edit mode locally.

## Adding new teams

In the live site, sign in to edit mode, click **Manage → Players**.
The Wolves and Panthers teams are pre-loaded as one-click presets — they include the right colors and logos. Cougars and Diamonds are already in the seed data.
