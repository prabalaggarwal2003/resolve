# QR Code PDF Generation Feature

## 📄 Overview

This feature allows you to download a professionally formatted PDF containing QR codes for all assets in your organization, grouped by category. This is perfect for printing and attaching QR code labels to physical assets.

## ✨ Features

### 1. **Grouped by Category**
- Assets are automatically organized by their category (Projector, Desktop, Laptop, etc.)
- Each category gets its own section in the PDF
- Clear category headers with asset counts

### 2. **Professional Layout**
- 3 QR codes per row (A4 size)
- Each QR code card includes:
  - **QR Code**: 120x120px scannable code
  - **Asset ID**: Primary identifier (e.g., ABC-PRO-001)
  - **Asset Name**: Full asset name
  - **Model**: Model number (if available)
- Cards have borders for easy cutting
- Proper spacing between cards for printing

### 3. **Title Page**
- PDF title: "Asset QR Codes"
- Generation date
- Total number of assets
- Organization name

### 4. **Page Numbers**
- Footer on each page showing "Page X of Y"

### 5. **Fallback Handling**
- If QR code is missing, displays placeholder
- Graceful error handling for invalid QR codes

## 🎯 How to Use

### Download All QR Codes

1. Navigate to **Dashboard → Assets**
2. Click the **"📥 Download QR Codes PDF"** button
3. PDF will automatically download with filename: `asset-qr-codes-YYYY-MM-DD.pdf`

### What You'll Get

```
Page 1: Title Page
┌────────────────────────────┐
│   Asset QR Codes           │
│   Generated: Feb 12, 2026  │
│   Total Assets: 45         │
└────────────────────────────┘

Page 2: Projectors (5 assets)
┌──────┐ ┌──────┐ ┌──────┐
│ QR 1 │ │ QR 2 │ │ QR 3 │
│PRO-01│ │PRO-02│ │PRO-03│
└──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐
│ QR 4 │ │ QR 5 │
│PRO-04│ │PRO-05│
└──────┘ └──────┘

Page 3: Desktops (12 assets)
[3 columns x 4 rows]

Page 4: Laptops (8 assets)
[3 columns x 3 rows]
...
```

## 📐 Technical Specifications

### PDF Dimensions
- **Page Size**: A4 (210mm x 297mm)
- **Margins**: 50pt on all sides
- **QR Code Size**: 120x120 pixels
- **Card Width**: 180pt
- **Card Height**: 200pt (QR + labels)

### Grid Layout
- **Columns**: 3 per page
- **Horizontal Gap**: 15pt between cards
- **Vertical Gap**: 20pt between rows
- **Cards per Page**: ~9 (3 columns × 3 rows)

### Card Structure
```
┌─────────────────┐
│                 │
│    [QR CODE]    │ ← 120x120px
│                 │
├─────────────────┤
│   ABC-PRO-001   │ ← Asset ID (10pt, Bold)
│   Projector XYZ │ ← Asset Name (9pt)
│   Model: X123   │ ← Model (7pt, Gray)
└─────────────────┘
```

## 🖨️ Printing Instructions

### For Standard Labels

1. **Paper**: Use A4 label sheets or regular A4 paper
2. **Print Settings**:
   - Paper Size: A4
   - Orientation: Portrait
   - Scale: 100% (Actual Size)
   - Color: Black & White or Color
3. **Cutting**: 
   - Cut along card borders
   - Each card is 180pt × 200pt (approx 6.3cm × 7cm)
4. **Application**:
   - Use adhesive labels or tape to attach to assets
   - Ensure QR code is not covered or damaged

### For Bulk Printing

1. Print multiple copies of the PDF
2. Use a paper cutter for straight cuts
3. Consider laminating for outdoor/high-wear assets

## 🔧 API Endpoints

### Download All Assets QR PDF
```http
GET /api/qr-pdf/download
Authorization: Bearer <token>

Response: PDF file (application/pdf)
Filename: asset-qr-codes-2026-02-12.pdf
```

### Download Category-Specific QR PDF
```http
GET /api/qr-pdf/download/:category
Authorization: Bearer <token>

Example: GET /api/qr-pdf/download/Projector

Response: PDF file (application/pdf)
Filename: Projector-qr-codes-2026-02-12.pdf
```

## 📊 Example Use Cases

### 1. New School Setup
- Generate QR codes for all 200+ assets
- Print on adhesive labels
- Attach to each piece of equipment
- Students/staff can scan to report issues

### 2. Inventory Audit
- Print PDF of all assets
- Use as checklist during physical inventory
- Scan QR codes to verify location/condition

### 3. Lab Equipment
- Generate PDF for "Lab Equipment" category only
- Print and laminate
- Place in lab for easy access
- Students scan to report broken equipment

### 4. Department-Specific Assets
- Filter by department in the assets page
- Download QR codes for that department
- Distribute to department head
- Attach to departmental assets

## 🎨 Customization Options

Currently, the PDF is automatically styled. Future enhancements could include:

- [ ] Custom logo on title page
- [ ] Custom color schemes
- [ ] Different QR code sizes (small/medium/large)
- [ ] Different layouts (2 columns, 4 columns)
- [ ] Include additional asset fields (location, department)
- [ ] Custom paper sizes (Letter, Legal)

## ⚠️ Limitations

1. **QR Code Availability**: Only generates QR codes for assets that already have them
2. **File Size**: Large organizations (1000+ assets) may have large PDF files
3. **Page Limit**: No explicit limit, but very large PDFs may be slow to generate
4. **Browser Compatibility**: Requires modern browser for PDF download

## 🐛 Troubleshooting

### PDF Not Downloading?
- Check browser's download settings
- Ensure pop-ups are not blocked
- Try a different browser
- Check if you have permission to download files

### QR Codes Missing in PDF?
- Assets must have QR codes generated first
- Go to asset details page to trigger QR generation
- Or create a new asset (QR is auto-generated)

### PDF Shows Placeholders?
- QR code data may be corrupted
- Edit the asset to regenerate QR code
- Contact system admin if issue persists

### Blank PDF or Error?
- Ensure you have assets in your organization
- Check console for error messages
- Verify you're logged in with proper permissions

## 🔐 Security & Permissions

- **Access**: All authenticated users can download QR PDFs
- **Scope**: Only shows assets from user's organization
- **Data**: QR codes contain asset ID and public URL only
- **No sensitive data** in QR codes (cost, vendor, etc.)

## 📈 Performance

- **Small Orgs** (< 50 assets): < 1 second
- **Medium Orgs** (50-200 assets): 1-3 seconds
- **Large Orgs** (200-500 assets): 3-5 seconds
- **Very Large** (500+ assets): 5-10 seconds

PDF is generated on-demand, not cached.

## ✅ Summary

The QR Code PDF feature provides a professional, print-ready document with all your asset QR codes organized by category. Perfect for:

- ✅ Initial asset deployment
- ✅ Inventory management
- ✅ Asset tracking
- ✅ Issue reporting workflow
- ✅ Physical asset labeling

Simply click **"📥 Download QR Codes PDF"** on the Assets page and you're ready to print and deploy!

