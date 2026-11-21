# 🚛 FLEET GATE — Heavy Tipper Gate Management System

**FLEET GATE** is a private, production-ready Gate Management and Heavy Load / Tipper Lorry Movement System engineered for industrial premises, transport yards, factories, quarries, and distribution hubs. It provides unified, synchronized operations across **Responsive Web** and **Android Phones** (via native Capacitor APK packaging).

---

## 📱 Mobile & Any-Device QR Code Access

Scan this QR code with any smartphone camera (Google Lens on Android, or the native Camera app on iPhone) to open **Fleet Gate** instantly on your phone with zero app installation required:

<div align="center">

![Fleet Gate Mobile QR Code](./docs/fleet-gate-qr.svg)

### 🌐 Universal Access Link (Any Wi-Fi / 4G / 5G / All Phones):
### 👉 [https://port-awarded-rebound-director.trycloudflare.com](https://port-awarded-rebound-director.trycloudflare.com)

</div>

---

## 💻 Running & Viewing in VS Code

### 1. View the QR Code inside VS Code:
- Open `README.md` in VS Code.
- Press **`Cmd + Shift + V`** (macOS) or **`Ctrl + Shift + V`** (Windows/Linux) to open the Markdown Preview.
- The high-resolution QR code will render directly inside VS Code for instant phone scanning!

### 2. Run the App via VS Code Tasks:
- Press **`Cmd + Shift + P`** (macOS) or **`Ctrl + Shift + P`** (Windows/Linux).
- Select **`Tasks: Run Task`**.
- Choose:
  - **`Fleet Gate: Start Production Server`** (Runs high-performance HTTP server on ports 5173, 3000, and 8080).
  - **`Fleet Gate: Start Vite Dev Server`** (Runs Vite development server).
  - **`Fleet Gate: Build Production Bundle`** (Compiles optimized production assets to `dist/`).

---

## 🌟 Key Architecture & Features

### 1. Direct Staff Gate Screen (No Login Needed)
- Security guards and gate staff land directly on the **Staff Gate Entry Screen** with zero login barriers.
- Instant plate entry with automatic Tamil Nadu / Indian commercial vehicle plate spacing (`TN 21 BV 1234`).
- Automatic multi-trip intimation (`2nd Trip Today`, `3rd Trip Today`, etc.).
- Optional **Remarks** field for both Check-In and Check-Out notes.

### 2. Admin Security Console
- **Credentials Protected**: Only administrators log in to access the master console.
- **Master Fleet & Staff Management**: Add, edit, deactivate, or delete staff records.
- **Daily & Master Data Control**: Clear today's data or execute a master reset of all records with independent safety confirmation.
- **Heavy Tipper Lorry Vector Branding**: Custom reinforced commercial dumper truck icon across all cards and navigation bars.

### 3. High-Performance Multi-Port Server (`server.js`)
- Runs natively on Node.js without heavy framework overhead.
- Listens simultaneously on:
  - `http://192.168.1.55:5173`
  - `http://192.168.1.55:3000`
  - `http://192.168.1.55:8080`
- Explicit `Content-Length` headers, `keep-alive`, and CORS configuration ensure complete immunity from mobile `ERR_TOO_MANY_RETRIES`.

---

## 📁 Repository Structure

```
fleet-gate/
├── .vscode/                         # VS Code tasks & workspace configuration
│   └── tasks.json
├── docs/
│   └── fleet-gate-qr.svg            # QR code image asset for repository & documentation
├── public/
│   ├── fleet-gate-qr.svg            # Web-accessible QR code
│   └── lorry-icon.svg               # Heavy Tipper brand icon (512x512)
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.jsx   # Admin console, staff CRUD, records & resets
│   │   │   └── ReportsAnalytics.jsx # PDF export & analytics
│   │   ├── common/
│   │   │   ├── AllAccessQRModal.jsx # In-app QR code generator & poster printer
│   │   │   ├── QRCodeView.jsx       # Zero-dependency SVG QR matrix renderer
│   │   │   └── TipperTruckIcon.jsx  # Heavy Tipper commercial vehicle SVG
│   │   └── staff/
│   │       └── StaffSimpleScreen.jsx# Fast, zero-login gate entry screen
│   └── utils/
│       ├── qrCodeGenerator.js       # Pure JavaScript QR matrix generator (Level M)
│       └── vehicleFormatter.js      # Automatic lorry plate space formatter
├── android/                         # Native Android Capacitor project
├── server.js                        # High-performance multi-port production server
└── capacitor.config.json            # Capacitor Android configuration
```

---

## 🛠️ CLI Quick Commands

```bash
# 1. Install dependencies
npm install

# 2. Build production assets
npm run build

# 3. Start high-performance multi-port server
npm start

# 4. Sync web bundle to Android project
npm run cap:sync
```
