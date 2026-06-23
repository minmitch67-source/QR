# C-AK Meal Accountability System
### 19th ESC / CJLOTS 2026 — Dogu Beach

---

## Three URLs, One App

| URL | Device | Purpose |
|-----|--------|---------|
| `/register` | Tablet 1 | Soldier sign-up, QR pass request |
| `/scan` | Tablet 2 | QR code scanner, meal logging |
| `/admin` | Your phone | PIN-gated dashboard, approvals, reports |

---

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "C-AK Meal Accountability v1"
git remote add origin https://github.com/YOUR_USERNAME/cak-meal-app.git
git push -u origin main
```

### 2. Connect to Vercel
- Go to vercel.com → New Project → Import from GitHub
- Select this repo
- Framework: Next.js (auto-detected)
- Click Deploy

### 3. Add Vercel KV (database)
- In your Vercel project → Storage tab → Create KV Database
- Name it `cak-db`
- Click Connect — environment variables are added automatically

### 4. Add environment variables
In Vercel project settings → Environment Variables:
```
ADMIN_PIN = 3032
```
(Change this to whatever PIN you want)

### 5. Redeploy
Vercel will auto-redeploy when you push. Or trigger manually in dashboard.

---

## Tablet Setup

**Tablet 1 — Registration:**
Open browser → go to `https://YOUR-APP.vercel.app/register`
Add to home screen → set as kiosk/guided access

**Tablet 2 — Scanner:**
Open browser → go to `https://YOUR-APP.vercel.app/scan`
Allow camera permissions → Add to home screen

**Your phone — Admin:**
`https://YOUR-APP.vercel.app/admin`
PIN: 3032 (or whatever you set)

---

## Admin Dashboard Features
- Live pending queue — approve or deny with one tap
- Today's scan log — who ate, what meal, what time
- Date range report — meals per day, bar chart
- Export soldiers CSV (all registered)
- Export scans CSV (all meal events)
- Auto-refreshes every 30 seconds
- Lock button to return to PIN screen

---

## Data
All data stored in Vercel KV (Redis). Free tier = 30,000 requests/day, 256MB storage — more than enough for CJLOTS scale (~250 PAX/day).
