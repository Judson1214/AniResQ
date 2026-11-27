# AniResQ Community Pilot Operational Plan

> [!WARNING]
> **TEMPLATE / OPERATIONAL DRAFT**
> This operational document is a template designed to guide the organization through the pilot rollout. Any legal references or compliance notes contained herein must be reviewed by a qualified legal advisor before public deployment. This project does not claim legal compliance.

---

## 1. Executive Summary & Pilot Scope

The AniResQ Community Pilot is a controlled, field-testing initiative designed to validate core animal rescue, lost-and-found reporting, adoption coordination, and community moderation workflows within a localized geographical jurisdiction.

### 1.1 Pilot Goals
1. **Response Time Validation**: Measure the median response time from an emergency distress report (`PENDING`) to volunteer operator dispatch (`IN_PROGRESS`) and shelter intake or resolution (`RESOLVED`).
2. **Community Trust & Safety**: Evaluate the efficacy of self-service abuse reporting (`/api/reports`), rapid moderation by administrators, and community dispute mitigation.
3. **Privacy by Design**: Verify the automated PII minimization mechanisms, ensuring responder ID credentials are strictly truncated to the last 4 characters and unused accounts can be cleanly self-deleted.
4. **Data Integrity & Auditability**: Ensure all status transitions, verification approvals, and moderation actions produce tamper-evident audit trails.

### 1.2 Participating Roles & Permissions

| Role | Target Pilot Population | Primary Responsibilities | Access Level |
| :--- | :--- | :--- | :--- |
| **Reporter / Citizen** | General public, volunteers, local residents | Submitting animal rescue distress calls, posting lost/found pet notices, browsing adoption catalog. | Public submitter (`USER`); authenticated via Supabase Auth. Rate limited. |
| **Adopter** | Screened community members | Submitting adoption applications, tracking application status, communicating with shelters. | Authenticated `USER`; limited to own applications. |
| **Volunteer Operator** | Trained local animal rescue volunteers | Accepting rescue dispatches, updating live rescue status on map, coordinating transport. | Verified `OPERATOR`; requires admin approval and last-4 ID clearance. |
| **Shelter Staff** | Local partnered NGO / municipal shelters | Managing kennel capacity, updating animal medical status, processing adoption applications. | `SHELTER` or `NGO_ADMIN`; scoped to managed facilities. |
| **System Administrator** | AniResQ Core Operations Team | Managing operator verification, adjudicating abuse reports, disabling offending users, system audits. | `ADMIN`; access to `/admin/*`, moderation queues, and audit logs. |

---

## 2. Operational Onboarding Checklists

### 2.1 Operator Onboarding Checklist

Before an operator is activated on the live dispatch map, execute the following verification pipeline:

- [ ] **Account Creation**: Operator registers via `/register`, accepting the Terms of Service and Privacy Policy (`POST /api/users/me/consent`).
- [ ] **Clearance Submission**: Operator navigates to `/profile`, submits full legal name, phone number, and only the **last 4 digits** of their government-issued identification or volunteer credentials.
- [ ] **Physical / Interview Verification**: AniResQ pilot coordinator conducts an in-person or video onboarding check to verify the operator's identity and animal handling experience.
- [ ] **Admin Approval**: Admin visits `/admin/operators`, reviews the operator's submission, checks the ID last 4 digits match, and clicks **Approve Operator**.
- [ ] **Safety Briefing**: Operator confirms receipt of safety protocols:
  - Never approach aggressive, rabid, or venomous animals without proper gear.
  - In life-threatening emergencies, immediately call municipal emergency services (112 / local animal control).
  - Never trespass on private property without explicit owner consent.
- [ ] **Equipment Inspection**: Confirm the operator possesses standard safety gear (slip leashes, pet carrier, bite-proof gloves, first-aid kit).

### 2.2 Shelter / NGO Onboarding Checklist

- [ ] **Organizational Vetting**: Verify municipal registration, NGO license, or non-profit certification.
- [ ] **Facility Inspection**: Confirm shelter capacity, quarantine area availability, and veterinary support agreements.
- [ ] **Admin Account Provisioning**: Provision shelter administrator account with role `SHELTER` or `NGO_ADMIN`.
- [ ] **Intake Capacity Setup**: Configure initial kennel count and available medical quarantine slots in `/admin/shelters`.
- [ ] **Emergency Contact Sync**: Establish a direct telephone hotline between the shelter intake desk and AniResQ volunteer dispatchers.

---

## 3. Incident Response & Abuse Handling

Community trust depends on swift action against spam, fake rescue calls, harassment, or unsafe behavior.

### 3.1 Content Moderation Workflow

```
[Community Report Submitted]
       │
       ▼
[Status: PENDING in /admin/reports]
       │
  ┌────┴───────────────────────────┐
  ▼                                ▼
[Legitimate Abuse / Violation]   [Benign / False Alarm]
  │                                │
  ├─ Action: Remove Content        └─ Action: Mark DISMISSED
  ├─ Action: Disable Offender         (Status updated in audit log)
  └─ Status: Mark ACTIONED
```

1. **Intake**: Any citizen or volunteer can report rescues, lost pet posts, replies, or user profiles via the in-app **Report** button. This creates a record in `public.content_reports`.
2. **Triaging Queue**: Administrators review reports at `/admin/reports`, filtering by status (`PENDING`, `REVIEWED`, `ACTIONED`, `DISMISSED`) and target type.
3. **Investigation**:
   - Check reporter credibility and report reason (`SPAM`, `HARASSMENT`, `FALSE_INFORMATION`, `INAPPROPRIATE_MEDIA`, `OTHER`).
   - Cross-reference past reports against the same user or target.
4. **Resolution**:
   - If content is fraudulent or harmful:
     - Admin flags the report as `ACTIONED` with resolution notes.
     - For abusive users, admin navigates to `/admin/operators` or user management and clicks **Disable User** (`POST /api/users/{id}/disable`). This immediately revokes application access and marks `is_disabled = true`.
     - Inappropriate replies are deleted via `DELETE /api/lostfound/replies/{id}`.
   - If report is groundless:
     - Admin marks the report as `DISMISSED`.
     - Reporter receives no punitive action for genuine mistakes, but repeated bad-faith reports trigger a warning.

### 3.2 Handling Fake Rescue Distress Calls

Fake or prank distress calls waste critical volunteer resources and endanger lives.

1. **Initial Spotting**: Indicators of fake rescues include stock imagery (verifiable via reverse image search), impossible GPS coordinates, or uncontactable phone numbers.
2. **Telephone Triage**: Before dispatching an operator, dispatch staff should attempt a brief 30-second telephone confirmation with the reporter.
3. **False Call Escalation**:
   - If confirmed fake, set rescue status to `CANCELLED` with note "Confirmed fraudulent report".
   - Submit an immediate moderation report targeting the user account.
   - Disable the reporter's account to block future submissions.
   - In cases of malicious intent (e.g., swatting or sending volunteers into hazardous terrain), document evidence for local law enforcement referral.

---

## 4. Privacy & Data Subject Operations

### 4.1 Self-Service Data Export
- Any authenticated user can download a machine-readable JSON archive of all personal data held by AniResQ by navigating to `/profile` -> **Privacy and Data** -> **Download My Data**.
- API endpoint: `GET /api/users/me/export` (strictly rate-limited to prevent scraping).
- Contents include: user profile, rescue submissions, adoption applications, forum replies, and consent history.

### 4.2 Self-Service Account Deletion
- Users can delete their account at any time via `/profile` -> **Privacy and Data** -> **Delete My Account**.
- A two-step modal warning prompts the user to confirm.
- Execution:
  1. Frontend calls `DELETE /api/users/me`.
  2. Backend validates active commitments (cannot delete if an operator is actively on an `IN_PROGRESS` rescue; must cancel or resolve first).
  3. Profile is cleared: name changed to "Deleted User", email anonymized to random UUID `@deleted.local`, phone and ID cleared, user soft-disabled or hard-deleted according to retention schedule.
  4. Related rescues and forum posts remain for animal safety records, but `reporter_id` is disassociated (`ON DELETE SET NULL`).
  5. Audit entry is permanently written: `USER_DELETED`.

---

## 5. Pilot Feedback & Success Metrics

During the pilot phase, weekly operational reviews will track:
- **Total Rescues Initiated vs. Resolved** (Target: >85% successful outcome or safe shelter intake).
- **Abuse Reports Submitted vs. Resolution Time** (Target: Median adjudication < 2 hours).
- **Operator Verification Latency** (Target: Under 24 hours from submission to clearance).
- **Incident Severity**: Zero physical injury or safety incidents among volunteer operators.
