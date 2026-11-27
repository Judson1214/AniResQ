# Runbook 09: Git History Secret Scrubbing and Hygiene

This runbook guides repository administrators through diagnosing, scrubbing, and recovering from committed secrets in git history using modern tooling (`git-filter-repo`).

---

## 1. Cardinal Rule: Rotate First, Scrub Second

> [!CAUTION]
> **Scrubbing git history DOES NOT invalidate a compromised credential.**
> If a secret (e.g. Supabase service-role key, JWT secret, database password, API key) was ever pushed to GitHub, assume it has already been compromised by scrapers, forks, or cached webhooks.
>
> **Step 0 must always be credential rotation** following [`docs/ops/02-rotate-secrets.md`](file:///d:/AniResQ/docs/ops/02-rotate-secrets.md) before attempting history manipulation.

---

## 2. Detecting Secrets in Repository History

### A. Recommended Tool: Gitleaks

AniResQ maintains repository rules in [`gitleaks.toml`](file:///d:/AniResQ/gitleaks.toml) and validates incoming pull requests in CI via `.github/workflows/ci.yml`.

To run a full history scan locally:
```bash
# Install Gitleaks
# macOS:
brew install gitleaks

# Linux / WSL:
curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz | sudo tar -xz -C /usr/local/bin gitleaks

# Windows (Winget):
winget install Gitleaks.Gitleaks

# Execute full history audit against repository configuration
gitleaks detect --source . --verbose --config gitleaks.toml
```

### B. Fallback Regex Audit (Without Gitleaks Installed)

Run this Python audit command across all commit diffs:
```bash
python -c "
import subprocess, re

cmd = ['git', '--no-pager', 'log', '-p', '--no-color']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, errors='replace')
patterns = {
    'JWT token (eyJh)': re.compile(r'eyJh[A-Za-z0-9_-]{20,}'),
    'Database URI': re.compile(r'postgres(ql)?:\/\/[^:]+:[^@\s]+@'),
    'Private Key': re.compile(r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'GitHub Token': re.compile(r'ghp_[A-Za-z0-9]{20,}'),
    'GitLab Token': re.compile(r'glpat-[A-Za-z0-9_-]{20,}'),
}
for line in proc.stdout:
    if line.startswith('+') and not line.startswith('+++'):
        for name, pat in patterns.items():
            if pat.search(line) and not any(k in line for k in ['placeholder', 'dummy', '<YOUR-']):
                print(f'{name}: {line.strip()[:100]}')
"
```

---

## 3. Scrubbing Git History with `git-filter-repo`

The Git core team officially recommends [`git-filter-repo`](https://github.com/newren/git-filter-repo) over legacy tools (`git filter-branch` or BFG Repo-Cleaner).

### Step 1: Install `git-filter-repo`

```bash
pip install git-filter-repo
```

### Step 2: Make a Fresh Mirror Backup Clone

Never scrub your only copy. Clone a fresh mirror:
```bash
git clone --mirror https://github.com/<YOUR-ORG-OR-USER>/AniResQ.git AniResQ-scrub
cd AniResQ-scrub
```

### Step 3: Remove Sensitive File or Replace Text

#### Scenario A: Removing an entire sensitive file from all history
```bash
# Remove specific accidental files (.env, credentials.json, id_rsa)
git-filter-repo --invert-paths --path-match .env --path-match id_rsa
```

#### Scenario B: Redacting a specific secret token or string
Create a file named `replace-expressions.txt`:
```text
regex:(?i)ACTUAL_LEAKED_SECRET_STRING==>REDACTED_SECRET
```
Execute replacement across all commits, messages, and tags:
```bash
git-filter-repo --replace-text replace-expressions.txt
```

### Step 4: Verify History is Clean

Re-run Gitleaks or the regex scanner:
```bash
gitleaks detect --source . --verbose --config ../AniResQ/gitleaks.toml
```

---

## 4. Force-Pushing the Rewritten History

Rewriting history changes the SHA of every downstream commit.

1. **Temporarily Permit Force Pushes on GitHub**:
   - Navigate to GitHub Repository > **Settings** > **Branches** > **Branch protection rules** (edit `main`).
   - Temporarily check **Allow force pushes** (or ensure repository administrator bypass is active).
   - See [`docs/ops/07-github-settings.md`](file:///d:/AniResQ/docs/ops/07-github-settings.md) for full branch protection configuration.

2. **Push Rewritten Branches and Tags**:
   ```bash
   git remote set-url origin https://github.com/<YOUR-ORG-OR-USER>/AniResQ.git
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Re-Enable Branch Protection**:
   - Return to GitHub Repository > **Settings** > **Branches** > **Branch protection rules** and immediately uncheck **Allow force pushes**.

---

## 5. Post-Scrub Operations

1. **Clear GitHub Server Cache**:
   - GitHub retains unreachable commits in internal cache/reflog for a short period.
   - Contact [GitHub Support](https://support.github.com/) to request a garbage collection / cache purge if the repository was ever public.
2. **Team Member Resets**:
   - All collaborators must delete their local clones and clone a fresh copy:
     ```bash
     rm -rf AniResQ
     git clone https://github.com/<YOUR-ORG-OR-USER>/AniResQ.git
     ```
   - Merging or pulling an old clone will re-introduce the leaked commit SHAs back into the remote.

---

## 6. Related Runbooks
- [`docs/ops/02-rotate-secrets.md`](file:///d:/AniResQ/docs/ops/02-rotate-secrets.md) — Credential rotation procedures.
- [`docs/ops/07-github-settings.md`](file:///d:/AniResQ/docs/ops/07-github-settings.md) — Branch protection rules and GitHub security settings.
