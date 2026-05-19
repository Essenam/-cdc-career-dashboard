# CDC Career Dashboard — Demo Script
**University of St. Thomas · Career Development Center**
Total time: ~12 minutes | URL: http://localhost:3000

---

## SETUP (before the room arrives)
- Backend running on port 5000 (`cd backend && npm start`)
- Frontend running on port 3000 (`cd frontend && npm start`)
- Browser open at http://localhost:3000
- Log out if already logged in so the login screen is visible

---

## OPENING (1 min)

> "The CDC advises hundreds of students every year, but today there's no easy way to know who needs help, who's on track, and whether the framework we've built is actually being followed. You hear about a student struggling three months too late — because nobody saw it coming.
>
> What we built is a shared dashboard between advisors and students. Staff see the whole cohort at a glance. Students see a clear roadmap for exactly what they should be doing each year. And the two views stay in sync."

---

## 1. LOGIN (30 sec)

**What to show:** The login screen with two role cards.

> "There are two ways in. Students enter their student ID — they land directly on their own profile, no way to see anyone else's. Staff enter a password and get full access."

→ Click **I'm Staff** → enter password → sign in

---

## 2. STAFF DASHBOARD (3 min)

**What to show:** Summary cards + student table

> "First thing staff see is the cohort split into three groups."

Point to the four cards:
- **16 students** total
- **9 Need Outreach** — little to no recorded activity
- **1 Developing** — some activity, needs encouragement
- **6 On Track** — actively engaged across platforms

> "These numbers come directly from Handshake exports — events attended, applications submitted, advising appointments. No manual data entry."

**Filter to Need Outreach:**
> "If I want to focus my week, I click Need Outreach. These are the 9 students I should be reaching out to."

Point to **Caleb Robinson**:
> "Caleb — Accounting major, zero events, zero applications. He's never shown up. That's someone who needs a personal email today, not a mass newsletter."

**Filter to On Track:**
> "On the other end, Marcus Johnson — Business Administration, 175 activity score, currently interviewing at UnitedHealth Group. He doesn't need my time this week."

**Click "View Journey →" on Marcus:**

---

## 3. STUDENT JOURNEY — MARCUS JOHNSON (4 min)

**What to show:** Staff preview mode → progress cards → roadmap → stats → recommendations

> "This is the staff preview. The amber banner reminds me I'm looking through Marcus's eyes — any link I click opens as if I were him."

**Progress cards:**
> "Four cards — one per year of the framework. Marcus is a Year 4 student. He's completed about 12% of his Year 4 milestones from what we can verify automatically. Everything else he self-reports."

**Open Year 4 — Strategic Job Search:**
> "The roadmap is structured around the CDC's four-year framework — Explore, Research, Develop, Implement. Each year breaks into sections with specific, actionable tasks."

**Click a task to check it:**
> "Advisors and students can mark tasks complete. Watch — I check 'Continually develop and refine your LinkedIn profile.' It marks instantly. This syncs to Supabase in real time — if I open another browser, it's already there."

**Upload proof:**
> "After checking a task, the student can attach proof — a screenshot of their updated LinkedIn, a PDF acceptance letter, anything under 1.5 MB. It stores with the record."

*Attach any small image from your desktop*

> "The proof shows as a thumbnail. Staff can see this when previewing the student's journey."

**Click the Events Attended card:**
> "These stat cards are clickable. Marcus has attended 4 events — Resume Workshop, a career fair. Each record shows the date, staff name, and notes from Handshake."

**Click the Applications card:**
> "Five applications. UnitedHealth Group — currently interviewing. Mayo Clinic — pending. The status badge updates from the Handshake export."

**Click Get Recommendations:**
> "Recommendations are generated from whatever's still incomplete in Marcus's Year 4 roadmap. Because he hasn't finished his network or negotiation tasks, it surfaces St. Thomas Connect and a link to CDC salary negotiation workshops. As he checks tasks off, these cards disappear. When everything's done for the year, it shows 'You're on Track' instead."

*Close the modal*

---

## 4. ANALYTICS & INSIGHTS (2 min)

**Return to Staff Dashboard → click Analytics & Insights**

> "This is where staff answer the operational questions — not about one student, but about the whole cohort."

Point to the Activity Stats row:
> "Events: average 1.1 per student, median 0, 9 students with none. That's not a Marcus problem — that's a program awareness problem. Half the cohort has never attended a single event."

Point to Platform Usage:
> "Handshake applications are the most-used touchpoint by far — 38 total. Events are second. CDC appointments are third with only 9 total across 16 students. The least-used touchpoint is the roadmap self-check — which tells us students haven't been shown how to use this feature yet."

Point to Actionable Insights:
> "These cards are auto-generated from the data. '9 students have never attended a career event — promote upcoming Handshake events and send targeted outreach.' '9 students have never booked a CDC appointment — send a personal invitation.' Staff don't have to figure this out themselves — the system tells them what to do."

---

## 5. STUDENT VIEW — SELF LOGIN (1 min)

**Log out → I'm a Student → type STU001 → Continue**

> "From the student side, they enter their ID and land directly on their own dashboard. No search, no way to look up anyone else."

> "Same roadmap, same progress cards — but now it's theirs. They can check things off as they complete them, upload proof, and see exactly what they still need to do for Year 4. The recommendations at the bottom point them directly to the platforms they should be using."

---

## 6. PLATFORMS HUB (30 sec)

**Click Platforms Hub in the nav**

> "One-click access to all six career platforms — Handshake, St. Thomas Connect, Big Interview, Jobscan, the Labor Market Tool, and PathwayU — each with a direct link to the St. Thomas-specific URL and a description of what it's for."

---

## 7. ADMIN (30 sec)

**Log out → Staff → Admin tab**

> "The admin panel is how data gets in. Upload any CSV export from Handshake — student rosters, applications, events, appointments. The system detects the file type from the filename, processes it, and recalculates all scores automatically. No technical knowledge required."

Point to Manage Milestones:
> "Advisors can also manage the roadmap itself. Add a task, edit the wording, assign an auto-trigger so a task gets checked automatically when the right CSV data comes in — without the student having to do anything."

---

## CLOSING (30 sec)

> "Three things this changes for the CDC:
>
> **For advisors:** you start every week knowing exactly who needs a conversation and who doesn't. No more finding out too late.
>
> **For students:** they have a clear, year-by-year roadmap — not a PDF they download once and forget. It's a living checklist tied to real platforms.
>
> **For the institution:** as students self-report and as Handshake data flows in, the dashboard gets smarter. The engagement score evolves from activity tracking today to full milestone completion tracking as adoption grows."

---

## KEY NUMBERS TO HAVE READY

| Fact | Value |
|---|---|
| Total students | 16 |
| Need Outreach | 9 |
| On Track | 6 |
| Most active student | Mei Liu (score 200) |
| Least active | Caleb Robinson (score 10) |
| Total applications in system | 38 |
| Total events | 17 |
| Total CDC appointments | 9 |
| Active roadmap tasks | 58 across 4 years |
| Student to demo as | Marcus Johnson (STU001) |
| Staff password | cdc2025 |

---

## IF SOMETHING BREAKS

| Problem | Fix |
|---|---|
| "Failed to load milestones" | Backend not running — `cd backend && npm start` |
| Tasks not showing in roadmap | Supabase schema cache — wait 5 sec and refresh |
| Login fails for student | Student ID must match exactly: `STU001` not `stu001` |
| Score shows 0 for everyone | Run resync from Admin panel |
| Backend won't start | Check `.env` file exists in `/backend` |
