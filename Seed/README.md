# FPV Drone Builder — Production Database Seed & Import Guide

This directory contains pre-configured catalog seed files for the FPV Drone Builder database. You can use these files to import parts and empirical thrust test datasets into your production environment.

## 📂 Available Seed Files

| File | Format | Purpose |
| :--- | :--- | :--- |
| **[`parts.json`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/parts.json)** | JSON | List of all 70 parts, formatted for programmatic API bulk import. |
| **[`parts.csv`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/parts.csv)** | CSV | List of all parts, formatted for the Vercel admin dashboard UI upload. |
| **[`thrust_tests.json`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/thrust_tests.json)** | JSON | Telemetry points for motor/prop/battery combos, formatted for API import. |
| **[`thrust_tests.csv`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/thrust_tests.csv)** | CSV | Telemetry points, formatted for the Vercel admin dashboard UI upload. |

---

## 🚀 Option 1: Direct Database Seeding (Recommended)

To run the seeding script directly against your **Turso Production Database**, run the following command from the `app/` directory of your workspace (with your production credentials):

```bash
TURSO_DATABASE_URL="libsql://your-production-db-name.turso.io" \
TURSO_AUTH_TOKEN="your-production-auth-token" \
npx tsx src/db/seed.ts
```

> [!IMPORTANT]
> Running the seed script clears any existing parts and thrust tests in the database and re-inserts them to prevent primary key duplicates. It will **not** clear user profiles or saved builds.

---

## 🖥️ Option 2: Upload via Administrative UI Panel

If you have an account with `system_admin` or `metadata_admin` role credentials, you can import catalog data directly using the application's built-in import portals.

### 🔌 Parts Import
1. Navigate to `https://your-domain.vercel.app/admin/parts`.
2. Click **Bulk Import CSV**.
3. Open **[`parts.csv`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/parts.csv)**, copy all of its contents, paste them into the dialog input box, and click **Import Parts**.

### ⚡ Thrust Test Stand Data Import
1. Navigate to `https://your-domain.vercel.app/admin/thrust-data`.
2. Click **Bulk Import CSV**.
3. Open **[`thrust_tests.csv`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/thrust_tests.csv)**, copy all of its contents, paste them into the dialog input box, and click **Import Telemetry**.

---

## 🤖 Option 3: Import via Programmatic API Endpoints

You can trigger imports programmatically using the M2M API endpoints. Authenticate the request using your API Client tokens.

### 📥 Curated Parts Ingestion
* **Endpoint:** `POST /api/v1/parts/bulk-import`
* **Content-Type:** `application/json`
* **Payload:** The exact structure defined in [`parts.json`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/parts.json).

```json
{
  "parts": [
    {
      "name": "Mobula7 V2 75mm Whoop Frame",
      "manufacturer": "HappyModel",
      "model": "Mobula7 V2",
      "weightGrams": 5.5,
      "mainCategory": "FRAME",
      "subCategory": "FRAME",
      "isComposite": false,
      "attributes": {
        "wheelbaseMm": 75.0,
        "armThicknessMm": 1.0,
        "maxPropSizeInch": 1.6
      }
    }
  ]
}
```

### 📥 Telemetry Thrust Stand Ingestion
* **Endpoint:** `POST /api/v1/thrust-tests/bulk-import`
* **Content-Type:** `application/json`
* **Payload:** The exact structure defined in [`thrust_tests.json`](file:///Users/fmx/Development/Antigravity/FPV_Builder/Seed/thrust_tests.json).

```json
{
  "tests": [
    {
      "motorId": "motor-xing2207-1850",
      "propellerId": "prop-gemfan51433",
      "batteryCellCount": 6,
      "batteryChemistry": "LiPo",
      "sourceLabel": "RCBenchmark Stand V3",
      "isEmpirical": true,
      "testPoints": [
        { "throttlePercent": 0, "currentAmps": 0.0, "thrustGrams": 0, "voltageVolts": 25.2, "rpm": 0 },
        { "throttlePercent": 100, "currentAmps": 68.0, "thrustGrams": 2120, "voltageVolts": 21.2, "rpm": 41200 }
      ]
    }
  ]
}
```
