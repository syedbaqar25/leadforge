# GitHub Repository Configuration & Public Release Guide

This document outlines the required configuration steps to prepare, harden, and securely publish the **Leadforge** repository on GitHub. Follow each section before changing the repository visibility to Public.

---

## 1. Security & Vulnerability Management

Navigate to **Settings** > **Code security and analysis** in your GitHub repository:

### A. Secret Scanning & Push Protection

1. Enable **Secret scanning**.
2. Enable **Push protection** (blocks any commit containing detected secrets before it reaches GitHub).
3. If using GitHub CLI:
   ```bash
   gh repo edit --enable-secret-scanning --enable-secret-scanning-push-protection
   ```

### B. Dependabot Alerts & Security Updates

1. Under **Dependabot**:
   - Enable **Dependabot alerts**.
   - Enable **Dependabot security updates** (automatically creates PRs for known vulnerable dependencies).
2. Ensure repository dependency graphs are enabled.

### C. Private Vulnerability Reporting

1. Under **Security** > **Advisories** (or **Settings** > **Code security and analysis**):
2. Enable **Private vulnerability reporting**.
3. This allows external security researchers and users to responsibly disclose security flaws directly to repository maintainers via a private advisory draft without public disclosure.

---

## 2. Default Workflow Permissions

Configure GitHub Actions to operate with minimum necessary privileges:

1. Navigate to **Settings** > **Actions** > **General**.
2. Scroll to **Workflow permissions**.
3. Select **Read repository contents permission** (read-only by default).
4. Uncheck **Allow GitHub Actions to create and approve pull requests**.
5. Save changes.
6. Individual workflows requiring elevated permissions (such as `security.yml` writing to `security-events`) declare their exact scopes explicitly in the workflow file:
   ```yaml
   permissions:
     contents: read
     security-events: write
   ```

---

## 3. Branch Protection Rules for `main`

Protect the primary production branch `main` against unreviewed or failing commits:

1. Navigate to **Settings** > **Branches** > click **Add branch ruleset** or **Add branch protection rule**.
2. Set **Branch name pattern** to `main`.
3. Configure the following rules:
   - **Require a pull request before merging**:
     - Check **Require approvals** (minimum: `1`).
     - Check **Dismiss stale pull request approvals when new commits are pushed**.
     - Check **Require review from Code Owners** (enforces `.github/CODEOWNERS`).
   - **Require status checks to pass before merging**:
     - Check **Require branches to be up to date before merging**.
     - Search and add the following required status checks:
       - `lint-typecheck`
       - `test`
       - `build`
       - `gitleaks`
       - `dependency-audit`
   - **Do not allow bypassing the above settings** (enforces rules even for repository administrators).
   - **Restrict deletions** (prevent deleting `main`).
   - **Block force pushes** (prevent `git push --force`).
4. Click **Create** / **Save changes**.

---

## 4. Code Ownership (`.github/CODEOWNERS`)

Ensure the `.github/CODEOWNERS` file is present in the repository root:

```text
# Global fallback owner
* @sayedbaqarabbas

# CI and security critical paths
/.github/ @sayedbaqarabbas
/docker/ @sayedbaqarabbas
```

When branch protection requires code owner review, any PR touching files covered by these rules requires approval from the designated owner.

---

## 5. Pre-Release Secret & History Sanitization

Before transitioning the repository from Private to Public, perform a complete history audit to verify no real secrets or unintended files were ever committed:

### Step 1: Scan Complete Git History with Gitleaks

Run Gitleaks across all commits and stashes:

```bash
# Scan full commit history locally
gitleaks detect --source . --verbose
```

### Step 2: Audit Tracked Files

Verify no sensitive files are accidentally tracked by git:

```bash
git ls-files | grep -E '\.env$|\.pem$|\.key$|credentials|service-account'
```

_Expected result: No output (only `.env.example` should be tracked)._

### Step 3: Git Log Pattern Check

Search history for references to high-entropy strings or sensitive terms:

```bash
git log -p -S "leadforge_dev_only"
git log -p -S "sk-"
git log -p -S "BEGIN PRIVATE KEY"
```

Ensure all matched results represent dummy test fixtures or `.env.example` placeholders, not active operational keys.

### Step 4: Rewriting History (If Ever Needed)

If a real secret was ever accidentally committed in previous development:

1. Revoke and rotate the secret immediately with the provider.
2. Purge the secret from history using `git-filter-repo`:
   ```bash
   git filter-repo --replace-text expressions-to-scrub.txt
   ```
3. Force-push the cleansed history before inviting public collaborators or making the repository public.

---

## 6. Public Release Checklist

Before clicking **Make public** under **Settings** > **Danger Zone**:

- [ ] Working CI workflow (`.github/workflows/ci.yml`) passing on `main`
- [ ] Security audit workflow (`.github/workflows/security.yml`) passing on `main`
- [ ] All required branch protections enabled on `main`
- [ ] Push protection enabled under Secret scanning
- [ ] Private vulnerability reporting enabled
- [ ] Default workflow permissions set to read-only
- [ ] Zero real secrets, keys, or passwords in repository or git history
- [ ] `README.md`, `LICENSE`, `CONTRIBUTING.md`, and `SECURITY.md` present and up to date
