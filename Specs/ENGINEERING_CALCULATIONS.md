# Engineering Calculations & Estimations

This module translates selected component properties into dynamic performance projections.  
If empirical data is absent from `ThrustTestData`, the application falls back to the physics-based approximation formulas below.

All calculations are performed by the `/api/v1/calculate/metrics` endpoint (stateless) and re-executed client-side for immediate UI feedback.

---

## 1. Battery Voltage

Battery terminal voltage varies with chemistry and state of charge. The following per-cell voltages are used throughout all calculations:

| Chemistry | Max (V/cell) — Fully Charged | Min (V/cell) — Fully Discharged |
|-----------|:---:|:---:|
| `LiPo` | 4.20 | 3.50 |
| `LiHv` | 4.35 | 3.50 |
| `LiIon` | 4.20 | 3.20 |

$$V_{\text{max}} = \text{CellCount} \times V_{\text{perCell,max}}$$
$$V_{\text{min}} = \text{CellCount} \times V_{\text{perCell,min}}$$

> **Tip-speed calculations use $V_{\text{max}}$** (worst-case RPM).  
> **Flight-time calculations use $V_{\text{nominal}}$** where $V_{\text{nominal}} = \text{CellCount} \times 3.7\,\text{V}$ for LiPo/LiHv, and $3.6\,\text{V}$ per cell for LiIon.

---

## 2. Propeller Tip Speed

The tip speed of the propeller **must not exceed 0.9 Mach** to prevent acoustic efficiency collapse and blade flutter. 

### Step 1 — Theoretical Max RPM (no-load)

$$\text{RPM}_{\text{theoretical}} = V_{\text{max}} \times \text{Motor KV}$$

### Step 2 — Tip Speed

$$\text{TipSpeed}\,(\text{m/s}) = \frac{\pi \times D_{\text{m}} \times \text{RPM}_{\text{theoretical}}}{60}$$

where $D_{\text{m}} = \text{PropDiameterInch} \times 0.0254\,\text{m/inch}$

### Step 3 — Mach Number

$$\text{Mach} = \frac{\text{TipSpeed}}{343\,\text{m/s}}$$

> **Note:** The speed of sound (343 m/s) assumes sea-level air at 20 °C. No altitude correction is applied in the current version.

### Warning Thresholds

| Mach | Severity | Action |
|------|----------|--------|
| ≥ 0.85 | ⚠️ Warning (W-10) | Caution — approaching efficiency limits. |
| ≥ 0.90 | ❌ Error (W-11) | Critical — blade flutter and acoustic inefficiency risk. |

---

## 3. All-Up Weight (AUW)

$$\text{AUW}\,(\text{g}) = \sum_{i} \left( \text{Component}_i.\text{weightGrams} \times \text{Component}_i.\text{quantity} \right) + \text{customPayloadWeightGrams}$$

**Composite part handling:** For AIO parts, only the AIO `weightGrams` is included. The weights of any virtual sub-components referenced by `integratedPartIds` are **not** added separately.

---

## 4. Thrust-To-Weight Ratio (TWR)

### 4.1 Case A — Empirical Data Available

A matching `ThrustTestData` record exists for the combination of `(motorId, propellerId, batteryCellCount, batteryChemistry)`:

$$\text{StaticThrust}_{\text{singleMotor}} = \text{ThrustTestData.testPoints[throttle=100\%].thrustGrams}$$

A **static-to-dynamic efficiency factor** of **0.85** is applied to account for real-world aerodynamic losses (prop-wash interference, forward-flight momentum loss):

$$\text{EffectiveThrust}_{\text{singleMotor}} = \text{StaticThrust}_{\text{singleMotor}} \times 0.85$$

$$\text{TotalMaxThrust}\,(\text{g}) = \text{EffectiveThrust}_{\text{singleMotor}} \times \text{MotorCount}$$

> **Note:** `MotorCount` is derived from the number of `MOTOR` (or AIO motor-output-count) entries in `BuildComponents`.

### 4.2 Case B — Approximation Fallback

If no empirical thrust test exists for the selected combination, max thrust is estimated using a semi-empirical propeller power model:

$$\text{RPM}_{\text{real}} = \text{RPM}_{\text{theoretical}} \times 0.83$$

> The 0.83 factor accounts for standard aerodynamic loading under thrust.

$$\text{EstimatedThrust}_{\text{singleMotor}}\,(\text{g}) = 0.015 \times D^{3.5} \times P \times \left(\frac{\text{RPM}_{\text{real}}}{1000}\right)^2$$

where:
- $D$ = `PropDiameterInch`  
- $P$ = `PropPitchInch`

$$\text{TotalMaxThrust}\,(\text{g}) = \text{EstimatedThrust}_{\text{singleMotor}} \times \text{MotorCount}$$

> No additional efficiency factor is applied in Case B since the formula already models loaded conditions.

### 4.3 Final TWR Ratio

$$\text{TWR} = \frac{\text{TotalMaxThrust}\,(\text{g})}{\text{AUW}\,(\text{g})}$$

TWR is dimensionless. Both numerator and denominator are in grams (units cancel).

**Interpretation guide:**

| TWR | Interpretation |
|-----|---------------|
| < 1.5 | Drone may not achieve stable hover. |
| 1.5 – 3.0 | Cinematic / camera build range. |
| 3.0 – 5.0 | General sport / freestyle range. |
| 5.0 – 9.0+ | Competitive freestyle / racing range. |

---

## 5. ESC Thermal Margin

$$\text{ESC Thermal Margin}\,(\%) = \frac{\text{ESC.continuousCurrentAmps} - \text{Motor.maxCurrentDraw}}{\text{ESC.continuousCurrentAmps}} \times 100$$

* A positive margin indicates headroom before the ESC reaches its thermal limit.
* A negative margin triggers Warning **W-06** (ESC Overcurrent).

> **Important:** For 4-in-1 ESC units, `ESC.continuousCurrentAmps` is the per-channel rating. The formula above compares `Motor.maxCurrentDraw` directly against this per-channel rating.

---

## 6. Flight Time Estimations

Flight times are partitioned by three behavioural profiles based on throttle draw assumptions:

| Profile | Throttle Assumption | Description |
|---------|:---:|-------------|
| **Hover** | Dynamic (see §6.1) | Minimum throttle needed to keep the drone airborne. |
| **Freestyle** | 35 % average | Mixed throttle typical of freestyle flying. |
| **Racing** | 65 % average | Sustained high-throttle competitive flight. |

### 6.1 Hover Throttle Calculation

Hover requires total thrust equal to AUW:

$$\text{ThrustPerMotorAtHover}\,(\text{g}) = \frac{\text{AUW}}{\text{MotorCount}}$$

Determine `throttlePercent` at hover by:
1. **Case A (empirical):** Linearly interpolate the `ThrustTestData.testPoints` array to find the `throttlePercent` where `thrustGrams = ThrustPerMotorAtHover`.
2. **Case B (approximation):** Compute thrust at each 5 % throttle increment using the formula in §4.2 (with appropriate RPM scaling) and interpolate.

### 6.2 Current Draw at Profile Throttle ($I_{\text{profile}}$)

1. **Case A (empirical):** Linearly interpolate `ThrustTestData.testPoints` at the profile throttle percentage to obtain `currentAmps` for one motor. Multiply by `MotorCount` for total draw.
2. **Case B (approximation):** Current is estimated using a simplified power model:

$$I_{\text{singleMotor}}\,(\text{A}) = \frac{P_{\text{mech}}}{\eta \times V_{\text{nominal}}}$$

where:
- $P_{\text{mech}}$ is the estimated mechanical power at profile throttle (derived from thrust formula at that RPM and pitch)
- $\eta = 0.80$ (assumed motor + ESC combined efficiency)
- $V_{\text{nominal}}$ = nominal battery voltage (see §1)

$$I_{\text{total}} = I_{\text{singleMotor}} \times \text{MotorCount}$$

### 6.3 Flight Time Formula

To preserve battery health, runtime estimations assume an 80 % usable discharge limit:

$$\text{FlightTime}\,(\text{min}) = \frac{\text{Battery.capacityMah} \times 0.001 \times 0.80}{I_{\text{total}}} \times 60$$

> **Example:** A 6S 1300 mAh pack with 25 A total draw:  
> $\frac{1300 \times 0.001 \times 0.80}{25} \times 60 = 2.496\,\text{min}$

---

## 7. Calculation Priority & Fallback Logic

The system uses the following decision tree for all performance calculations:

```
1. Is there a ThrustTestData record matching (motorId, propellerId, cellCount, chemistry)?
   ├─ YES → Use empirical data (Case A) for TWR, hover throttle, and current draw.
   └─ NO  → Use approximation formulas (Case B) for TWR and current draw.
              └─ Mark all calculated values with an "Estimated (no test data)" badge in the UI.
```

Calculated values derived from Case B approximations must be visually distinguished from empirical results (e.g., with an `~` prefix and a tooltip explaining the estimation method).