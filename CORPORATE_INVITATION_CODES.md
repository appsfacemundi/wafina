# Corporate Invitation Codes

Status: **Complete and production-ready.** Verified live end-to-end 2026-08-02 (see
`RELEASE_NOTES.md` and `PROJECT_QA_MEMORY.md` for the investigation history — most of this feature
already existed from the earlier Admin Web App Parity work; this pass closed the one real gap found
and confirmed everything else against the live system).

## What it's for

Lets a company (e.g. Endiama, Unitel) run a corporate donation program: an Admin creates the
company in Wafina, generates an invitation code for it, and employees enter that code in the Donor
app to link their account. **Being linked to a company does not make every donation corporate** —
the donor chooses, per donation, whether it's personal or on behalf of the company (see RC1 update
below). The donor-company link itself never changes based on that choice.

## Complete workflow

**1. Admin creates the company** — Admin Panel → **Empresas** (top nav) → "Criar empresa" (name +
country). This creates a `Corporate_Accounts` row (`Status: Active`).

**2. Admin generates a code** — on that company's card, click **"Códigos de convite"** to expand
the panel, set "Utilizações máximas" (1 = single-use) and an optional expiration date, click
**"Gerar código"**. Produces a random, unique, look-alike-free code (excludes `0/O/1/I`) stored in
`Invitation_Codes` (`Code`, `Corporate_Account_ID`, `Max_Uses`, `Uses_Count`, `Expires_At`,
`Active`). Admin can **copy** the code to clipboard or **deactivate** it.

**3. Donor redeems the code** — Donor Web/mobile → Settings → "Conta Corporativa" → enters the code
→ "Associar conta". Backend (`POST /donor/corporate/join` → `redeemInvitationCode`) validates,
in order: code exists, is active, isn't expired, hasn't hit its usage limit, and the company isn't
suspended — only then increments `Uses_Count` and links the donor
(`Users.Corporate_Account_ID`). Any failure returns a specific, plain-language error; the donor
sees a success banner on completion.

**4. Each donation is individually attributed, donor's choice** (RC1 update, 2026-08-02) — a linked
donor sees a "Doar como" choice on the donation form: **Doação Pessoal** (default) or **Doação da
Empresa (Company Name)**. Stored directly on the `Donation` row as `Corporate_Account_ID` (blank =
personal, filled = that donation counts for the company) — never derived from the donor's link, and
never client-suppliable as an arbitrary ID: the backend only ever writes the caller's own session
`corporateAccountId` when they explicitly opt in, or blank otherwise. The donor-company link
(`Users.Corporate_Account_ID`) never changes based on this per-donation choice.

**5. Admin visibility** — each company's card on the Empresas page shows its name, country,
active/suspended status, employee count, and total donation count, plus the full list of its
invitation codes with usage (`Uses_Count/Max_Uses`), expiration, and active/inactive state.

## Current capabilities

- Create / edit / suspend / reactivate a company
- Generate a secure random, unique invitation code (single- or multi-use, optional expiration)
- Deactivate a code
- Copy a code to clipboard
- Donor-side redeem with full validation and clear error messaging
- **Per-donation Individual vs. Corporate choice** — the donor decides each time, never a blanket
  rule tied to being linked
- "Minhas Doações" ("My Donations") always shows the donor's own donations — personal and
  corporate alike — each clearly labeled (👤 Doação Pessoal / 🏢 Doação da Empresa – Company Name);
  never other employees' donations
- Admin's company `Donation_Count` counts only donations explicitly marked Corporate — personal
  donations from linked employees are correctly excluded
- Admin visibility into employee count and donation count per company

## Known limitations (deliberate, not oversights)

- **No code reactivation** — once deactivated, a code stays deactivated; generating a new one is
  the intended path. Chosen over adding a second endpoint for the same practical outcome.
- **No hard delete of a code** — deactivate is permanent-enough for the actual need (an inactive
  code can never be redeemed) while preserving the usage history/audit trail. A true delete would
  need to handle "what if it was already used" with no real benefit over deactivating.
- **No company deletion**, only suspend/reactivate — consistent with the rest of the platform
  (no hard-delete exists anywhere in Wafina today; see `RC1_RELEASE_ROADMAP.md`'s account-deletion
  notes).
- **Codes are opaque random strings** (e.g. `K37DNK4N`), not company-name-prefixed
  (`ENDIAMA-7F4K9Q`-style) — deliberate: doesn't leak the company name in a guessable pattern.
- **One company per donor, permanently** — no self-service "leave this company" or "switch
  company" flow exists yet.
- **No per-code creation date shown in the UI** (`Date_Created` is stored but not displayed) —
  minor, cosmetic.

## Possible future enhancements (not scoped, not committed)

- Self-service "leave company" for a donor
- Bulk company import (CSV) for onboarding many corporate partners at once
- A dedicated analytics view (donations-over-time per company, not just a running total)
- Company logo upload (flagged separately in `RELEASE_NOTES.md`'s Known Limitations as a pre-existing
  cosmetic gap)
