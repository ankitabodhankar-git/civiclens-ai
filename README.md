# CivicLens AI — AI-Powered Civic Issue Intelligence & Governance Platform

<!-- Cloud Run Challenge Verification Label -->
<!-- dev-tutorial=cloud-run-ai-challenge -->

> **Track:** Governance & Civic Technology  
> **Status:** Production-Ready Civic Intelligence Prototype  
> **Advisory Mandate:** AI assists humans by structuring unstructured reports, estimating severity/urgency, and calculating advisory priority scores. Authorized civic officers retain sole decision-making authority.

---

## 1. Project Overview & Problem Statement

### The Problem
Municipal and community governance bodies frequently suffer from unstructured citizen complaint channels:
- Citizens describe urgent infrastructure, sanitation, and safety failures in freeform emotional language without standardized categorization.
- Urgent hazards (e.g., exposed live electrical cables or collapsing road craters near school zones) are lost in routine complaints (e.g., overgrown lawn grass).
- Historical civic reports are often discarded or archived in siloed tickets, preventing civic planners from identifying chronic recurring failures (e.g., repeated pipeline bursts on the same street indicating systemic water main degradation).

### The Solution: CivicLens AI
**CivicLens AI** bridges citizens and municipal officers:
1. **Citizens** submit freeform complaints with photos/locations without needing to understand municipal department hierarchies.
2. **Server-Side Gemini 3.8 Flash** sanitizes the input, extracts key civic attributes, determines severity and urgency, produces a factual summary, and assigns an **advisory AI Priority Score (1–100)**.
3. **Cloud Firestore** persists the complete report with server-anchored timestamps and immutable historical integrity.
4. **Authorized Civic Officers** access an interactive governance dashboard with **Historical Search**, **Civic Trend Lens**, **Priority Queue**, and an **Original Feature: Civic Resolution Playbook & Citizen Transparency Notice**.

---

## 2. Threat Summary Table (Production Security Architecture)

| Threat Zone | Risk Analyzed | Countermeasure Implemented |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious injection, oversized payloads, script tag poisoning, malformed JSON | Strict payload schema validation (`express.json({ limit: '1mb' })`), character length bounds (10–8,000 for descriptions, 2–300 for locations), input sanitization before processing. |
| **2. Planning & Reasoning** | Prompt injection, instruction override attempts inside citizen complaints | Citizen narrative encapsulated inside strict `<citizen_report>` delimiters. System prompt strictly instructs Gemini to treat citizen text solely as raw observational data and ignore embedded instructions. |
| **3. Tool Execution & APIs** | API key leakage, unauthorized AI access, SSRF | Gemini API key is isolated strictly in server-side runtime (`process.env.GEMINI_API_KEY`). Browser code never imports `@google/genai` or accesses secrets. |
| **4. Memory & State** | Cross-user data tampering, role escalation, update gaps in Firestore | Comprehensive `firestore.rules` deployed via RPC: Citizens can only read/create their own documents (`ownerId == request.auth.uid`), role fields cannot be self-elevated, and default-deny catch-all protects all collections. |
| **5. Inter-System Communication** | Token interception, unauthorized status manipulation, audit gaps | Firebase Authentication token verification, immutable `auditLogs` collection recording actor UID, role, timestamp, previous status, and new status for every administrative modification. |

---

## 3. System Architecture

```text
[Citizen Browser / Web Client]
          │
          │ 1. Sign In (Google OAuth / Firebase Auth)
          │ 2. Submit Issue (Description, Location)
          ▼
[Authenticated Cloud Run Backend / Express API]
          │
          │ 3. Validate & Sanitize Input
          │ 4. Prompt Isolation & Safety Wrappers
          ▼
[Gemini 3.8 Flash API (@google/genai)]
          │
          │ 5. Structured JSON Output (Category, Severity, PriorityScore 1-100)
          ▼
[Cloud Run API Boundary]
          │
          │ 6. Schema Verification & Normalization
          │ 7. Authenticated Owner-Bound Write
          ▼
[Cloud Firestore Database]
  ├── users/{userId}       (Role-Based Access: Citizen, Officer, Admin)
  ├── issues/{issueId}     (Master Civic Records with Historical Timestamps)
  └── auditLogs/{logId}    (Immutable Governance Event Trail)
          │
          │ 8. Real-Time Querying & Historical Search
          ▼
[Officer Governance Dashboard / Civic Trend Lens]
```

---

## 4. Key Capabilities & Features

### Citizen Capabilities
- **Google Sign-In:** Secure, passwordless authentication.
- **Natural Language Reporting:** Submit complaints without technical jargon.
- **Real-Time Validation & Processing:** Visual status indicators as Gemini extracts structured intelligence.
- **Owner-Bound "My Issues":** Track personal reports, status progressions, and advisory AI classifications.

### Civic Officer Capabilities
- **Overview Dashboard:** Top KPI cards for Total Issues, Open, In Progress, Resolved, and High/Critical Priority.
- **Priority Queue:** Instant triage of highest-priority unresolved hazards.
- **Historical Search:** Custom date-range retrieval (From/To) supporting any historical period (e.g., September 1, 2025 to September 30, 2025), with presets for Last 7 Days, Last 30 Days, Last 90 Days, Last Year, and All Time.
- **Multi-Factor Filtering:** Slice records by Category, Location substring, Severity, and Status with sorting by Priority or Date.
- **Dynamic Aggregate Metrics:** Calculates matching count, average priority, most frequent category, and resolution counts for the filtered scope.
- **Civic Trend Lens:** Aggregates real Firestore records to calculate category volume distributions, resolution rates, and invokes Gemini for executive trend summaries.
- **Status Workflow:** Update issue states (`Open` → `In Progress` → `Resolved`) with mandatory audit logging.

### Original Feature: Civic Resolution Playbook & Citizen Transparency Notice
- **Multi-Department Playbook:** When viewing an issue, officers can click **"Generate Playbook"**. Gemini synthesizes an operational mitigation plan detailing:
  - Realistic target resolution SLA (e.g., `12-24 Hours (Immediate Hazard)` vs `3-5 Working Days`).
  - Lead Municipal Department & Collaborating Agencies (e.g., Department of Public Works + Traffic Police Division).
  - Required Equipment Checklist (e.g., asphalt roller, cold-mix bitumen, illuminated LED cones).
  - On-Site Safety Protocols.
- **Citizen Transparency Notice:** Generates a polite, reassuring, official public announcement that municipal officers can copy or print for local residents explaining the scheduled repair without disclosing the reporter's personal identity.

### Recurring Issue Detection
CivicLens AI actively evaluates newly submitted and historical issues against the database to detect potential clustering and repeat incidents. When inspecting an issue, officers are presented with an advisory **Recurring Issue Detection** section displaying the number of possible related reports within the same vicinity or matching category during the last 30–60 days. Reports are strictly designated as *"Possible related reports"* rather than confirmed duplicates, and are never automatically merged or discarded, leaving the final verification solely to human civic officers.

### Civic SLA Watch
The application connects advisory response targets directly to the civic issue lifecycle. Every incident is assigned a prototype advisory SLA based on urgency and severity (Critical: 12 hours, High: 24 hours, Medium: 3 working days, Low: 7 working days). The **SLA Watch** console on the Officer Dashboard monitors resolution deadlines in real time, segregating unresolved incidents into *Overdue*, *Approaching SLA / At Risk*, and *Critical Unresolved*. Resolved issues immediately exit the overdue queue and record whether they were resolved within or after the advisory SLA window.

### CSV Export
Authorized Civic Officers and Administrators can export currently filtered historical datasets directly to CSV from the **Historical Search** interface. The export strictly respects active date horizons, categories, severities, locations, and status filters. It captures core operational metrics (`issueId`, `createdAt`, `location`, `category`, `severity`, `urgency`, `priorityScore`, `status`, `createdByRole`, `resolvedAt`, `slaStatus`) while strictly excluding citizen emails, authentication tokens, private credentials, or API secrets. Citizen accounts cannot access administrative CSV exports.

---

## 5. Database Schema (Cloud Firestore)

### `users/{userId}`
```json
{
  "uid": "string (Firebase Auth UID)",
  "displayName": "string",
  "email": "string",
  "role": "citizen | officer | admin",
  "createdAt": "ISO 8601 string",
  "updatedAt": "ISO 8601 string"
}
```

### `issues/{issueId}`
```json
{
  "issueId": "string",
  "ownerId": "string (Reporter UID)",
  "ownerEmail": "string (Optional)",
  "title": "string (Max 200 chars)",
  "description": "string (Max 8000 chars)",
  "location": "string (Max 300 chars)",
  "category": "Infrastructure | Sanitation | Transportation | Environment | Public Safety | Public Health | Education | Other",
  "severity": "Low | Medium | High | Critical",
  "urgency": "Low | Medium | High | Critical",
  "impact": "string",
  "summary": "string",
  "recommendedAction": "string",
  "priorityScore": "integer (1-100)",
  "aiConfidence": "float (0.0-1.0)",
  "status": "Open | In Progress | Resolved",
  "createdAt": "ISO 8601 string",
  "updatedAt": "ISO 8601 string",
  "resolvedAt": "ISO 8601 string (optional)",
  "aiAnalyzedAt": "ISO 8601 string",
  "isDemo": "boolean (optional)",
  "slaTargetAt": "ISO 8601 string (optional advisory SLA deadline)",
  "slaStatus": "On Track | At Risk | Overdue | Resolved",
  "relatedIssueIds": ["string"],
  "playbook": {
    "targetResolutionTime": "string",
    "leadDepartment": "string",
    "collaboratingDepartments": ["string"],
    "requiredEquipmentAndResources": ["string"],
    "safetyProtocols": ["string"],
    "mitigationSteps": ["string"],
    "publicTransparencyNotice": "string",
    "generatedAt": "ISO 8601 string"
  }
}
```

### `auditLogs/{logId}`
```json
{
  "logId": "string",
  "actorId": "string (Officer or Admin UID)",
  "actorRole": "citizen | officer | admin",
  "actorEmail": "string",
  "action": "STATUS_CHANGE | PLAYBOOK_GENERATED | ROLE_ASSIGNED | ISSUE_CREATED",
  "issueId": "string (optional)",
  "previousStatus": "Open | In Progress | Resolved",
  "newStatus": "Open | In Progress | Resolved",
  "timestamp": "ISO 8601 string",
  "notes": "string"
}
```

---

## 6. Firestore Security Rules Summary

Deployed in `firestore.rules`:
1. **Default Deny:** `match /{document=**} { allow read, write: if false; }` prevents exposure of unauthorized collections.
2. **Citizen Isolation:** `issues` documents can only be listed or read by citizens if `resource.data.ownerId == request.auth.uid`.
3. **Officer Authorization:** Officers and Admins can query all civic records for historical analysis.
4. **Status Guard:** Only officers can modify issue status; citizens cannot alter priority scores or AI attributes.
5. **Role Escalation Protection:** Users cannot alter their own `role` field in `users/{userId}`.
6. **Immutable Audit Logs:** Audit log entries can only be appended, never edited or deleted.

---

## 7. AI Methodology & Priority Scoring

Priority Score is an **advisory integer (1–100)** calculated using objective criteria:
- **Critical (80–100):** Immediate public hazard (e.g., exposed electrical line, pipeline burst flooding avenues, deep pothole on fast arterial road).
- **High (60–79):** Major disruption to community health or transit (e.g., streetlights dark at school crossing, uncollected waste near clinic).
- **Medium (40–59):** Routine maintenance defects (e.g., standard potholes, localized refuse).
- **Low (1–39):** Minor non-hazardous issues (e.g., minor aesthetic wear).

> **Advisory Label:** Every screen prominently displays:  
> *"AI Priority Score — Advisory — human review required."*

---

## 8. Local Setup & Development

### Prerequisites
- Node.js 20+
- Google Cloud Project with Cloud Firestore enabled
- Gemini API Key

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/civiclens-ai.git
cd civiclens-ai

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY

# Start Vite dev server on port 3000
npm run dev
```

### Production Build & Launch
```bash
# Build frontend bundle
npm run build

# Start full-stack Cloud Run server
npm run start
```

---

## 9. Cloud Run Deployment

1. **Build container image:**
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT-ID]/civiclens-ai
   ```
2. **Deploy to Google Cloud Run:**
   ```bash
   gcloud run deploy civiclens-ai \
     --image gcr.io/[PROJECT-ID]/civiclens-ai \
     --platform managed \
     --region asia-southeast1 \
     --allow-unauthenticated \
     --set-env-vars dev-tutorial=cloud-run-ai-challenge \
     --set-secrets GEMINI_API_KEY=gemini-api-key:latest
   ```

---

## 10. 2-Minute Demonstration Flow

1. **Launch App:** Open the CivicLens AI portal.
2. **Seed Demo Scenarios:** Click **"Demo Data"** in the top navigation bar and select **"Seed 5 Scenarios"** to load realistic pre-seeded issues spanning past months.
3. **Switch to Officer Persona:** Use the **Persona Switcher** in the top-right to select **"Civic Officer"**.
4. **Inspect Dashboard:** View the KPI overview (Open, In Progress, Resolved, High Priority) and the Priority Queue.
5. **Test Historical Search:**
   - Click **"Historical Search"**.
   - Select Date Range: `2025-09-01` to `2025-09-30`.
   - Filter by Category: `Infrastructure`.
   - Observe instantaneous dynamic aggregation metrics and matching historical reports.
6. **Civic Trend Lens:** Open **"Civic Trend Lens"** and click **"Generate AI Trend Summary"** to review Gemini's strategic patterns.
7. **Resolution Playbook:** Click any issue to open the detail modal, click **"Generate Playbook"**, and copy the Citizen Transparency Notice.
8. **Update Status:** Change status from `Open` to `In Progress` and verify the audit trail update.

---

## 11. Limitations & Future Scope

### Limitations
- AI output is strictly advisory; physical verification by human municipal staff is mandatory.
- The MVP prototype does not integrate emergency 911 dispatch systems.
- No automated legal liability decisions are performed.

### Future Scope
- Geospatial GIS heatmap overlays and municipal ward boundary layers.
- Automated duplicate clustering via vector embeddings.
- Voice-first multilingual reporting for regional languages.
- Integration with municipal ERP and Open Government Data portals.
