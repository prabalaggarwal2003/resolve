# Asset Management System — Technical Architecture Breakdown

A complete blueprint for building the 18-feature asset management system with **Frontend**, **Backend**, and **MongoDB**.

---

## 1. Tech Stack Overview

| Layer | Recommendation | Why |
|-------|----------------|-----|
| **Frontend** | Next.js 14+ (App Router) + React Native / PWA | Next.js for web dashboard; PWA or React Native for mobile-first, scan-optimized UX |
| **Backend** | Node.js + Express (or Next.js API Routes) | Fast, JS everywhere, great MongoDB drivers |
| **Database** | MongoDB Atlas | Flexible schema, good for assets + nested locations, full-text search |
| **QR** | `qrcode` (node), `html5-qrcode` or ZXing (frontend scan) | Reliable QR gen + scan |
| **Auth** | NextAuth.js or JWT + bcrypt | Role-based access (Admin, Staff, Technician) |
| **File Storage** | AWS S3 / Cloudinary / MongoDB GridFS | Photos, documents, PDFs |
| **Notifications** | Node-cron + Nodemailer / SendGrid / FCM | Reminders, daily digest |
| **Reports** | pdfkit / puppeteer (PDF), csv-stringify (CSV) | Downloadable reports |

---

## 2. MongoDB Schema Design

### 2.1 Core Collections

#### **users**
```javascript
{
  _id: ObjectId,
  email: String,           // unique, indexed
  passwordHash: String,
  name: String,
  role: String,            // "admin" | "staff" | "technician" — indexed
  departmentId: ObjectId,  // ref: departments
  phone: String,
  avatar: String,          // URL
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: email (unique), role, departmentId
```

#### **departments**
```javascript
{
  _id: ObjectId,
  name: String,
  locationId: ObjectId,    // ref: locations
  createdAt: Date,
  updatedAt: Date
}
```

#### **locations** (hierarchical: Building → Floor → Room)
```javascript
{
  _id: ObjectId,
  name: String,            // "Building A", "Floor 2", "Room 301"
  type: String,            // "building" | "floor" | "room"
  parentId: ObjectId,      // null for root (building), self-ref for hierarchy
  path: String,            // "Building A/Floor 2/Room 301" — for quick filter
  createdAt: Date,
  updatedAt: Date
}
// Indexes: parentId, path (text index for search)
```

#### **assets**
```javascript
{
  _id: ObjectId,
  assetId: String,         // human-readable unique code, e.g. AST-001 — unique index
  name: String,
  model: String,
  category: String,        // "Laptop", "AC", "Printer" — indexed
  serialNumber: String,    // indexed for duplicate detection
  locationId: ObjectId,
  departmentId: ObjectId,
  status: String,          // "working" | "under_maintenance" | "needs_repair" | "out_of_service" — indexed
  purchaseDate: Date,
  vendor: String,
  cost: Number,
  warrantyExpiry: Date,
  amcExpiry: Date,
  nextMaintenanceDate: Date,
  photos: [{ url: String, caption: String, uploadedAt: Date }],
  documents: [{ url: String, name: String, type: String, uploadedAt: Date }],
  qrCodeUrl: String,       // stored QR image URL or data URL
  customFields: {},        // flexible key-value for future
  createdBy: ObjectId,
  updatedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: assetId (unique), serialNumber, category, locationId, status,
// compound: { name: 1, locationId: 1 }, { model: 1, vendor: 1, purchaseDate: 1 } for duplicate detection
```

#### **issues** (tickets)
```javascript
{
  _id: ObjectId,
  ticketId: String,        // e.g. ISS-2024-001 — unique, indexed
  assetId: ObjectId,
  reportedBy: ObjectId,
  title: String,
  description: String,
  category: String,        // "repair", "maintenance", "complaint"
  status: String,          // "open" | "in_progress" | "completed" | "cancelled" — indexed
  priority: String,        // "low" | "medium" | "high"
  photos: [{ url: String, uploadedAt: Date }],
  assignedTo: ObjectId,    // technician
  assignedAt: Date,
  locationId: ObjectId,    // denormalized for quick filter
  mergedFrom: [ObjectId],  // if this ticket was created by merging duplicates
  resolvedAt: Date,
  resolvedBy: ObjectId,
  resolutionNotes: String,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: ticketId (unique), assetId, status, assignedTo, createdAt
// Compound unique: { assetId: 1, status: 1 } where status === "open" — for duplicate blocking (application-level)
```

#### **maintenance_logs**
```javascript
{
  _id: ObjectId,
  assetId: ObjectId,
  type: String,            // "scheduled" | "repair" | "inspection"
  performedBy: ObjectId,
  performedAt: Date,
  nextDueDate: Date,
  cost: Number,
  notes: String,
  photos: [{ url: String }],
  issueId: ObjectId,       // optional link to issue
  createdAt: Date,
  updatedAt: Date
}
// Indexes: assetId, performedAt, nextDueDate
```

#### **notifications**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: String,            // "warranty_expiry", "maintenance_due", "issue_assigned", "daily_digest"
  title: String,
  body: String,
  link: String,            // deep link or URL
  read: Boolean,
  metadata: {},            // assetId, issueId, etc.
  createdAt: Date
}
// Indexes: userId, read, createdAt
```

#### **audit_logs**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  action: String,          // "asset.created", "asset.updated", "issue.closed", "scan"
  resource: String,        // "asset", "issue", "user"
  resourceId: ObjectId,
  details: {},             // old/new values, scan payload
  ip: String,
  userAgent: String,
  createdAt: Date
}
// Indexes: userId, resource, resourceId, createdAt (TTL optional for retention)
```

#### **duplicate_report_blocks** (for feature #5)
```javascript
{
  _id: ObjectId,
  assetId: ObjectId,
  issueSignature: String, // hash of (assetId + title/category) to detect same issue
  openIssueId: ObjectId,
  reportedBy: [ObjectId],
  createdAt: Date
}
// Index: { assetId: 1, issueSignature: 1 } unique — block duplicate open issues
```

---

## 3. Backend API Structure

### 3.1 Folder Layout (Node + Express)

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   ├── models/          # Mongoose schemas (users, assets, issues, etc.)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── assets.js
│   │   ├── issues.js
│   │   ├── locations.js
│   │   ├── departments.js
│   │   ├── maintenance.js
│   │   ├── notifications.js
│   │   ├── reports.js
│   │   └── audit.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── roles.js
│   │   └── audit.js
│   ├── services/
│   │   ├── qrService.js
│   │   ├── duplicateDetection.js
│   │   ├── notificationService.js
│   │   ├── reminderCron.js
│   │   ├── reportPdfService.js
│   │   └── bulkQrZipService.js
│   ├── utils/
│   │   ├── duplicateAssetCheck.js
│   │   └── validators.js
│   └── app.js
├── package.json
└── .env
```

### 3.2 API Endpoints by Feature

| Feature | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| **#1 QR Asset Profile** | GET | `/api/assets/:id` | Asset details for QR landing page |
| | GET | `/api/assets/:id/qr` | Generate/return QR image or redirect URL |
| **#2 Issue reporting** | POST | `/api/issues` | Create issue (with photo URLs); duplicate check inside |
| | POST | `/api/issues/upload-photo` | Upload photo, return URL |
| **#3 Auto-assign** | (internal) | — | In `issues` service: assign by category + location + past assignments |
| **#4 Dashboard** | GET | `/api/issues?status=open` | List issues with filters (status, assignedTo) |
| | GET | `/api/dashboard/summary` | Counts: open, in-progress, completed |
| **#5 Duplicate control** | POST | `/api/issues` | Before create: check duplicate (same asset + open same type) → merge or block |
| **#6 Asset inventory** | GET | `/api/assets` | List with category, location, status filters |
| | POST | `/api/assets` | Add asset (+ duplicate detection) |
| | PATCH | `/api/assets/:id` | Edit asset |
| **#7 Reminders** | (cron) | — | `reminderCron.js`: warranty, AMC, maintenance, stale issues |
| **#8 Daily digest** | (cron) | — | Same cron or separate: build digest, send email/push |
| **#9 Asset timeline** | GET | `/api/assets/:id/timeline` | Issues + maintenance logs + audit for asset |
| **#10 Bulk QR** | GET | `/api/assets/qr-bulk?category=&location=` | Generate ZIP of QR PDFs |
| **#11 Roles** | middleware | `roles.js` | Protect routes: admin only, staff, technician |
| **#12 Duplicate asset** | POST | `/api/assets` | In handler: check serialNumber, name+location, model+vendor+date |
| **#13 Mobile/scan** | GET | `/a/:shortId` | Short redirect URL for QR → full asset page (PWA) |
| **#14 Photo issue** | POST | `/api/issues` | `photos[]` required or optional in schema |
| **#15 Asset status** | PATCH | `/api/assets/:id` | Update `status` field |
| **#16 Reports** | GET | `/api/reports/assets?format=pdf|csv` | All assets export |
| | GET | `/api/reports/issues?format=pdf|csv` | All issues export |
| | GET | `/api/reports/maintenance?format=pdf|csv` | Maintenance history |
| **#17 Location mapping** | GET | `/api/locations` | Tree or flat with parentId |
| | POST | `/api/locations` | Create building/floor/room |
| **#18 Audit log** | GET | `/api/audit?resource=asset&resourceId=` | List logs (admin) |
| | (middleware) | — | On create/update/delete: write to audit_logs |

---

## 4. Frontend Structure

### 4.1 App Types

- **Web app (Next.js)**  
  - Dashboard (issues, assets, reports, settings).  
  - Asset inventory (add/edit/categorize).  
  - Location/department management.  
  - Role-based menus and routes.

- **Mobile-first / PWA**  
  - Start from QR scan → asset profile.  
  - 1-tap issue reporting (camera, category, submit).  
  - Offline queue: store pending issues in IndexedDB, sync when online (optional).

### 4.2 Next.js App Router Layout

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # sidebar, role-based nav
│   │   ├── page.tsx            # dashboard home (open issues, summary)
│   │   ├── assets/
│   │   │   ├── page.tsx        # list + filters
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx   # detail + timeline + QR
│   │   ├── issues/
│   │   │   ├── page.tsx        # list, status filters, assignee
│   │   │   └── [id]/page.tsx
│   │   ├── locations/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── settings/
│   ├── a/[shortId]/page.tsx    # QR short URL → redirect to asset (mobile-friendly)
│   ├── scan/
│   │   └── page.tsx            # camera scan → parse QR → asset or report issue
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── assets/
│   │   ├── AssetCard.tsx
│   │   ├── AssetForm.tsx
│   │   ├── AssetStatusBadge.tsx
│   │   └── AssetTimeline.tsx
│   ├── issues/
│   │   ├── IssueForm.tsx
│   │   ├── IssueList.tsx
│   │   └── IssueStatusFilter.tsx
│   ├── qr/
│   │   ├── QRScanner.tsx       # html5-qrcode or ZXing
│   │   └── QRDisplay.tsx
│   └── reports/
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   └── offlineQueue.ts        # optional IndexedDB queue
└── public/
```

### 4.3 Feature → Frontend Mapping

| Feature | Where it lives |
|---------|----------------|
| **#1 QR asset profile** | `/a/[shortId]` and `/assets/[id]` — responsive, show details, purchase, warranty/AMC, photos, docs |
| **#2 1-tap issue** | `/scan` → after scan, modal or page: category, photo, submit; or `/assets/[id]/report` |
| **#4 Dashboard** | `(dashboard)/page.tsx`: open issues, assigned to whom, pending/in-progress/done |
| **#6 Inventory** | `assets/page.tsx` (list), `assets/new`, `assets/[id]` (edit) |
| **#9 Timeline** | `AssetTimeline.tsx` on asset detail page |
| **#10 Bulk QR** | Reports or Assets section: “Download QR pack” → calls API → download ZIP |
| **#13 Mobile/scan** | PWA manifest, fast camera in `/scan`, large tap targets, optional offline queue |
| **#14 Photo issue** | Issue form: camera or file upload, mandatory/optional per config |
| **#15 Status** | `AssetStatusBadge` + edit form dropdown (Working, Under Maintenance, etc.) |
| **#16 Reports** | Reports page: buttons “Export assets PDF/CSV”, “Export issues”, “Maintenance history” |
| **#17 Location** | Location tree (building → floor → room) in settings/assets; asset form: location + department |
| **#11 Roles** | Hide/disable menu items and actions by role (admin/staff/technician) |

---

## 5. Feature-by-Feature Implementation Notes

### #1 QR-based asset profiles
- **Backend:** GET `/api/assets/:id` (or `/api/a/:shortId` if using short codes). Generate QR payload: `https://yourapp.com/a/{shortId}` or `https://yourapp.com/assets/{id}`.
- **QR generation:** On asset create/update, generate QR image (e.g. `qrcode` in Node), upload to S3/Cloudinary, save `qrCodeUrl` in asset.
- **Frontend:** `/a/[shortId]` resolves shortId → assetId, then show asset detail page (name, model, category, purchase, warranty/AMC, photos, documents).

### #2 1-tap issue reporting
- **Frontend:** Scan QR → open “Report issue” with asset pre-filled. Fields: category, description, photo(s). Submit → POST `/api/issues` with `assetId`, `photos[]`.
- **Backend:** Validate asset exists, check duplicate (same asset + open issue of same type) → merge or return existing ticket; else create issue, run auto-assign, send notification.

### #3 Auto-assign
- **Backend service:** After creating issue, query technicians by: (1) same department/location as asset, (2) same category experience (from past assignments). Assign and set `assignedTo`, `assignedAt`, create notification.

### #4 Issue tracking dashboard
- **Backend:** GET `/api/issues` with query params `status`, `assignedTo`, date range. GET `/api/dashboard/summary` returns counts by status.
- **Frontend:** Table/cards of issues with status badges, assignee name, “Pending / In progress / Completed” tabs or filters.

### #5 Duplicate reporting control
- **Backend:** On POST `/api/issues`, compute “signature” (e.g. `assetId + category` or normalized title). If exists in `duplicate_report_blocks` or an open issue with same signature → return 409 with existing issue id or merge new report into that issue (add to `mergedFrom`, optional comment). Otherwise create new issue and optionally insert into duplicate block for open state.

### #6 Asset inventory
- **Backend:** CRUD `/api/assets` with filters (category, location, status). List supports pagination and search.
- **Frontend:** Simple table or cards, “Add asset” form (name, model, category, location, department, purchase info, warranty/AMC, status). Edit from detail page.

### #7 Automated reminders
- **Backend:** Cron (e.g. daily): find assets with `warrantyExpiry` / `amcExpiry` / `nextMaintenanceDate` in next N days; find issues `status: open` older than X days. Create `notifications` and send email/push (FCM). Same for “technician assigned” on issue create.

### #8 Daily snapshot
- **Backend:** Cron (e.g. 8 AM): aggregate new issues (last 24h), open issues, assets needing attention (due maintenance, expiring warranty). Build digest (HTML/text), send to admins or configurable list.

### #9 Asset timeline
- **Backend:** GET `/api/assets/:id/timeline`: aggregate issues (for this asset), maintenance_logs, and audit_logs for this asset; sort by date.
- **Frontend:** Vertical timeline component (date, type, title, notes, photos).

### #10 Bulk QR download
- **Backend:** GET `/api/assets/qr-bulk?category=&location=` → generate QR PDFs per asset (e.g. pdfkit), group by category/location, zip (archiver), return ZIP stream.
- **Frontend:** Button “Download QR pack”, optional filters → trigger download.

### #11 Role-based access
- **Backend:** Middleware: decode JWT, attach `user.role`. Another middleware `requireRole(['admin'])` or `requireRole(['admin','staff'])`. Apply on routes (e.g. delete asset, audit log, user management = admin only).
- **Frontend:** Conditional menu and buttons based on `user.role`.

### #12 Smart duplicate asset detection
- **Backend:** On POST `/api/assets`, before insert: (1) find by `serialNumber`, (2) find by `name` + `locationId`, (3) find by `model` + `vendor` + `purchaseDate`. If any match, return 409 with “Possible duplicate” and matched asset id(s). Let user confirm or edit.

### #13 Mobile-first, scan-optimized
- **Frontend:** PWA with manifest, “Add to home screen”. `/scan` page: request camera, use `html5-qrcode` or ZXing; on success redirect to `/a/[shortId]` or `/assets/[id]`. Large buttons, minimal layout for report flow. Optional: Service Worker + IndexedDB to queue POST `/api/issues` when offline and sync when online.

### #14 Photo-based issue logging
- **Backend:** Accept `photos[]` (URLs from pre-signed upload or multipart). Store in issue document. Optional: make at least one photo required in validation.
- **Frontend:** Camera or file picker in issue form, preview thumbnails, upload to storage first then pass URLs in payload.

### #15 Asset status indicators
- **Backend:** `status` enum on asset. PATCH to update.
- **Frontend:** Badge component (Working=green, Under Maintenance=orange, Needs Repair=red, Out of Service=gray). Show on list and detail.

### #16 Downloadable reports
- **Backend:** `/api/reports/assets`, `/issues`, `/maintenance`: query data, stream PDF (pdfkit) or CSV (csv-stringify). Set `Content-Disposition: attachment`.
- **Frontend:** Buttons “Export PDF” / “Export CSV” per report type.

### #17 Location/department mapping
- **Backend:** Locations as tree (parentId). Departments reference locationId. Assets have `locationId` and `departmentId`. APIs: CRUD locations, CRUD departments, GET tree for dropdowns.
- **Frontend:** Hierarchical selector (Building → Floor → Room). Department dropdown filtered by location if needed.

### #18 Audit log
- **Backend:** Middleware or service: on create/update/delete of asset, issue, user — write to `audit_logs` (userId, action, resource, resourceId, details, timestamp). GET `/api/audit` for admins with filters.
- **Frontend:** Audit log page (admin only): table with filters by resource and date.

---

## 6. Implementation Order (Suggested)

1. **Foundation:** MongoDB + Backend (Express) + Auth + Roles.  
2. **Core data:** Locations, Departments, Assets (CRUD + duplicate detection).  
3. **QR:** Generate QR per asset, short URL redirect, asset profile page.  
4. **Issues:** Create issue, duplicate check, auto-assign, dashboard.  
5. **Frontend dashboard:** Issues list, asset list, asset detail + timeline.  
6. **Scan flow:** Mobile scan → asset / report issue.  
7. **Maintenance logs + timeline.**  
8. **Notifications + reminders + daily digest (cron).**  
9. **Reports (PDF/CSV) + bulk QR ZIP.**  
10. **Audit log middleware + UI.**  
11. **PWA + offline queue (optional).**

---

## 7. Quick Reference: Where Each Feature Is Implemented

| # | Feature | MongoDB | Backend | Frontend |
|---|---------|---------|---------|----------|
| 1 | QR asset profiles | assets.qrCodeUrl, shortUrl collection (optional) | GET asset, QR gen service | /a/[shortId], asset detail page |
| 2 | 1-tap issue | issues | POST issues, duplicate check | Scan → report form |
| 3 | Auto-assign | issues.assignedTo | Assignment service | — |
| 4 | Issue dashboard | issues | GET issues, dashboard summary | Dashboard page, filters |
| 5 | Duplicate reporting | duplicate_report_blocks, issues | POST issues logic | — |
| 6 | Asset inventory | assets | CRUD assets | Assets list, add/edit |
| 7 | Reminders | notifications, cron | reminderCron, notificationService | Notification list/bell |
| 8 | Daily digest | aggregation | Cron + email | — |
| 9 | Asset timeline | issues, maintenance_logs, audit_logs | GET timeline | AssetTimeline component |
| 10 | Bulk QR ZIP | assets | qr-bulk endpoint, zip | Reports / Assets → Download |
| 11 | Roles | users.role | role middleware | Role-based UI |
| 12 | Duplicate asset | assets | POST assets check | 409 + “Possible duplicate” |
| 13 | Mobile/scan UI | — | Short URL redirect | PWA, /scan, fast camera |
| 14 | Photo issue | issues.photos | Upload + POST | Camera/upload in form |
| 15 | Status indicators | assets.status | PATCH asset | Status badges |
| 16 | Reports PDF/CSV | all | reports routes | Export buttons |
| 17 | Location/department | locations, departments | CRUD, tree API | Tree selector, asset form |
| 18 | Audit log | audit_logs | Middleware + GET audit | Admin audit page |

---

You can use this document as the single source of truth for building the system: start with DB models and auth, then assets and QR, then issues and dashboard, then the rest in the order above.
