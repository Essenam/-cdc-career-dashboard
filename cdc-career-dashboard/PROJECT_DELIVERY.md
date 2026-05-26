# CDC Career Dashboard — Project Delivery Summary
**University of St. Thomas · Opus College of Business · Career Development Center**

---

## Why

Students at St. Thomas navigate multiple disconnected career platforms — Handshake, Jobscan, Big Interview, LinkedIn — without a unified view of where they stand. Advisors have no way to see who is falling behind until it is too late. The result: students who need the most help are the least visible, and advisors spend their limited time gathering data instead of acting on it.

---

## What

A unified career readiness platform with two views:

**For students** — a personalized four-year roadmap showing exactly what they should be doing each year (Explore → Research → Develop → Implement), with progress automatically tracked from Handshake data and self-reported milestones. AI-generated recommendations surface the right next step based on what is still incomplete.

**For advisors** — a real-time cohort dashboard that segments every student into three groups (Need Outreach, Developing, Engaged), flags who has gone dark, and surfaces the students who need a conversation this week — not next month.

---

## Who

| Role | Name / Group |
|---|---|
| Client stakeholder | Career Development Center, UST Opus College of Business |
| Primary users | CDC advisors + UST students |
| Prototype lead | Essenam Komlanvi |
| Continuing dev team | UST developer team (to be onboarded) |

---

## What We Built

A fully functional prototype delivered in two weeks, running on:
- **React** frontend (student dashboard, staff dashboard, admin panel, platforms hub)
- **Node.js / Express** backend (REST API, JWT auth, CSV ingestion pipeline)
- **Supabase / PostgreSQL** database (student profiles, roadmap tasks, activity records)

**Core features shipped:**
- Staff login with JWT session tokens
- Student login by ID (no password — direct access to own journey)
- Four-year roadmap with 58 tasks across 4 years and 4 stages
- Task completion with proof-of-work file upload
- Auto-complete triggers — CSV uploads automatically check off tasks when matching activity is detected (e.g. attending a career fair marks the "Attend a career fair" milestone)
- Cohort dashboard with engagement scoring and three-tier segmentation
- Multi-filter system (by status, year, major, engagement level)
- Analytics & Insights panel with cohort-wide stats and actionable advisor callouts
- Top Employers panel showing where students are applying
- Handshake CSV ingestion for 5 data types: students, events, applications, appointments, career fairs
- Admin panel: CSV upload, resync, milestone management
- Platforms Hub: one-click access to all 6 career platforms

**Synthetic demo data:** 15 students, 5 CSV files, covering all engagement scenarios.

---

## What We Are Delivering

| Artifact | Status |
|---|---|
| Working prototype (React + Node + Supabase) | Done |
| GitHub repository (`master` branch) | Done — github.com/Essenam/-cdc-career-dashboard |
| Developer README (setup, architecture, API reference) | Done |
| `.env.example` (config template) | Done |
| Demo script (`DEMO.md`) | Done |
| Sample data (`test-data/team-demo/`) | Done — 5 CSV files, 15 students |
| Supabase project access | To be transferred to dev team |
| Environment credentials | To be shared privately with dev team |

---

## What Comes Next (Phase 2)

The prototype validates the direction. The next team picks up here and builds toward production:

1. **Real Handshake integration** — replace CSV upload with live API sync
2. **SSO / university authentication** — replace student ID login with institutional SSO
3. **Expand data sources** — Tommie Link, Salesforce UConnect, Jobscan, Big Interview, Labor Market Tool, St. Thomas Connect
4. **AI recommendations** — move from rule-based suggestions to LLM-generated personalized guidance
5. **Advisor outreach tools** — in-platform messaging, intervention tracking
6. **Production deployment** — hardened auth, monitoring, institutional hosting

---

*Prototype delivered by Essenam Komlanvi · May 2026*
