# MongoDB Setup & QR Code Testing

## MongoDB clusters and collections

- **Cluster:** Create one cluster in [MongoDB Atlas](https://cloud.mongodb.com) (e.g. M0 free). Name it anything (e.g. **Cluster0** or **Resolve**).
- **Database:** Your app uses the database name from the connection string. If you use `mongodb+srv://...@cluster.xxx.mongodb.net/resolve`, the database is **resolve**.
- **Collections:** Mongoose creates them when you first insert data:
  - **users** — signup / login
  - **organizations** — org profile from signup
  - **otps** — email verification (TTL index auto-deletes expired)
  - **assets** — asset records and QR data
  - **locations**, **departments**, **issues** — when you use those features

Indexes are created automatically when the backend starts (Mongoose `ensureIndexes`). No manual index creation is required.

### Connection string

In **backend/.env** set:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.xxx.mongodb.net/resolve?retryWrites=true&w=majority
```

Replace `USER`, `PASSWORD`, and the cluster host. Add `/resolve` before `?` to use the **resolve** database.

---

## QR codes for assets

- When you **add** or **edit** an asset, the backend generates a QR code that encodes a URL pointing to the asset’s public page.
- The QR is stored as a data URL in `asset.qrCodeUrl` and shown on the asset detail page in the dashboard.
- Scanning the QR opens: **`{FRONTEND_URL}/a/{assetId}`** (e.g. `http://localhost:3000/a/674abc123...`).

### Testing QR scan from your phone

Your phone must be able to open the URL inside the QR. If the QR points to `http://localhost:3000`, the phone will not reach it (localhost is the phone itself).

**Option 1 — Same Wi‑Fi (LAN IP)**  
1. Find your computer’s local IP (e.g. `192.168.1.5`).  
   - Mac: System Settings → Network → Wi‑Fi → Details → IP Address.  
   - Or run: `ipconfig getifaddr en0` (Mac).  
2. In **backend/.env** set:
   ```env
   FRONTEND_URL=http://192.168.1.5:3000
   ```
   (Use your actual IP and the port where the Next.js app runs.)  
3. Restart the backend so new/updated assets get QR codes with this URL.  
4. Ensure your phone is on the same Wi‑Fi.  
5. Add or edit an asset so a new QR is generated, then scan that QR with your phone’s camera.

**Option 2 — ngrok (public URL)**  
1. Install [ngrok](https://ngrok.com) and run:
   ```bash
   ngrok http 3000
   ```
2. Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`).  
3. In **backend/.env** set:
   ```env
   FRONTEND_URL=https://abc123.ngrok.io
   ```
4. Restart the backend, add or edit an asset, then scan the new QR from your phone.

**Option 3 — Deployed app**  
If the frontend is deployed (e.g. Vercel), set:

```env
FRONTEND_URL=https://your-app.vercel.app
```

Restart the backend; new/updated assets will have QR codes that open the deployed app.

### Summary

| Step | Action |
|------|--------|
| 1 | Set `FRONTEND_URL` in backend `.env` to a URL your phone can open (LAN IP, ngrok, or deployed URL). |
| 2 | Restart the backend. |
| 3 | Add a new asset or edit an existing one (QR is generated on create/update). |
| 4 | Open the asset in the dashboard and use the QR image shown there, or print it. |
| 5 | Scan the QR with your phone camera; it should open the asset’s public page (`/a/{id}`). |

If an asset has no QR yet (e.g. created before this feature), opening that asset in the dashboard triggers QR generation once and it will appear on the page.
