# RC1 Terminology Reference — PT ↔ EN

Canonical term mapping for all Wafina-authored UI strings, backend lifecycle emails, and store listings. Any new translation key must reuse the English term below rather than inventing a variant — this is what keeps "Wafina ID," "collection code," etc. consistent across mobile-donor, mobile-institution, and the store listings.

Source of truth for actual strings: `apps/mobile-donor/src/i18n/locales/{pt,en}.json` and `apps/mobile-institution/src/i18n/locales/{pt,en}.json`. This document records the *decisions*, not a full key dump.

## Core product terms

| Portuguese | English | Notes |
|---|---|---|
| Doar | Donate | Verb, donor-side flow name |
| Receber | Receive | Verb/noun, the individual-recipient flow (RECEBER) |
| Doação | Donation | |
| Doador | Donor | Role name |
| Instituição | Institution | Role name |
| Abrigo de Animais | Animal Shelter | Role name (`Animal_Shelter`) |
| Pessoa | Individual / Person | Recipient category `People`; user-facing as "Individual" in English contexts, "Pessoa" stays literal in PT |
| Reserva / Reservar | Reservation / Reserve | RECEBER-only concept — an Institution/Shelter *claims*, a Pessoa *reserves* |
| Aceitar (doação) | Claim (donation) | Institution/Shelter-side verb — deliberately distinct from "Reserve" |
| Código de recolha | Collection code | The 4-digit pickup verification code |
| Confirmar recebimento | Confirm receipt | Individual RECEBER flow's final confirmation step |
| Confirmar entrega | Confirm delivery | Institution/Shelter-side final confirmation step — distinct verb from the above even though both close out a donation |
| Saiba mais | Learn more | Standard expandable-info link text |
| Histórias de Impacto | Impact Stories | |
| Wafina ID | Wafina ID | Never translated, never abbreviated differently — same literal string in both languages |
| Código de doação | Donation code | The public donation reference code (distinct from the collection code) |

## Status labels (`status.*` namespace)

| Portuguese | English |
|---|---|
| Pendente | Pending |
| Aceite | Accepted |
| Recolha Agendada | Collection Scheduled |
| Recolhida | Collected |
| Entregue | Delivered |
| Disponível | Available |
| Reservado | Reserved |
| Recebido | Received |
| Publicada | Published |
| Pendente de aprovação | Pending approval |
| Rejeitada / Rejeitado | Rejected |

## Recipient category / delivery method

| Portuguese | English |
|---|---|
| Pessoas | People |
| Instituições | Institutions |
| Abrigos de Animais | Animal Shelters |
| Doador entrega | Donor delivers |
| Necessita recolha | Pickup required |

## Decisions worth recording

- **"Aceitar" vs "Reservar"** — kept as two distinct English verbs (Claim / Reserve) even though both mean roughly "this item is now spoken for," because the underlying flows (Institution claim vs. individual RECEBER reservation) have different rules (claim has no expiry; reservation expires after 24h) and mixing the English terms would blur that distinction for anyone reading both apps' code or copy side by side.
- **"Confirmar recebimento" vs "Confirmar entrega"** — same donation lifecycle event from two different actors' perspectives (the person confirms *receiving*, the institution confirms *delivering*). Kept as separate English phrases rather than forcing one shared verb, matching how the two apps' UIs already present them as different actions to different audiences.
- **Wafina ID** — never localized, per explicit product decision: it is a product-specific identifier (format `WF-<CountryCode>-NNNNNN`), not a translatable phrase.
- **"Pessoa" role in English** — the Donor app's UI never says "Individual" to the person using it (they only ever see donor-facing copy); "Individual" only appears in Institution/Admin-facing English copy that needs to name the recipient category. This avoids introducing a second English name for the same role that donors themselves never see.

## Out of scope for RC1

Spanish, French, and Chinese are **not** officially supported languages for RC1 — see `LOCALIZATION_AUDIT.md` and the RC1 Localization Decision. Draft ES/FR/ZH store-listing copy exists from an earlier phase but must not be published as an app-store-supported language claim; the in-app language selector offers PT/EN only (`SUPPORTED_LANGUAGES` in both apps' `src/i18n/languages.ts`).

## User-generated content — never auto-translated

The following fields are free text authored by users and are deliberately left as-is regardless of viewer language (per the RC1 Localization Decision's explicit Category A/B distinction):

- Donation `Item_Type` / `Condition` values drawn from the shared enum lists (`ITEM_TYPES`, `CONDITIONS`)
- Institution `Name`, `Needs_List`
- Success Story `Title`, `Description`
- Receiver thank-you message, donor's own donation description/story text

Example: a Portuguese donor's "Roupa de bebé em bom estado" stays exactly as typed for an English-viewing Institution — only the surrounding Wafina-authored UI (labels, buttons, status text) is translated.
