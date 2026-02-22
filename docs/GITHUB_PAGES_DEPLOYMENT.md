# GitHub Pages Deployment Guide

This guide explains how to deploy Verve to GitHub Pages with **automatic HTTPS support**.

## Why GitHub Pages?

✅ **Free HTTPS** - Works with File System Access API  
✅ **Automatic deployments** - Deploys on every push to main  
✅ **Custom domains** - Add your own domain with free SSL  
✅ **Global CDN** - Fast loading worldwide  
✅ **Zero configuration** - No CloudFront or S3 bucket setup needed

---

## Quick Setup (5 minutes)

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages** (left sidebar)
3. Under **Source**, select: **GitHub Actions**

![GitHub Pages Source](https://docs.github.com/assets/cb-47267/mw-1440/images/help/pages/publishing-source-drop-down.webp)

### 2. Add Environment Variables (Optional)

If you use Firebase or GrowthBook, add secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets (from your [.env](.env) file):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_GROWTHBOOK_PROD_API_HOST
VITE_GROWTHBOOK_PROD_CLIENT_KEY
```

### 3. Deploy

Just push to your main branch:

```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

### 4. Access Your Site

After 2-3 minutes, your site will be live at:

```
https://YOUR-USERNAME.github.io/verve/
```

You can find the exact URL in **Settings** → **Pages** after deployment completes.

---

## Configuration

### For User/Organization Pages

If your repository is named `username.github.io`, update [.github/workflows/deploy-gh-pages.yml](.github/workflows/deploy-gh-pages.yml):

```yaml
# Change this line:
VITE_BASE_PATH: /${{ github.event.repository.name }}/

# To:
VITE_BASE_PATH: /
```

### Manual Trigger

You can manually trigger a deployment:

1. Go to **Actions** tab
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**

---

## Custom Domain (Optional)

### Add a Custom Domain

1. Buy a domain (e.g., from Namecheap, Google Domains)
2. In your domain's DNS settings, add:
   ```
   Type: CNAME
   Name: www (or @)
   Value: YOUR-USERNAME.github.io
   ```
3. In GitHub: **Settings** → **Pages** → **Custom domain**
   - Enter: `www.yourdomain.com`
   - Click **Save**
4. ✅ **Enforce HTTPS** will be automatically enabled

### Update Base Path for Custom Domain

Update [.github/workflows/deploy-gh-pages.yml](.github/workflows/deploy-gh-pages.yml):

```yaml
# Change:
VITE_BASE_PATH: /${{ github.event.repository.name }}/

# To:
VITE_BASE_PATH: /
```

---

## Troubleshooting

### 404 on Routes

The workflow includes proper SPA routing support. If you still get 404s:

1. Check that [public/.nojekyll](public/.nojekyll) file exists
2. Clear your browser cache
3. Re-deploy: **Actions** → **Re-run all jobs**

### Build Fails

Check the **Actions** tab for error logs:

1. Click on the failed workflow run
2. Click on **build** job
3. Expand the failed step
4. Fix the error and push again

### HTTPS Not Working

GitHub Pages HTTPS is automatic and may take a few minutes:

1. Wait 10-15 minutes after first deployment
2. Check **Settings** → **Pages** → **Enforce HTTPS** is checked
3. Clear browser cache and try again

### File System Access API Still Blocked

Make sure you're accessing via HTTPS:
- ✅ `https://username.github.io/verve/`
- ❌ `http://username.github.io/verve/`

---

## Workflow Explained

The [.github/workflows/deploy-gh-pages.yml](.github/workflows/deploy-gh-pages.yml) file:

1. **Triggers**: Runs on push to `main` branch
2. **Build**: Installs dependencies, runs tests, builds the app
3. **Deploy**: Uploads build artifacts to GitHub Pages
4. **HTTPS**: GitHub automatically provides SSL certificate

---

## Comparison: GitHub Pages vs S3

| Feature | GitHub Pages | S3 + CloudFront |
|---------|-------------|-----------------|
| **HTTPS** | ✅ Free, automatic | ⚠️ Requires CloudFront |
| **Cost** | ✅ Free | 💰 ~$1-5/month |
| **Setup Time** | ✅ 5 minutes | ⚠️ 30-60 minutes |
| **Custom Domain** | ✅ Free SSL | ⚠️ Extra config needed |
| **Deployment** | ✅ Automatic on push | ⚠️ Manual script |
| **CDN** | ✅ Built-in | ✅ Via CloudFront |

---

## Next Steps

- [x] GitHub Pages configured
- [x] Automatic HTTPS enabled
- [x] Workflow created
- [ ] Push to deploy
- [ ] Test File System Access API
- [ ] (Optional) Add custom domain

## Support

- Check deployment status: **Actions** tab
- View live site: **Settings** → **Pages**
- GitHub Pages docs: https://docs.github.com/pages
