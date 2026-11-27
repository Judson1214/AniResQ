# Runbook 07: GitHub Repository Hardening & Branch Protection Settings

This runbook specifies the exact security configurations the repository owner must enforce in the GitHub repository settings.

Navigate to **Repository Settings**:
`https://github.com/<OWNER>/<REPO>/settings`

---

## 1. Branch Protection Rules for `main`

Navigate to **Branches** > **Add classic branch protection rule** (or **Rulesets** > **New ruleset**):
`https://github.com/<OWNER>/<REPO>/settings/branches`

Configure the branch pattern `main` with the following settings:

| Setting | Value | Purpose |
| :--- | :--- | :--- |
| **Require a pull request before merging** | **ON** | Prohibits direct pushes to production branch. |
| **Required approvals** | **At least 1 review** | Enforces four-eyes review before code merges. |
| **Dismiss stale pull request approvals when new commits are pushed** | **ON** | Re-triggers review when PR branch changes. |
| **Require status checks to pass before merging** | **ON** | Prevents broken builds from reaching main. |
| **Status checks that are required** | `ci-gatekeeper` | Enforces all linting, unit tests, coverage thresholds, E2E, and DB audits pass. |
| **Require branches to be up to date before merging** | **ON** | Prevents race condition bugs between branches. |
| **Require signed commits** | **ON** | Ensures commit provenance via verified GPG/SSH signatures. |
| **Require conversation resolution before merging** | **ON** | Ensures all review comments are addressed. |
| **Do not allow bypassing the above settings** | **ON** | Applies rules to administrators as well. |
| **Block force pushes** | **ON** | Prevents history deletion or overwrites on main. |
| **Block deletions** | **ON** | Prevents accidental deletion of the production branch. |

---

## 2. Code Security and Analysis

Navigate to **Security** > **Code security and analysis**:
`https://github.com/<OWNER>/<REPO>/settings/security_analysis`

Enable the following automated scanners:

1. **Dependency Graph**: `Enabled`
2. **Dependabot Alerts**: `Enabled`
3. **Dependabot Security Updates**: `Enabled` (automatically opens PRs for vulnerable dependencies)
4. **GitHub Advanced Security (CodeQL)**: `Default setup` or `Advanced workflow`
5. **Secret Scanning**: `Enabled`
6. **Push Protection**: `Enabled` (rejects any git push containing recognized API keys, tokens, or private certificates)

---

## 3. Collaborator Two-Factor Authentication (2FA)

Navigate to **Organization Settings** > **Authentication security**:
`https://github.com/organizations/<YOUR-ORG>/settings/security`

1. Toggle **Require two-factor authentication for everyone in your organization**.
2. Set grace period to 48 hours for new members.
3. Remove any collaborators who do not comply.

---

## 4. GitHub Actions Workflow Permissions

Navigate to **Actions** > **General**:
`https://github.com/<OWNER>/<REPO>/settings/actions`

1. **Workflow permissions**: Select **Read repository contents and packages permissions** (principle of least privilege; write permissions are declared per job).
2. **Fork pull request workflows**: Select **Require approval for first-time contributors** or **Require approval for all outside collaborators**.
3. **Environment protection**: Create an environment named `production` under **Environments** (`https://github.com/<OWNER>/<REPO>/settings/environments/new`):
   - Add **Required reviewers** (select project owner and senior ops engineers).
   - Configure **Deployment branches** to `Selected branches: main` only.
