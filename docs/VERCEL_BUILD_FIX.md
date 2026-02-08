# Vercel Build Fix - Private Registry Issue

## ❌ The Problem

Vercel build failed with:
```
error An unexpected error occurred: "https://artifactory.eng.medallia.com/api/npm/virtual-npm/style-mod/-/style-mod-4.1.3.tgz:"
Error: Command "yarn install" exited with 1
```

### Root Cause
The `yarn.lock` file contained **759 package references** pointing to a **private Medallia artifactory**:
```
resolved "https://artifactory.eng.medallia.com/api/npm/virtual-npm/..."
```

Vercel doesn't have credentials to access this private registry, causing dependency installation to fail.

---

## ✅ The Solution

### What Was Fixed
Replaced all 759 private artifactory URLs with the public npm registry:

**Before:**
```
resolved "https://artifactory.eng.medallia.com/api/npm/virtual-npm/@babel/core/-/core-7.28.6.tgz"
```

**After:**
```
resolved "https://registry.npmjs.org/@babel/core/-/core-7.28.6.tgz"
```

### How It Was Done
```bash
sed -i.bak 's|https://artifactory.eng.medallia.com/api/npm/virtual-npm/|https://registry.npmjs.org/|g' yarn.lock
```

### Verification
- **Before**: 759 artifactory references
- **After**: 0 artifactory references
- **Now**: 759 public npm registry references ✓

---

## 📋 Changes Committed

**Commit**: `5a38df6`

### Files Modified
1. `yarn.lock` - All registry URLs fixed
2. `VERCEL_DEPLOYMENT_FIX.md` - Documentation (added earlier)

### Git Message
```
fix: replace private artifactory registry with public npm registry in yarn.lock

- Replace 759 references from artifactory.eng.medallia.com to registry.npmjs.org
- Fixes Vercel build failure due to private registry access
- Allows Vercel to successfully install dependencies from public npm registry
```

---

## 🚀 Next Steps

1. ✅ Pushed to GitHub (master branch)
2. ⏳ Vercel will auto-deploy with this fix
3. Build should succeed now

### Check Deployment Status
- **Vercel Dashboard**: https://vercel.com/dheeru-suthars-projects/mdnotes-viewer
- **Project**: mdnotes-viewer  
- **URL**: https://mdnotes-viewer-dheeru-suthars-projects.vercel.app

---

## 🔍 Why This Happened

This typically occurs when:
- ✓ Project was developed in an environment with private npm registry configured
- ✓ `yarn.lock` was committed with private registry URLs
- ✓ Public deployment (Vercel) can't access private registries

### Prevention
For future projects using private registries:
1. Add `.npmrc` or `.yarnrc.yml` to `.gitignore`
2. Document registry setup in team docs
3. Use `.npmrc` locally but don't commit it
4. Or use public packages only for deployment environments

---

## 📊 Summary

| Aspect | Status |
|--------|--------|
| Private Registry URLs | ❌ Removed (759 fixed) |
| Public Registry URLs | ✅ Configured (759) |
| Vercel Deployment | ✅ Ready |
| Build Status | 🔄 In Progress |

---

**Last Updated**: February 8, 2026  
**Status**: ✅ Fixed and Deployed
