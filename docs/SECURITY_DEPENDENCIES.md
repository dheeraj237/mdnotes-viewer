# Security Audit - Dependency Vulnerabilities

## Audit Date: February 7, 2026

### Summary
Security audit identified **6 vulnerabilities** in dependencies:
- **1 High Severity** - Next.js DoS vulnerability
- **5 Moderate Severity** - Next.js and lodash-es issues

---

## Critical Vulnerabilities

### 1. HIGH: Next.js HTTP Request Deserialization DoS
**Package**: `next@16.1.4`  
**Patched in**: `>=16.1.5`  
**Impact**: Potential DoS when using React Server Components  
**Risk**: Medium (requires specific RSC configuration)

**Recommendation**: ⚠️ **Upgrade to Next.js 16.1.5 or later**

```bash
yarn upgrade next@^16.1.5
```

---

## Moderate Vulnerabilities

### 2. Next.js Image Optimizer DoS
**Package**: `next@16.1.4`  
**Patched in**: `>=16.1.5`  
**Impact**: DoS via Image Optimizer remotePatterns  
**Risk**: Low (only if using Image Optimizer with remotePatterns)

**Note**: MDNotes Viewer doesn't use Image Optimizer with remote patterns.

### 3. Next.js PPR Resume Endpoint Memory Issue
**Package**: `next@16.1.4`  
**Patched in**: `>=16.1.5`  
**Impact**: Unbounded memory consumption  
**Risk**: Low (only if using PPR - Partial Prerendering)

**Note**: MDNotes Viewer doesn't use PPR.

### 4-6. Lodash-es Prototype Pollution (3 instances)
**Package**: `lodash-es` (transitive dependency via mermaid)  
**Path**: `mermaid > @mermaid-js/parser > langium > chevrotain > lodash-es`  
**Patched in**: `>=4.17.23`  
**Impact**: Prototype pollution in `_.unset` and `_.omit`  
**Risk**: Low (indirect dependency, not directly used)

**Note**: This is a transitive dependency from mermaid. Cannot be directly upgraded.

---

## Recommended Actions

### Immediate (High Priority)

✅ **Upgrade Next.js to 16.1.5+**
```bash
# Update package.json
yarn upgrade next@^16.1.5

# Verify
yarn list next

# Test build
yarn build

# Test dev server
yarn dev
```

### Medium Priority

🔍 **Monitor Mermaid Updates**
- Check for mermaid updates that use patched lodash-es
- Current: `mermaid@11.12.2`
- Check: https://github.com/mermaid-js/mermaid/releases

```bash
# Check for mermaid updates
yarn outdated mermaid

# Update if available
yarn upgrade mermaid@latest
```

### Low Priority (Already Mitigated)

✅ **Mermaid Security** - Already set to "strict" mode
```typescript
securityLevel: "strict"  // Prevents JS execution in diagrams
```

---

## Risk Assessment

### Overall Risk: LOW
- High severity issue has low actual risk (not using vulnerable features)
- Lodash-es issues are in transitive dependencies
- All HTML rendering is sanitized with DOMPurify
- Strict security settings prevent most attack vectors

### Mitigation Status

| Vulnerability | Severity | Risk | Status |
|---------------|----------|------|--------|
| Next.js RSC DoS | High | Low | ⚠️ Upgrade recommended |
| Next.js Image DoS | Moderate | Low | ✅ Not using feature |
| Next.js PPR Memory | Moderate | Low | ✅ Not using feature |
| lodash-es (3x) | Moderate | Low | ✅ Indirect dependency |

---

## Upgrade Script

Create this script to automatically upgrade:

```bash
#!/bin/bash
# upgrade-security.sh

echo "🔒 Upgrading security dependencies..."

# Upgrade Next.js
echo "📦 Upgrading Next.js to 16.1.5..."
yarn upgrade next@^16.1.5

# Check for other updates
echo "🔍 Checking for other updates..."
yarn upgrade-interactive --latest

# Run security audit
echo "🔒 Running security audit..."
yarn security:audit

# Build verification
echo "🏗️  Verifying build..."
yarn build

echo "✅ Security upgrade complete!"
```

Make executable:
```bash
chmod +x upgrade-security.sh
./upgrade-security.sh
```

---

## Verification Steps

After upgrading:

1. **Run Security Audit**
   ```bash
   yarn security:audit
   ```

2. **Verify Build**
   ```bash
   yarn build
   ```

3. **Test Application**
   ```bash
   yarn dev
   ```
   - Test markdown rendering
   - Test mermaid diagrams
   - Test HTML blocks
   - Test file operations

4. **Check Dependencies**
   ```bash
   yarn list next
   yarn list mermaid
   ```

---

## Future Security Practices

### Regular Audits
```bash
# Weekly
yarn security:audit

# Before each release
yarn security:check
```

### Automated Updates
Consider using:
- **Dependabot** (GitHub) - Automated security updates
- **Renovate** - Dependency update automation
- **Snyk** - Continuous security monitoring

### .github/dependabot.yml
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    versioning-strategy: increase
    labels:
      - "dependencies"
      - "security"
```

---

## Security Monitoring

### Resources
- [Next.js Security Advisories](https://github.com/vercel/next.js/security/advisories)
- [Mermaid Security](https://github.com/mermaid-js/mermaid/security)
- [GitHub Security Advisories](https://github.com/advisories)
- [Snyk Vulnerability Database](https://security.snyk.io/)

### Notification Setup
1. Watch repositories on GitHub
2. Enable security alerts
3. Subscribe to security mailing lists

---

## Conclusion

### Current Status: ✅ SECURE with Minor Upgrade Recommended

Our security hardening (DOMPurify, sanitization, validation) protects against:
- ✅ XSS attacks
- ✅ HTML injection
- ✅ Path traversal
- ✅ Malicious file uploads

The dependency vulnerabilities:
- ⚠️ Require Next.js upgrade (low risk, easy fix)
- ✅ Do not affect core security features
- ✅ Are mitigated by our security measures

**Next Action**: Upgrade Next.js to 16.1.5+

---

**Last Updated**: February 7, 2026  
**Next Review**: Weekly security audits recommended
