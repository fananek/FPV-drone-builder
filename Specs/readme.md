# FPV Drone Builder Application Specification

This directory contains the complete, unambiguous technical and functional specifications for the FPV Drone Builder Web Application. This documentation serves as the single source of truth (SSoT) for engineering, AI code generation, and database schema design.

## Specification Structure

| # | File | Contents |
|---|------|----------|
| 1 | `SYSTEM_ARCHITECTURE.md` | Tech stack, database schema, API design, and RBAC matrix. |
| 2 | `DATA_MODELS.md` | Exact data object definitions, enumerations, and part composition rules. |
| 3 | `FUNCTIONAL_REQUIREMENTS.md` | Core features, user stories, UI behaviour, and validation rules. |
| 4 | `ENGINEERING_CALCULATIONS.md` | Mathematical formulas, safety bounds, and telemetry estimations. |

## System Overview

The **FPV Drone Builder** is a modern, web-based configuration and simulation tool catering to both beginner and professional FPV drone pilots. Key capabilities:

* **Build Wizard** — Step-by-step guided configuration tailored to the pilot's intent and flying style.
* **Curated Parts Repository** — Admin-managed database of frames, motors, ESCs, flight controllers, propellers, batteries, and accessories with rich structured metadata.
* **Automated Validation Engine** — Real-time compatibility and safety checks on every build change.
* **Performance Dashboard** — Live-updating radial gauges and charts for thrust-to-weight ratio, tip speed, ESC thermal margin, and estimated flight time.
* **AI Configuration Advisor** — Context-aware chat sidebar powered by an LLM seeded with the active build state.
* **Public Build Gallery** — Community sharing, cloning, rating, and side-by-side comparison of up to 4 builds.
* **Composite Part Support** — Correct handling of All-In-One boards (FC + ESC + RX on a single PCB) or combined FC + RC Receiver in calculations and compatibility checks.

## Key Constraints & Assumptions

* The application is designed as a **local-first / self-hosted** tool with optional cloud deployment.
* All engineering calculations fall back to physics-based approximations when empirical thrust-test data is absent.
* Regulatory weight thresholds (e.g., sub-250 g) are informational only; the application does not enforce local flight regulations.
* The AI Advisor requires an external LLM API key; without it the wizard still functions but the chat sidebar is disabled.
