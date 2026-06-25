# Nuse — Product Notes & Ideas Backlog

> Living document. Add ideas here as they come up. Last updated: June 2026.

---

## Firm Vision

The firm is a **financial intelligence infrastructure for African SMEs** — from the woman selling tomatoes in Lomé to a registered packaging company in Accra to the MFI financing both.

**Three layers:**
1. **Nuse** — Open access, women-first brand and design. Informal entrepreneurs. Voice, photo, manual entry. Free/subsidized. Primary purpose: data acquisition + financial empowerment + social mission.
2. **Nuse Pro / Nuse Business** — Formally registered SMEs. P&L views, loan accounts, monthly exports, English-first, richer categories. B2B SaaS, sold to businesses or licensed through partners (MFIs, banks).
3. **Intelligence Layer** — The NUSE Score (behavioral credit signal), portfolio analytics API for MFIs, sector benchmarks, impact reporting as a service.

**The moat:** behavioral financial data on people invisible to every existing financial system. No one else starts at the grassroots.

**NUSE Score:** Nuse is open to all genders so the score trains on a diverse, unbiased dataset. Women-first by brand and design, not by technical gate.

**Go-to-market:**
- Togo pilot → proof of behavior (60–90 days, 10–20 women)
- Partner pipeline: MFIs, NGOs, women's programs in West Africa (WE-POWER Fund in Ghana is first lead)
- Co-design framing: "Be the first partner to co-design the Business tier"
- Funding: impact grants first (Mastercard Foundation, Orange Ventures, Cartier Women's Initiative, Gates fintech-for-good), VC later at Series A

---

## User Personas Discovered (within "informal market woman")

### Persona 1: The Solo Entrepreneur
Standard market woman, food seller, seamstress. Does everything herself. Needs: simple daily entry (voice or manual), savings tracking, basic dashboard, encouraging nudges. Voice-first, Ewe/Mina/French.

### Persona 2: The Market Woman with an Accountant
Doing meaningful volume. Has someone (external) who reconciles her books monthly. Needs:
- Photo upload of receipts/documents for the accountant to review
- A **read + export access mode** for the accountant (not admin, not entrepreneur — view + export only)
- Monthly PDF/CSV export the accountant can actually use
- Likely the fastest path to Nuse Pro — already thinks in business terms

### Persona 3: The Absentee Owner (Bar, Restaurant, Shop)
Owns the business but isn't the one selling. Has staff or family at the point of sale daily. Needs:
- **Staff/delegate entry** — a simplified entry flow (PIN or short link) that the person at the bar uses to log daily sales + expenses. No full account access.
- Owner sees consolidated view, reviews, approves
- Later: WhatsApp integration (staff sends "ventes 45000 dépenses 8000" → auto-parsed and logged)
- Connects directly to inventory management (see below)

---

## Feature Ideas Backlog

### Photo Upload (Planned — high priority)
- Upload receipt or mobile money screenshot
- AI extracts amount, category, date
- Queued for accountant review if accountant access is enabled
- Also useful for: mobile money transaction confirmation, supplier invoices

### Staff / Delegate Entry (New)
- Short PIN or QR code the owner sets up
- Staff sees only: date, sales total, expense total, notes field
- Cannot see owner's full dashboard or history
- Owner gets a "pending review" notification
- Owner approves → becomes official daily entry
- Same mechanism solves: bar owner, shop with employee, WhatsApp pilot reporting

### Accountant Access Mode (New)
- Separate login (email/phone) with view + export rights only
- Sees all confirmed transactions
- Can export CSV, PDF monthly summary
- Cannot create or edit transactions
- Owner grants/revokes from profile settings

### Inventory Management (New — see full spec below)
See section below.

### Onboarding Branch: "Who manages daily sales?"
- New question in onboarding step 1: "Do you sell yourself, or do you have someone helping?"
- If "someone helps" → prompt to set up staff entry PIN immediately
- Reduces churn from absentee owners who abandon because they can't log themselves

### NUSE Score (Future — 12–18 months)
- Composite 0–850 signal: cash-flow regularity, savings consistency, learning completion, repayment behavior
- Needs 10,000+ users and 12+ months of data before it's credible
- API licensed to banks, MFIs, credit bureaus
- Shown to entrepreneur as their own score (with tips to improve it)
- Shown to partner as a signal per portfolio client

### Monthly P&L View (Nuse Pro)
- Income statement format, not just "money in / money out"
- Expenses broken down by account type (inventory, payroll, rent, transport, utilities, loan repayment)
- Exportable as PDF for accountant / lender

### Repayment Calendar (Showcase → real feature)
- Already in showcase Financing page
- Wire to real loan data from onboarding (loan amount, term, monthly payment)
- Show: upcoming payments, payment history, on-time compliance %

---

## Inventory Management — Feature Spec

### Why it matters
For market women, bar owners, and shop owners, **cost of goods sold** is invisible without inventory tracking. Without it, "profit" is wrong — they're calculating revenue minus cash expenses but not accounting for stock consumed. Inventory also surfaces shrinkage (bar owners especially: bottles disappear).

### Design principle
Not a full inventory system. Not SKUs and barcodes. Just enough to answer three questions:
1. What did I restock today and what did it cost?
2. What do I have left?
3. Am I selling faster than I think? (shrinkage alert)

### User flows

**Market woman (perishable stock):**
- Daily restock entry: "I bought 3 crates of tomatoes — 15,000 FCFA" → logs as expense, category: Stock
- No need to track remaining quantity on perishables (she sells everything or it spoils)
- Profit calculation becomes accurate: sales - stock cost - other expenses = real profit

**Bar owner (trackable inventory):**
- Setup: "What do you sell?" → Beer, Spirits, Soft drinks, Water (simple list, can customize)
- Opening stock: "How many bottles of each do you have today?"
- Daily close (via staff entry): sales amount + optional "bottles sold" count
- Dashboard shows: estimated remaining stock vs. actual (from staff entry) → flags shrinkage
- Low stock alert: "You have about 12 beers left based on sales. Time to reorder?"

**Shop owner (goods):**
- Item list with quantities
- Sales auto-deduct from inventory when category matches item
- Restock entry adds back to inventory
- Alert when item quantity falls below threshold

### Data model additions
```
inventory_items
  id, user_id, name, unit (bottle/kg/piece/crate), current_quantity, reorder_threshold, created_at

stock_movements
  id, user_id, item_id, date, type (in/out), quantity, unit_cost, transaction_id (link to expense)
```

### Minimum viable version (pilot-safe)
For the Togo pilot: don't build full inventory. Just add a **"Stock purchase"** expense category that flows into a simple "Stock spent this week" metric on the dashboard. This gives the accountant persona what they need (cost of goods tracked) without building a full inventory system.

Full inventory (bar owner flow with quantities, shrinkage detection) → post-pilot, Nuse Pro scope.

---

## WE-POWER Fund — Action Items

- Follow-up message: "Pilot starting in Togo [date]. Co-designing Business tier for registered SMEs. Is WE-POWER interested in shaping it?"
- Showcase gaps to fix before next conversation:
  1. Reports page: add at least one downloadable mock PDF report (not just "coming soon")
  2. NUSE Score: add as a column in Portfolio table and card in BusinessProfile (even with "coming soon" badge)
- Showcase is already well-aligned: GHS currency, Ghanaian businesses, correct loan range, climate sectors, SDG tracking, repayment compliance

---

## Open Questions
- Firm name: Nuse is the product. What's the parent firm? (Nuse Labs / Nuse Intelligence / something else?)
- Pricing for partner dashboard: per-portfolio seat? Annual contract? First pilots likely free/grant-funded.
- WhatsApp integration priority: high for absentee owners and low-literacy users, but complex to build. When?
- Lesson 3 Ewe video: user will provide file → drop in `public/videos/`
- Ewe audio guides: 25 phrases to record, place in `public/audio/ewe/{key}.m4a`
- Git push: always from user's terminal — `cd C:\Users\essek\Nuse_vs\nuse-app && git add -A && git commit -m "..." && git push origin main`
