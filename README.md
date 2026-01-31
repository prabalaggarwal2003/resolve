# Resolve — Asset Management for Schools & Colleges

Asset management system built **first for schools and colleges**, with plans to support offices, factories, and public transport. Features include QR-based asset profiles, 1-tap issue reporting, auto-assignment, dashboards, duplicate prevention, and more.

**Stack:** Next.js frontend · Node + Express backend · MongoDB

---

## Project structure

```
resolve/
├── backend/          # Node + Express + MongoDB API
├── frontend/         # Next.js (App Router) UI
├── docs/             # School/college focus & extension notes
├── ASSET_MANAGEMENT_ARCHITECTURE.md   # Full 18-feature blueprint
└── README.md
```

---

## Quick start

### 1. MongoDB

- Install [MongoDB](https://www.mongodb.com/try/download/community) locally, or
- Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and copy the connection string.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

API runs at **http://localhost:4000**. Health check: `GET http://localhost:4000/api/health`.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Optional: set NEXT_PUBLIC_API_URL=http://localhost:4000 (default for dev)
npm install
npm run dev
```

App runs at **http://localhost:3000**.

### 4. First user

Use the **Register** flow (add a route if needed) or create a user via API:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"yourpassword","name":"Admin","role":"admin"}'
```

Then sign in at **http://localhost:3000/login** and open the Dashboard → Assets to add your first asset.

---

## School/college focus

- **Locations:** Campus → Building → Floor → Room (classrooms, labs, office).
- **Departments:** Administration, Science, Computer Lab, Library, etc.
- **Asset categories:** Projector, Whiteboard, Desktop, AC, Furniture, Lab Equipment, Printer.
- **Roles:** Admin, Staff, Technician.

See **docs/SCHOOL_COLLEGE_FIRST.md** for terminology and how to extend to offices/factories/transport later.

---

## Implemented so far

- **Backend:** Express server, MongoDB connection, Auth (register/login/JWT), User/Location/Department/Asset/Issue models, Asset CRUD and list with filters, role middleware.
- **Frontend:** Home, Login, Dashboard layout with sidebar, Dashboard summary placeholders, Assets list + Add asset + Asset detail page, placeholder pages for Issues, Locations, Reports.

---

## Roadmap (from ASSET_MANAGEMENT_ARCHITECTURE.md)

1. Locations CRUD & tree UI  
2. QR generation per asset + short URL `/a/[shortId]`  
3. Issue creation with duplicate check & auto-assign  
4. Issue dashboard (open / in progress / completed)  
5. Notifications & reminders (cron)  
6. Asset timeline (issues + maintenance)  
7. Reports (PDF/CSV) + bulk QR ZIP  
8. Audit log middleware + admin UI  
9. Mobile scan page (camera) + PWA  
10. Offline-first reporting queue (optional)

---

## License

Private / your choice.
