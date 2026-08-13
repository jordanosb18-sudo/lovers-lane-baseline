# Staff Wellbeing Baseline — Site Spec

**For:** Lovers Lane United Methodist Church pastoral staff
**Partner:** Brain Performance Center
**Purpose:** A confidential, non-diagnostic baseline to help each person understand how their brain and body are responding to the demands of ministry, retaken periodically to track change over time.

---

## 1. Instrument

- 4 domains, 20 scored items, 1 hidden attention-check item (21 questions shown per check-in, order randomized).
- 5-point frequency scale: Never (1) · Rarely (2) · Sometimes (3) · Often (4) · Almost always (5).
- Reverse-scored items recoded as `6 − response` before averaging.
- Each domain score = average of its items (after reverse-coding), rescaled to 0–100.
- Overall composite = average of the 4 domain scores.
- Attention-check item ("select Rarely") is never scored into a domain — it's recorded as pass/fail to flag low-quality responses for the coordinator.

**Domains (final, confirmed marked items only):**
1. Nervous System Load & Recovery — NS_1, NS_2, NS_5, NS_7, NS_10 (5 items)
2. Emotional Regulation & Well-Being — ER_1, ER_2, ER_6, ER_7, ER_10 (5 items)
3. Focus & Cognitive Stamina — FC_1, FC_2, FC_3, FC_6, FC_7 (5 items)
4. Ministry Depletion — MD_1, MD_3, MD_4, MD_7, MD_8 (5 items)

## 2. Screens

| Screen | Who | What happens |
|---|---|---|
| Landing | Everyone | Two options: "Check in" or "Review check-ins" |
| Check-in | Staff | Name field, then 37 items in random order, one Likert row each |
| Confirmation | Staff | Personal "vessel" visualization of today's composite + domain reservoir bars. If they've checked in before: delta vs. last time and vs. their first-ever check-in |
| Reviewer sign-in | BPC coordinator | Real email/password login (Supabase Auth) |
| Reviewer dashboard | BPC coordinator | Staff grouped by person: entry count, latest score, trend arrow, "needs review" flag |
| Person history | BPC coordinator | One staff member's check-ins over time with a trend line |
| Entry detail | BPC coordinator | Full domain breakdown for one check-in, attention-check pass/fail warning, private notes field, "mark reviewed" toggle |

## 3. Data & access model

- Staff **do not** need an account to submit a check-in — just their name.
- BPC coordinators log in with a real Supabase Auth account and **can see individual results** (name attached), per your confirmation.
- Row-level security enforces this at the database level, not just in the UI: anyone can *insert* a check-in; only authenticated (logged-in) users can *read* or *update* them.
- People are matched across check-ins by name (trimmed, case-insensitive) — no login means no hard identity match, so consistent name entry matters.

## 4. Tech stack (already scaffolded)

- **Frontend:** React + Vite, deployed as a static site
- **Backend:** Supabase (Postgres + Auth + row-level security)
- **Hosting:** Cloudflare Pages, auto-deploys from GitHub on push

## 5. Open items

- 16 items are flagged from your handwritten notes where the intended edit (keep/cut/reword) wasn't clear from the marks — listed in chat above. Confirm those and I'll do a final content pass.
- No aggregate/anonymized reporting view exists yet — only per-person. Say the word if you want a church-wide (no names) rollup for the coordinator later.
- No reminder system yet for "hasn't checked in for months" — flagged as a good next addition.
