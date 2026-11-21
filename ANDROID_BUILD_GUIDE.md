# LORRY TRACK PRO – Distributable Android APK Build Guide

This guide walks you through generating a distributable Android `.apk` file for **LORRY TRACK PRO** that you can distribute directly to staff members without publishing to the Google Play Store.

---

## 📱 Architecture Overview

- **Framework**: React 18 + JavaScript (JSX) + Vite + Tailwind CSS
- **Mobile Container**: Capacitor 7 (`@capacitor/android`)
- **Package Identifier**: `com.lorrytrackpro.app`
- **Application Name**: `LORRY TRACK PRO`
- **Backend**: Shared Supabase instance (PostgreSQL + RLS + Realtime)

---

## 🛠️ Prerequisites

Before building the APK, ensure your computer has:
1. **Node.js**: v18+ (v20+ recommended)
2. **Java Development Kit (JDK)**: JDK 17 or JDK 21 (Temurin or Oracle)
3. **Android Studio** (or Android SDK command line tools with Android SDK Platform 34/35)

---

## 🚀 Quick Build (In 3 Steps)

### Step 1: Build the Web App
From the project root:
```bash
cd /Users/udhaya/.gemini/antigravity/scratch/lorry-track-pro
npm run build
```

### Step 2: Sync to Android Project
```bash
npx cap sync android
```

### Step 3: Generate the APK

#### Option A: Command Line (Fastest via Gradle)
Run the Gradle wrapper:
```bash
cd android
./gradlew assembleDebug
```

> **Your APK will be ready at:**
> `android/app/build/outputs/apk/debug/app-debug.apk`

Rename this file to `LorryTrackPro-v1.0.apk` and transfer it to your staff phones via USB, WhatsApp, Google Drive, or local file sharing.

---

#### Option B: Using Android Studio (GUI)
1. Launch Android Studio with the project:
   ```bash
   npx cap open android
   ```
2. Wait for Gradle to index and sync the project dependencies.
3. In the top menu bar, select:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. Once completed, a notification will appear: **"APK(s) generated successfully"**. Click **locate** to view the generated `.apk` file.

---

## 🔐 Building a Signed Release APK (Production Distribution)

To produce an optimized, signed release APK for staff phones:

1. **Generate a keystore** (if you don't have one already):
   ```bash
   keytool -genkey -v -keystore lorrytrackpro-release.keystore -alias lorrytrack -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In Android Studio, go to:
   **Build > Generate Signed Bundle / APK > Select APK > Enter Keystore credentials > Select 'release' > Finish**.
3. Output location:
   `android/app/release/app-release.apk`

---

## 📲 How Staff Install the APK on Android Phones (Sideloading)

1. Send `LorryTrackPro.apk` to staff members (via WhatsApp, Telegram, internal server, or email).
2. When the user taps the file, Android will prompt:
   - *"For your security, your phone is not allowed to install unknown apps from this source."*
3. Tap **Settings**, then enable **"Allow from this source"**.
4. Tap **Install**.
5. Open **LORRY TRACK PRO** and log in with the staff credentials provided by the Admin.

---

## 🌐 Connecting to the Supabase Database

The Android APK shares the exact same database as the web dashboard.

### 1. Set credentials in `.env` before building:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Then run:
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### 2. Or configure dynamically inside the running Android app:
Tap the **Gear (Settings)** icon in the top header, enter your Supabase URL & Anon Key, and tap **"Save & Connect"**. The app will reload and immediately connect to your live database.

---

## 🛡️ Security Best Practices
- **Never embed the `service_role` secret** in the app. Only use the public `anon` key.
- Security and access restrictions are strictly enforced at the Postgres database level using **Row Level Security (RLS)**.
- If a staff member leaves or loses their device, the Admin can instantly deactivate their account from the **Admin Hub > Staff Accounts** tab. This immediately revokes database access.
