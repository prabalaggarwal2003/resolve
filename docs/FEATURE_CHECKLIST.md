# Feature Checklist — Implemented vs Pending

## ✅ Implemented

| Feature | Status | Notes |
|--------|--------|--------|
| **User auth** | Done | Login, register, JWT, org signup flow |
| **Roles** | Done | Super Admin, Principal, HOD, Teacher, Student, Lab Technician (+ Admin/Manager/Reporter legacy) |
| **Users & Roles** | Done | Super admin adds users by school/college email; assign role, department (HOD), labs (lab tech); principal view-only |
| **Add/edit assets** | Done | POST, PATCH with name, type/category, serial, purchase date, location, vendor, assigned user |
| **Asset status** | Done | Available, In Use, Under Maintenance, Retired (+ legacy statuses supported) |
| **Delete assets** | Done | DELETE /api/assets/:id |
| **Image & document** | Done | photos[], documents[] (URLs); report form has photo upload (base64) |
| **QR auto-generate** | Done | On create/update asset |
| **Scan QR → asset details** | Done | /a/[id] public page |
| **Scan QR → Report Issue** | Done | /report?assetId=&assetName= with pre-filled asset |
| **Report form** | Done | Issue type, photo, description; auto-fill asset; grouped similar issues |
| **Assign/unassign assets** | Done | assignedTo (user) on Asset; PATCH to assign; usage log on assign/unassign |
| **Search & filter** | Done | Search by ID, name, serial, user, location; filter status, category, department; sort |
| **Dashboard** | Done | Summary cards; latest 10 issues; role-based: Reporter (My Assets, My Reports), Manager (Pending, by status) |
| **Color-coded cards** | Done | 🟢 Available, 🟡 Maintenance, 🔴 Faulty/Retired on assets |
| **Audit trail** | Done | Log asset/issue create, update, delete (who, when, what) |
| **Notifications** | Done | In-app list (report submitted/updated/resolved); mark read |

| **Locations** | Done | CRUD API + dashboard UI; campus/building/floor/room; assign location on assets |
| **Reports export** | Done | CSV export for assets and issues from dashboard Reports page |

## 🔶 Partially / Optional

| Feature | Status | Notes |
|--------|--------|--------|
| **Usage logs (check-in/out)** | Done | AssetLog entries on assign/unassign; view on asset |
| **Email notifications** | Stub | Model ready; send email on report/status (add SMTP later) |
| **Lifecycle labels** | Done | Status covers Registered→Assigned→…→Retired |

## 📋 Role Mapping

- **Admin**: Full access (assets, issues, users, locations, reports).
- **Manager**: Same as admin for assets/issues; sees "Pending Reports", "Assets by Status", "Recently Updated".
- **Reporter**: Sees "My Assets", "Report an Issue", "My Reports"; can report and view own.
