# Functional Requirements & User Experience

## 1. Authentication & User Identity

### 1.1 Registration & Login
* Users may register via Email/Password or OAuth 2.0 (Google, Apple, GitHub).
* On first visit, an **anonymous session** is created (JWT stored in LocalStorage/cookie) so users may build without registering.
* Upon registration, anonymous builds are migrated to the new account.

### 1.2 Profile Page
* Displays registered email, OAuth providers linked, and account creation date.
* Shows aggregate stats: total builds, public builds, total community ratings received.
* Allows unlinking OAuth providers (at least one auth method must remain active).
* Allow users to delete their account. This action will delete the user's account and all associated data, including builds, ratings, and reviews. This action is irreversible. Include a confirmation dialog with the text "Are you sure you want to delete your account? This action is irreversible." and a "Cancel" and "Delete" button. The "Delete" button should be red.

---

## 2. FPV Build Wizard (Beginner-Focused)

The Wizard is a multi-step guided flow that collects intent from the user and then populates a new build draft. Each step must show a progress indicator and allow backward navigation without data loss.

### Step 1 — Intent & Flying Style
Ask the user to select their primary flying environment from:
* `Indoor` | `Outdoor Freestyle` | `Cinematic / Smooth` | `Long Range` | `Racing`

Display a short description and illustrative icon for each option.

### Step 2 — Scale / Size
Present clear size options **filtered by the Step 1 choice**, e.g.:
* Indoor → Tiny Whoop 75 mm, 2" micro
* Freestyle → 3-inch, 5-inch, 7-inch
* Cinematic → 3-inch cinewhoop, 5-inch with ND mount
* Long Range → 5-inch, 7-inch, fixed-wing options (future)
* Racing → 5-inch

Contextually display regulatory weight notes (e.g., "Sub-250 g drones avoid registration in many jurisdictions").

### Step 3 — Dynamic Parts Filtering
Based on Steps 1 & 2, apply automatic filters to the *Curated Parts Repository*:
* Frame: `maxPropSizeInch`, `motorMountingPattern`, `fcMountingPattern` constrain later selections.
* Show only compatible motors, ESCs, and FCs that satisfy mounting pattern constraints.
* Present filtered parts as card lists; the user selects one per slot.

### Step 4 — AI Advisor Overlay
A persistent collapsible sidebar powered by a structured LLM prompt. The prompt is contextually seeded with:
* The current draft build state (all selected components and their attributes).
* The user's stated intent (Step 1 & 2 answers).
* Any active validation warnings.

The advisor must provide **direct, non-vague feedback**, e.g.:
> "Your motor KV (2400 KV) is too high for a 6S battery with this 5" propeller. The calculated tip speed is 0.93 Mach, which exceeds the safety limit. Consider switching to a 1700–1950 KV motor or a 4S battery."

The sidebar is disabled (greyed out with a tooltip) if no LLM API key is configured.

---

## 3. Build Management

### 3.1 Build Editor (Advanced / Direct)
* Users can build directly without the wizard using a free-form editor.
* The editor presents slots for each component category: Frame, FC, ESC, Motor (×4), Propeller, Battery, VTX, Camera, RC Receiver, GPS, Accessories.
* A part can be searched and selected per slot. Composite parts like AIO FC/ESC boards or 4-in-1 ESCs automatically fill multiple slots.
* If a composite part is selected, the relevant slots are automatically filled and greyed out (read-only).
* If a user deselects a composite part, the greyed-out slots are cleared and become editable again.
* A user should be able to enter a custom part manually if it's not found in the repository. The user should be able to enter the following fields: name, manufacturer, model, weight (g), and key specs summary. The user should also be able to specify if the part is a composite part.
* Component slot rows render prominent, enlarged vector icons (22x22 px) wrapped in gradient containers to simplify visually locating hardware interfaces.

### 3.2 Parts Search & Selection
* A global search bar filters parts by `name`, `manufacturer`, and `model` fields.
* Category filter chips (Frame, Motor, ESC, etc.) narrow results.
* Each part card shows: name, manufacturer, weight (g), key specs summary, and a compatibility badge (✅ Compatible / ⚠️ Warning / ❌ Incompatible) relative to the current build.
* Hovering a part card shows a popover with full attribute details.

### 3.3 Build Persistence & Soft Delete Recovery
* Builds are auto-saved to the database on every component change (debounced 1 s).
* Build state includes: name, description, selected components, `customPayloadWeightGrams`, visibility (`isPublic`), tags, and custom graphic representation (`imageUrl`).
* Build images can be uploaded directly within the editor header. Images are cropped to a standard 4:3 aspect ratio (400x300 px), compressed as JPEG (80%+ quality) in the client browser, and stored as an optimized Base64 data string in the database column for optimal performance and offline independence.
* Builds have a version counter; optimistic UI updates must handle save conflicts gracefully.
* Users can delete their own builds. Deleting a build performs a soft-delete (setting `deletedAt` timestamp), retaining it in the database for 30 days before permanent deletion.
* Users can view their own soft-deleted builds on the Dashboard via a toggle/filter (hidden by default) and have the option to recover/undelete their own build.
* Anonymous users can create max 3 builds. If they want to create more builds, they need to register an account. A warning should be displayed when the user tries to create more than 3 builds and they should not be able to create more builds until they register an account.
* Builds created by anonymous users should be deleted after 30 days.

### 3.4 Build Tagging & Naming
* Users can apply free-text tags (e.g., `5inch`, `freestyle`, `budget`) to a build.
* Build names must be unique per user (enforced at database level with a unique constraint on `(userId, name)`).

### 3.5 Build Export & Sharing
* **Link Sharing:** A public build generates a shareable URL at `/builds/{slug}`.
* **PDF Export:** Generates a formatted bill-of-materials PDF with component list, calculated metrics, and active warnings.
* **JSON Export:** Exports the raw build JSON for import/backup purposes.

---

## 4. Public Library & Comparison Engine

### 4.1 Public Builds Gallery
* Displays all builds where `isPublic = true`, paginated (20 per page, infinite scroll or pagination controls).
* Filter options: category (Freestyle, Cinematic, Racing, Long Range), weight class (sub-250 g, 250–500 g, 500 g+), frame size (2", 3", 5", 7"+).
* Sort options: Newest, Most Popular (rating count), Highest Rated, Lightest, Highest TWR.
* Each gallery card shows: build name, author, frame/motor summary, AUW, TWR, average rating (stars), and a custom graphic thumbnail. If no image has been uploaded by the builder, a fallback design placeholder featuring a premium wireframe drone/hexagon element is rendered.

### 4.2 Rating & Community Feedback
* Registered users may rate any **public build** from 1–5 stars. One rating per user per build (upsert on re-rate).
* An optional text review (max 500 characters) may accompany the rating.
* The build's `averageRating` and `ratingCount` are denormalised fields updated on each rating upsert.

### 4.3 Build Cloning
* Any user (including anonymous) may clone a public build into their own profile workspace.
* The clone is a full deep copy; changes to the clone do not affect the original.
* Cloned builds carry a `clonedFromBuildId` reference for attribution.

### 4.4 Comparison Matrix View
* Users may select up to **4 builds** for side-by-side comparison from the gallery or their own builds list.
* The comparison table shows: AUW, TWR, Estimated Hover Time, Estimated Freestyle Time, Estimated Racing Time, Tip Speed (Mach), ESC Thermal Margin, and all component slots.
* Numeric differences are colour-coded: **Green** = best value in row, **Red** = worst value in row, **Grey** = neutral / equal.

---

## 5. Automated Validation Engine (Build Checks & Warnings)

The application executes safety and compatibility assertions on **every change** to the build configuration. Warnings are non-blocking (users may proceed) but are prominently displayed.

| ID | Severity | Rule | Trigger Condition |
|----|----------|------|-------------------|
| W-01 | ❌ Error | **Prop–Frame Fit** | `Propeller.diameterInch > Frame.maxPropSizeInch` |
| W-02 | ❌ Error | **Prop–Motor Mount** | `Propeller.mountingPattern` not in `Motor.propMountingPattern` |
| W-03 | ❌ Error | **Motor–Frame Mount** | `Motor.mountingPattern` ≠ any in `Frame.motorMountingPattern` |
| W-04 | ❌ Error | **FC–Frame Mount** | `FC.mountingPattern` ≠ any in `Frame.fcMountingPattern` |
| W-05 | ❌ Error | **ESC–Frame Mount** | `ESC.mountingPattern` ≠ any in `Frame.fcMountingPattern` (stack mount) |
| W-06 | ⚠️ Warning | **ESC Overcurrent** | `Motor.maxCurrentDraw × motorCount > ESC.continuousCurrentAmps` |
| W-07 | ❌ Error | **Voltage Mismatch (ESC)** | `Battery.cellCount > ESC.inputVoltagesMax` |
| W-08 | ❌ Error | **Voltage Mismatch (FC)** | `Battery.cellCount > FC.inputVoltagesMax` |
| W-09 | ⚠️ Warning | **Voltage Mismatch (VTX)** | `Battery.cellCount` outside `VTX.inputVoltageRange` |
| W-10 | ⚠️ Warning | **Tip Speed (Caution)** | `Mach ≥ 0.85` |
| W-11 | ❌ Error | **Tip Speed (Critical)** | `Mach ≥ 0.9` |
| W-12 | ℹ️ Info | **Low TWR** | `TWR < 1.5` (drone may not fly) |
| W-13 | ℹ️ Info | **Regulatory Weight** | `AUW ≥ 250 g` (informational registration reminder) |

Each warning must display: a short title, a human-readable explanation referencing the offending values, and a suggested fix where applicable.

---

## 6. Performance Dashboard (UI Gauges & Charts)

The build editor prominently features real-time updated visual indicators that recalculate on every component or setting change.

| Gauge | Range | Visual |
|-------|-------|--------|
| **Thrust-to-Weight Ratio (TWR)** | 0–15+ | Radial arc gauge; green zone 1.5–3.0 (cinematic), 4.0–9.0+ (freestyle/racing) |
| **Propeller Tip Speed** | 0–1.1 Mach | Arc gauge; orange ≥ 0.7 Mach, flashing red ≥ 0.9 Mach |
| **AUW (All-Up Weight)** | 0–2000 g | Horizontal bar with 250 g regulatory marker |
| **ESC Thermal Margin** | 0–100 % | Percentage bar showing `(ESC.continuousCurrentAmps − peakMotorDraw × motorCount) / ESC.continuousCurrentAmps × 100` |
| **Estimated Flight Times** | 0–30 min | Three separate bars for Hover, Freestyle, and Racing profiles |

A **Thrust Curve Chart** (line chart) is shown below the gauges when empirical `ThrustTestData` exists for the selected motor + propeller + cell count combination, plotting `throttlePercent` vs. `thrustGrams` and `currentAmps`.

---

## 7. Administration section

### 7.1 Admin Parts CRUD
* `Metadata Admin` and `System Admin` roles can create, update, and soft-delete parts via a dedicated admin UI at `/admin/parts`.
* Soft delete sets `isArchived = true`; archived parts are hidden from search but remain in existing builds.
* Bulk import via CSV upload with field mapping wizard.

### 7.2 Thrust Test Data Management
* `Metadata Admin` and `System Admin` roles can create, update, and soft-delete ThrustTestData entries via a dedicated admin UI at `/admin/thrust-data`.
* Admins may upload `ThrustTestData` CSV files from test stands (e.g., RCBenchmark) via the parts detail page.
* The system validates that the linked `motorId` and `propellerId` exist before persisting.
* `isEmpirical` is set to `true` for uploaded data and `false` for computed approximations.

### 7.3 Build management
* Only `system admin` and `moderator` roles may edit, update or delete other users `builds`, including non-public `builds` via a dedicated admin UI at `/admin/builds`.
* Admin builds registry includes a filter toggle to show/hide soft-deleted builds (hidden by default). Administrators can retrieve/undelete any soft-deleted build (provided the owner user account still exists in the system).

### 7.4 User management
* Only `system admin` role may edit, update or delete other users. 
* `system admin` may change a user's roles and subscription status.
* Users registeres via email must verify their email address before being able to create builds and use the app.

---

## 8. Non-Functional Requirements

### 8.1 Performance
* The `/calculate/metrics` API endpoint must respond within **200 ms** for builds with ≤ 20 components.
* The parts search endpoint must return results within **150 ms** for queries with up to 10 000 parts in the database.
* All validation engine checks must complete within **50 ms** client-side (or server-side for SSR).

### 8.2 Accessibility
* The application must conform to **WCAG 2.1 AA** standards.
* All gauge components must provide accessible text alternatives (e.g., `aria-label="Thrust-to-Weight Ratio: 6.2"`).

### 8.3 Responsive Design
* The build editor and dashboard must be usable on screens ≥ 768 px wide (tablet and desktop).
* The wizard and gallery are fully responsive down to 375 px wide (mobile).

### 8.4 Error Handling
* API errors must return a JSON body: `{ "error": { "code": "string", "message": "string" } }` with an appropriate HTTP status code.
* The UI must display a toast notification for all server-side errors with a human-readable message and a retry action where applicable.
* Network failures during auto-save must queue the save and retry with exponential backoff (max 3 attempts).

### 8.5 Security
* All admin and user-scoped API routes must validate the session JWT and check RBAC permissions server-side.
* Part metadata and build data must be sanitised before storage (prevent XSS in free-text fields).
* Rate limiting: max 60 AI advisor requests per user per minute.