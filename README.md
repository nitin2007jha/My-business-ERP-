# My Business ERP — PWA

A full-featured business ERP: Invoicing, Inventory, Expenses, Clients, PO & more.  
Built as a **Progressive Web App** — installable on Android & iOS, works offline.

---

## 🚀 Deploy to GitHub Pages

### Step 1 — Create GitHub repo
1. Go to [github.com/new](https://github.com/new)
2. Name it (e.g. `my-business-erp`), set to **Public**
3. Click **Create repository**

### Step 2 — Upload files
Option A — GitHub web UI (easiest):
1. On your new repo page, click **uploading an existing file**
2. Drag & drop ALL files from this folder (including `.github/` folder)
3. Commit to `main`

Option B — Git CLI:
```bash
git init
git add .
git commit -m "Initial PWA deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages
1. Go to repo **Settings → Pages**
2. Source: **GitHub Actions**
3. Save — the workflow auto-runs and your app is live at:  
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## 📱 Install as PWA

**Android (Chrome):**  
Open the site → tap ⋮ menu → "Add to Home screen"

**iOS (Safari):**  
Open the site → tap Share → "Add to Home Screen"

---

## Files
| File | Purpose |
|------|---------|
| `index.html` | Main app (single file ERP) |
| `sw.js` | Service Worker (offline + caching) |
| `site.webmanifest` | PWA manifest (icons, name, theme) |
| `favicon.*` | App icons |
| `.github/workflows/deploy.yml` | Auto-deploy to GitHub Pages |
