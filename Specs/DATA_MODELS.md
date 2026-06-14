# Data Models & Object Relations

## 1. Main Data Objects

### 1.1 FPV Build

```json
{
  "id": "uuid",
  "userId": "uuid | null",
  "anonymousSessionId": "string | null",
  "name": "string",
  "description": "string | null",
  "isPublic": "boolean",
  "tags": ["string"],
  "clonedFromBuildId": "uuid | null",
  "averageRating": "float | null",
  "ratingCount": "integer",
  "version": "integer",
  "createdAt": "ISO-8601 DateTime",
  "updatedAt": "ISO-8601 DateTime",
  "deletedAt": "ISO-8601 DateTime | null",
  "imageUrl": "string | null",
  "components": [
    {
      "partId": "uuid",
      "quantity": "integer",
      "customNotes": "string | null"
    }
  ],
  "calculatedMetricsOverrides": {
    "customPayloadWeightGrams": "float"
  }
}
```

> **Note:** Either `userId` or `anonymousSessionId` must be non-null. Both may co-exist during the session-migration flow.

### 1.2 Part Metadata

```json
{
  "id": "uuid",
  "name": "string",
  "manufacturer": "string",
  "model": "string",
  "weightGrams": "float",
  "mainCategory": "FRAME | ELECTRONICS | PROPULSION | ACCESSORIES | OTHER",
  "subCategory": "FRAME | FC | ESC | AIO | VTX | CAMERA | RC_RECEIVER | GPS | MAGNETOMETER | BUZZER | BEC | LED | RACE_WIRE | ANTENNA | BATTERY_STRAP | BATTERY | PROPELLER | MOTOR | OTHER",
  "attributes": { },
  "isComposite": "boolean",
  "integratedPartIds": ["uuid"],
  "isArchived": "boolean",
  "createdAt": "ISO-8601 DateTime",
  "updatedAt": "ISO-8601 DateTime"
}
```

**Valid `mainCategory` → `subCategory` Mappings:**

| `mainCategory` | Allowed `subCategory` values |
|----------------|------------------------------|
| `FRAME` | `FRAME` |
| `ELECTRONICS` | `FC`, `ESC`, `AIO`, `VTX`, `CAMERA`, `RC_RECEIVER`, `GPS`, `MAGNETOMETER`, `BUZZER`, `BEC`, `LED`, `RACE_WIRE`, `ANTENNA`, `BATTERY_STRAP` |
| `PROPULSION` | `MOTOR`, `PROPELLER`, `BATTERY` |
| `ACCESSORIES` | `ANTENNA`, `BATTERY_STRAP`, `LED`, `OTHER` |
| `OTHER` | `OTHER` |

> **Note:** `AIO` (All-In-One) is a valid `subCategory` under `ELECTRONICS` and is the canonical type for composite FC+ESC+RX boards. An `AIO` part must have `isComposite: true`.

---

## 2. Category Attribute Schemas (JSON `attributes` blob)

Each `subCategory` has a defined set of required and optional fields within the `attributes` JSON column.

### 2.1 Frame (`mainCategory: FRAME`, `subCategory: FRAME`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wheelbaseMm` | `Float` | ✅ | Motor-to-motor diagonal distance, e.g. `220.0` |
| `armThicknessMm` | `Float` | ✅ | Arm thickness for structural reference |
| `maxPropSizeInch` | `Float` | ✅ | Maximum propeller diameter that physically fits, e.g. `5.1` |
| `fcMountingPattern` | `String[]` | ✅ | Accepted FC/ESC stack patterns, e.g. `["20x20", "30.5x30.5"]` |
| `motorMountingPattern` | `String[]` | ✅ | Accepted motor base patterns, e.g. `["12x12", "16x16"]` |
| `vtxMountingPattern` | `String[]` | ❌ | Accepted VTX mounting patterns, e.g. `["20x20", "25x25"]` |
| `stackHeightMaxMm` | `Float` | ❌ | Maximum stack height the frame cavity accommodates, e.g. `8.0` |
| `topPlatePresent` | `Boolean` | ❌ | Whether frame has a top plate (for camera/VTX mounting) |

### 2.2 FC — Flight Controller (`mainCategory: ELECTRONICS`, `subCategory: FC`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mountingPattern` | `String` | ✅ | e.g. `"30.5x30.5"` |
| `inputVoltagesMax` | `Integer` | ✅ | Maximum cell count supported (e.g. `6` for 6S) |
| `firmware` | `String` | ✅ | e.g. `"Betaflight"`, `"iNav"`, `"ArduPilot"` |
| `gyro` | `String` | ✅ | Gyroscope IC, e.g. `"BMI270"`, `"ICM-42688-P"` |
| `mcu` | `String` | ✅ | Processor class, e.g. `"F4"`, `"F7"`, `"H7"` |
| `uartCount` | `Integer` | ❌ | Number of available UART ports |
| `hasBarometer` | `Boolean` | ❌ | |
| `hasBluetooth` | `Boolean` | ❌ | |

### 2.3 ESC — Electronic Speed Controller (`mainCategory: ELECTRONICS`, `subCategory: ESC`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `continuousCurrentAmps` | `Float` | ✅ | Continuous rated current per channel, e.g. `45.0` |
| `burstCurrentAmps` | `Float` | ✅ | Short-burst rated current per channel, e.g. `55.0` |
| `mountingPattern` | `String` | ✅ | e.g. `"30.5x30.5"` |
| `inputVoltagesMax` | `Integer` | ✅ | Maximum cell count supported (e.g. `6` for 6S) |
| `firmware` | `String` | ✅ | e.g. `"AM32"`, `"BLHeli_32"`, `"Bluejay"` |
| `motorOutputCount` | `Integer` | ✅ | Number of motor outputs (e.g. `4` for a 4-in-1 ESC) |
| `hasTelemetry` | `Boolean` | ❌ | Whether the ESC supports ESC telemetry (e.g. KISS or BLHeli telemetry) |

### 2.4 AIO — All-In-One Board (`mainCategory: ELECTRONICS`, `subCategory: AIO`)

An AIO uses the same fields as FC + ESC combined. The `attributes` blob **must** include all required fields from both §2.2 and §2.3. The `isComposite` flag must be `true` and `integratedPartIds` must reference at least a virtual FC record and a virtual ESC record (or be empty if the attributes self-describe the combined unit).

### 2.5 Motor (`mainCategory: PROPULSION`, `subCategory: MOTOR`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kv` | `Integer` | ✅ | KV rating (RPM per volt under no load), e.g. `1950` |
| `statorDiameterMm` | `Float` | ✅ | Stator diameter, e.g. `22.0` (forms first two digits of "2207" naming) |
| `statorHeightMm` | `Float` | ✅ | Stator height, e.g. `7.0` (forms last two digits of "2207" naming) |
| `mountingPattern` | `String` | ✅ | Base mounting hole pattern, e.g. `"16x16"` |
| `propMountingPattern` | `String[]` | ✅ | Shaft/prop adapter patterns accepted, e.g. `["5mm", "1.5mm"]` |
| `inputVoltageMax` | `Float` | ✅ | Maximum continuous voltage (V), e.g. `35.0` |
| `maxCurrentDraw` | `Float` | ✅ | Maximum rated current draw at 100% throttle (A), e.g. `42.0` |
| `resistance` | `Float` | ❌ | Phase resistance in Ohms (for advanced loss calculations) |

> **Why `maxCurrentDraw` is required here:** The validation engine (W-06) compares this value against the ESC `continuousCurrentAmps` without needing a full thrust test. It must be present on the part record.

### 2.6 Battery (`mainCategory: PROPULSION`, `subCategory: BATTERY`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cellCount` | `Integer` | ✅ | Series cell count, e.g. `6` for 6S |
| `capacityMah` | `Float` | ✅ | Nominal capacity in mAh, e.g. `1300.0` |
| `cRating` | `Integer` | ✅ | Continuous discharge C-rating, e.g. `120` |
| `chemistry` | `String` | ✅ | `"LiPo"` \| `"LiHv"` \| `"LiIon"` |

**Voltage per cell by chemistry:**

| Chemistry | Max (V/cell) | Min (V/cell) | Notes |
|-----------|:---:|:---:|-------|
| `LiPo` | 4.20 | 3.50 | Standard LiPo. |
| `LiHv` | 4.35 | 3.50 | High-voltage LiPo; higher storage than standard. |
| `LiIon` | 4.20 | 3.20 | Lithium-Ion (e.g., 18650 cells); lower C-rating typical. |

### 2.7 Propeller (`mainCategory: PROPULSION`, `subCategory: PROPELLER`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `diameterInch` | `Float` | ✅ | Propeller diameter in inches, e.g. `5.1` |
| `pitchInch` | `Float` | ✅ | Propeller pitch in inches, e.g. `4.3` |
| `mountingPattern` | `String[]` | ✅ | Shaft compatibility, e.g. `["5mm", "1.5mm"]` |
| `blades` | `Integer` | ✅ | Number of blades, e.g. `3` |

### 2.8 VTX — Video Transmitter (`mainCategory: ELECTRONICS`, `subCategory: VTX`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputVoltageMin` | `Float` | ✅ | Minimum input voltage (V) |
| `inputVoltageMax` | `Float` | ✅ | Maximum input voltage (V) |
| `mountingPattern` | `String[]` | ❌ | e.g. `["20x20", "25x25"]` |
| `maxPowerMw` | `Integer` | ✅ | Maximum transmit power in mW, e.g. `1000` |
| `protocol` | `String` | ✅ | e.g. `"Analog"`, `"DJI O3"`, `"HDZero"`, `"Avatar"` |

---

## 3. Composition Handling (AIO Boards)

To support structural component combinations like an All-In-One (AIO) FC+ESC+RX board:

1. The part record has `isComposite: true` and `subCategory: "AIO"`.
2. `integratedPartIds` references virtual sub-component Part records (or may be empty if the AIO is self-describing via its `attributes`).
3. When an AIO part is added to a Build, the **calculation and validation engine** expands it as follows:
   * For **FC slot checks** (e.g., mounting pattern, firmware, MCU): read FC-specific attributes directly from the AIO `attributes`.
   * For **ESC slot checks** (e.g., `continuousCurrentAmps`, `inputVoltagesMax`): read ESC-specific attributes directly from the AIO `attributes`.
   * The AIO counts as **one BuildComponent record** (not separate FC + ESC entries).
4. The `weightGrams` field on the AIO record is the combined physical weight of the board. Do **not** add weights of virtual sub-components separately.

---

## 4. Empirical Thrust Test Data

```json
{
  "id": "uuid",
  "motorId": "uuid",
  "propellerId": "uuid",
  "batteryCellCount": 6,
  "batteryChemistry": "LiPo",
  "isEmpirical": true,
  "sourceLabel": "RCBenchmark export 2025-01-15",
  "createdAt": "ISO-8601 DateTime",
  "testPoints": [
    {
      "throttlePercent": 10.0,
      "currentAmps": 1.2,
      "thrustGrams": 95.0,
      "voltageVolts": 24.8,
      "rpm": 8500
    },
    {
      "throttlePercent": 50.0,
      "currentAmps": 18.0,
      "thrustGrams": 820.0,
      "voltageVolts": 23.6,
      "rpm": 28000
    },
    {
      "throttlePercent": 100.0,
      "currentAmps": 42.5,
      "thrustGrams": 1820.0,
      "voltageVolts": 22.2,
      "rpm": 38500
    }
  ]
}
```

**Field Notes:**

| Field | Required | Notes |
|-------|----------|-------|
| `throttlePercent` | ✅ | 0–100 %. Must include at minimum `10`, `50`, and `100` throttle points. |
| `currentAmps` | ✅ | Total input current draw for a single motor at this throttle point. |
| `thrustGrams` | ✅ | Static thrust produced by one motor at this throttle point. |
| `voltageVolts` | ✅ | Battery voltage measured at the ESC input during this test point. |
| `rpm` | ❌ | Motor RPM at this throttle point if available from the test stand. |

**`isEmpirical` flag:**

* `true` — Data was measured from a physical test stand. Use directly in calculations.
* `false` — Data represents mathematical approximations computed via the fallback formulas in `ENGINEERING_CALCULATIONS.md §3`. These records are generated at query time and are **not persisted** to the database.