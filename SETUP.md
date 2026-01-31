# Resolve — Step-by-Step Setup Guide

Follow these steps in order to get the backend, database, and frontend running.

---

## Prerequisites (install once)

### 1. Node.js

You need **Node.js 18 or newer** (LTS recommended).

- **Check if already installed:**  
  Open a terminal and run:
  ```bash
  node -v
  ```
  You should see something like `v20.x.x` or `v18.x.x`.

- **If not installed:**  
  - **macOS / Windows:** Download the LTS version from [nodejs.org](https://nodejs.org/) and run the installer.  
  - **macOS (Homebrew):** `brew install node`

### 2. MongoDB

You need a running **MongoDB** database. Choose one option below.

#### Option A: MongoDB Atlas (cloud, no local install)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Sign up or log in.
3. Create a **free cluster** (e.g. M0).
4. In the cluster, click **Connect** → **Connect your application**.
5. Copy the connection string. It looks like:
   ```text
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `USERNAME` and `PASSWORD` with your database user.  
   (Create a DB user under **Database Access** if you haven’t.)
7. Optional: add your DB name in the string, e.g. before `?`:
   ```text
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/resolve?retryWrites=true&w=majority
   ```
   You’ll use this full string as `MONGODB_URI` in the backend.

#### Option B: MongoDB locally

1. **Install MongoDB Community:**  
   - **macOS (Homebrew):** `brew tap mongodb/brew` then `brew install mongodb-community`  
   - **Windows:** Use the [MongoDB Community Server installer](https://www.mongodb.com/try/download/community).  
   - **Linux:** Follow [Install MongoDB Community](https://www.mongodb.com/docs/manual/administration/install-on-linux/) for your distro.

2. **Start MongoDB:**  
   - **macOS (Homebrew):** `brew services start mongodb-community`  
   - **Windows:** Run MongoDB as a service (default after install).  
   - **Linux:** e.g. `sudo systemctl start mongod`

3. **Connection string:**  
   Use:
   ```text
   mongodb://localhost:27017/resolve
   ```
   You’ll set this as `MONGODB_URI` in the backend.

---

## Backend setup

All commands below are run in a terminal.

### Step 1: Go to the backend folder

```bash
cd /Users/prabalaggarwal/resolve/backend
```

(Or your actual path to the `resolve` project if different.)

### Step 2: Create the environment file

```bash
cp .env.example .env
```

Then open `.env` in an editor and set at least:

- **MONGODB_URI**  
  - Atlas: paste your full connection string (with username, password, and optional `resolve` database name).  
  - Local: `mongodb://localhost:27017/resolve`

- **JWT_SECRET**  
  Any long random string (e.g. 32+ characters). For production, use a proper secret.

Example `.env` (local MongoDB):

```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/resolve
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

Save the file.

### Step 3: Install backend dependencies

```bash
npm install
```

### Step 4: Start the backend

```bash
npm run dev
```

You should see:

- `MongoDB connected: ...`
- `Server running on http://localhost:4000`

Leave this terminal open. The API will run here.

**Quick check:** In another terminal:

```bash
curl http://localhost:4000/api/health
```

You should get JSON with `"status":"ok"` and `"mongo":"connected"`.

---

## Frontend setup

Use a **new** terminal (keep the backend running in the first one).

### Step 1: Go to the frontend folder

```bash
cd /Users/prabalaggarwal/resolve/frontend
```

### Step 2: Create the environment file (optional)

The app works without this if the frontend and backend run on the same machine and you use the Next.js proxy.

To set the API URL explicitly (e.g. for a different host/port):

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and set:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

If you skip this, the frontend will call `/api/...`, which Next.js rewrites to `http://localhost:4000/api/...` (see `next.config.js`).

### Step 3: Install frontend dependencies

```bash
npm install
```

This installs Next.js, React, Tailwind, etc.

### Step 4: Start the frontend

```bash
npm run dev
```

You should see something like:

- `▲ Next.js 14.x.x`
- `- Local: http://localhost:3000`

Leave this terminal open.

---

## Create your first user

1. Open a browser and go to: **http://localhost:3000**
2. Click **Create account**.
3. Fill in:
   - **Name:** e.g. Admin
   - **Email:** e.g. admin@school.edu
   - **Password:** at least 6 characters
   - **Role:** Admin (for full access)
4. Click **Create account**.

You should be redirected to the dashboard. If you see the dashboard and can open **Assets**, the full stack is working.

---

## Summary checklist

| Step | What | Command / action |
|------|------|-------------------|
| 1 | Node.js 18+ | `node -v` — install from nodejs.org if needed |
| 2 | MongoDB | Atlas account or local install + start service |
| 3 | Backend env | `cd backend` → `cp .env.example .env` → set `MONGODB_URI` and `JWT_SECRET` |
| 4 | Backend deps | In `backend`: `npm install` |
| 5 | Backend run | In `backend`: `npm run dev` (keep running) |
| 6 | Frontend env | In `frontend`: optional `cp .env.local.example .env.local` and set `NEXT_PUBLIC_API_URL` |
| 7 | Frontend deps | In `frontend`: `npm install` |
| 8 | Frontend run | In `frontend`: `npm run dev` (keep running) |
| 9 | First user | Browser → http://localhost:3000 → Create account → Sign in |

---

## Troubleshooting

- **Backend: "MongoDB connection error"**  
  - Atlas: Check username/password and that your IP is allowed (or use `0.0.0.0/0` for testing).  
  - Local: Ensure MongoDB is running (`brew services list` or `sudo systemctl status mongod`).

- **Frontend: "Failed to load" or login/register fails**  
  - Backend must be running on port 4000.  
  - If you use `NEXT_PUBLIC_API_URL`, it must be `http://localhost:4000` when both run on the same machine.

- **Port already in use**  
  - Backend: Change `PORT` in `backend/.env` (e.g. 4001). Then set `NEXT_PUBLIC_API_URL=http://localhost:4001` in `frontend/.env.local`.  
  - Frontend: Run `npm run dev -- -p 3001` to use port 3001.

- **"Not signed in" on dashboard**  
  - Create an account via **Create account** or register via API, then sign in. The app stores the token in `localStorage`.

---

## What you have when it works

- **Backend:** Node + Express API at **http://localhost:4000** (auth, assets, health).
- **Frontend:** Next.js + Tailwind at **http://localhost:3000** (landing, login, register, dashboard, assets).
- **Database:** MongoDB (Atlas or local) with collections created when you register and add assets.

You can now add assets from **Dashboard → Assets → Add asset** and open asset details from the list.
