# Git Hooks - PezkuwiChain

## =Ë Overview

This directory contains Git hook templates that help prevent security issues and maintain code quality.

---

## =' Installation

### Quick Install (Recommended)

Run this command from the project root:

```bash
cp .git-hooks/pre-commit.example .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Verify Installation

```bash
# Check if hook is installed
ls -la .git/hooks/pre-commit

# Test the hook
git add .
git commit -m "test" --dry-run
```

---

## =Ú Available Hooks

### pre-commit

**Purpose:** Prevents committing sensitive data and enforces code quality

**Checks:**
- L Blocks `.env` files from being committed
- L Blocks files with sensitive patterns (passwords, API keys, etc.)
- L Blocks secret files (.key, .pem, .cert, etc.)
-    Warns about large files (>500KB)
-    Warns about debug code (console.log, debugger)
-    Warns about hardcoded credentials

**Example output:**
```
= Running pre-commit security checks...
Checking for .env files...
Scanning for sensitive patterns...
Checking for secret files...
Checking for large files...
Checking for debug code...
 All security checks passed!
```

---

## =à Configuration

### Bypass Hook (Not Recommended)

If you absolutely need to bypass the hook:

```bash
git commit --no-verify -m "message"
```

  **WARNING:** Only bypass if you're sure there are no secrets!

### Customize Checks

Edit `.git-hooks/pre-commit.example` and adjust:

- `PATTERNS` - Secret detection patterns
- `SECRET_FILES` - File patterns to block
- `MAX_FILE_SIZE` - Maximum file size in KB
- `DEBUG_PATTERNS` - Debug code patterns

---

## >ê Testing

### Test with Sample Commits

```bash
# Test 1: Try to commit .env (should fail)
echo "SECRET=test" > .env
git add .env
git commit -m "test"
# Expected: L ERROR: Attempting to commit .env file!

# Test 2: Try to commit hardcoded password (should fail)
echo 'const password = "mysecret123"' >> test.ts
git add test.ts
git commit -m "test"
# Expected: L ERROR: Potential secrets detected!

# Test 3: Normal commit (should pass)
echo 'const x = 1' >> test.ts
git add test.ts
git commit -m "test"
# Expected:  All security checks passed!
```

---

## = What Each Check Does

### 1. `.env` File Check
```bash
# Blocks any .env file
.env
.env.local
.env.production
.env.staging
```

### 2. Sensitive Pattern Detection
Searches for patterns like:
- `password = "..."`
- `api_key = "..."`
- `secret = "..."`
- `token = "..."`
- Private key headers
- AWS access keys

### 3. Secret File Detection
Blocks files matching:
- `*.key`, `*.pem`, `*.cert`
- `*.p12`, `*.pfx`
- `*secret*`, `*credential*`
- `.npmrc`, `.dockercfg`

### 4. Large File Warning
Warns if file is larger than 500KB:
```
   WARNING: Large file detected: image.png (1024KB)
Consider using Git LFS for large files
```

### 5. Debug Code Detection
Warns about:
- `console.log()`
- `debugger`
- `TODO security`
- `FIXME security`

### 6. Hardcoded Credentials Check
Special check for `AuthContext.tsx`:
```typescript
// L BAD - Will be blocked
const password = "mysecret123"

//  GOOD - Will pass
const password = import.meta.env.VITE_PASSWORD
```

---

## =¨ Troubleshooting

### Hook Not Running

```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# Check if executable
chmod +x .git/hooks/pre-commit

# Verify hook content
cat .git/hooks/pre-commit
```

### False Positives

If the hook incorrectly flags a file:

1. Review the pattern that triggered
2. Confirm the file is safe
3. Use `--no-verify` to bypass (with caution)
4. Update the pattern in `.git-hooks/pre-commit.example`

### Hook Errors

```bash
# If hook fails to run
bash -x .git/hooks/pre-commit

# Check for syntax errors
bash -n .git/hooks/pre-commit
```

---

## =Ê Integration with CI/CD

The pre-commit hook works alongside:

### GitHub Actions
- `.github/workflows/security-check.yml` - Automated security scanning
- Runs on every PR and push to main
- Catches issues missed locally

### Pre-push Hook (Optional)
You can also add a pre-push hook:
```bash
# .git-hooks/pre-push.example
#!/bin/bash
npm test
npm run lint
```

---

## = Best Practices

1. **Install hooks immediately** after cloning the repo
2. **Never use `--no-verify`** unless absolutely necessary
3. **Keep hooks updated** - run `git pull` regularly
4. **Test hooks** before committing important changes
5. **Report false positives** to improve the hook

---

## =Ú Additional Resources

### Git Hooks Documentation
- [Git Hooks Official Docs](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Pre-commit Framework](https://pre-commit.com/)

### Security Tools
- [git-secrets](https://github.com/awslabs/git-secrets)
- [gitleaks](https://github.com/zricethezav/gitleaks)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)

---

## <˜ Support

If you encounter issues:

1. Check this README
2. Review `SECURITY.md` in project root
3. Contact: security@pezkuwichain.io

---

**Last Updated:** October 28, 2024
