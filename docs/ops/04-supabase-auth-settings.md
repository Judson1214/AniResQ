# Runbook 04: Supabase Authentication Production Hardening Checklist

This checklist covers critical authentication, security, and throttling controls that the repository owner must configure in the Supabase Dashboard before opening the platform to users.

Navigate to **Authentication > Configuration**:
`https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/users`

---

## Security & Authentication Checklist

| Category | Dashboard Setting | Recommended Production Value | Reason |
| :--- | :--- | :--- | :--- |
| **Email Security** | **Enable email confirmations** | **ON (Checked)** | Prevents fake signups and account takeovers using unverified emails. |
| **Password Policy** | **Minimum password length** | **12 characters** (or higher) | Protects against credential stuffing and brute-force dictionary attacks. |
| **Password Policy** | **Prevent compromised passwords** | **ON (Checked)** | Checks passwords against the HaveIBeenPwned database on signup/reset. |
| **Bot Mitigation** | **Enable CAPTCHA protection** | **ON (Turnstile or hCaptcha)** | Prevents scripted mass signups and bot-driven API token generation. |
| **Session Security**| **JWT Expiry limit** | **3600 seconds (1 hour)** | Minimizes exposure time if an access token is leaked. |
| **Session Security**| **Refresh token rotation** | **ON (Enabled)** | Revokes older refresh tokens on use and detects token theft. |
| **Session Security**| **Multi-Factor Auth (MFA)** | **ON (TOTP Enforced for Owner/Staff)** | Enforces two-factor authentication for administrators and project owners. |
| **URL Whitelist** | **Site URL & Redirect URLs** | Strictly `https://app.aniresq.com/**` | Blocks open redirect attacks by removing `localhost`, `127.0.0.1`, and wildcards. |
| **Rate Limiting** | **Email rate limit** | **3–5 emails / hour per user** | Prevents spamming verification or reset emails. |
| **Rate Limiting** | **Anonymous rate limits** | **30 requests / minute per IP** | Enforces PostgREST request throttling on auth endpoints. |
| **Email Delivery** | **Custom SMTP Provider** | **Configured (SendGrid, Postmark, AWS SES)** | Default Supabase SMTP has a 30 emails/hour hard limit and poor deliverability. |

---

## Step-by-Step Configuration

### 1. Configure Password and Leaked Password Protection
1. In the Supabase Dashboard, go to **Authentication > Providers > Email**.
2. Set **Minimum password length** to `12`.
3. Enable **Prevent use of compromised passwords**.
4. Save changes.

### 2. URL Whitelist Lockdown
1. Go to **Authentication > URL Configuration**.
2. Set **Site URL** to `https://app.aniresq.com`.
3. Under **Redirect URLs**, delete all development URLs (`http://localhost:*`, `http://127.0.0.1:*`).
4. Add only:
   - `https://app.aniresq.com`
   - `https://app.aniresq.com/login`
   - `https://app.aniresq.com/dashboard`
5. Save changes.

### 3. Configure External SMTP Provider
1. Go to **Project Settings > Authentication > SMTP Settings**.
2. Toggle **Enable Custom SMTP**.
3. Enter your dedicated SMTP host (e.g. `smtp.sendgrid.net`, `smtp.postmarkapp.com`), port (`587`), sender email (`noreply@aniresq.com`), and authenticated user/key.
4. Send a test email to verify DNS and SPF/DKIM verification.

### 4. Enable MFA on Supabase Account
1. Go to `https://supabase.com/dashboard/account/security`.
2. Under **Two-Factor Authentication (2FA)**, click **Add 2FA**.
3. Scan the QR code using an authenticator app (Google Authenticator, 1Password) and verify the code.
