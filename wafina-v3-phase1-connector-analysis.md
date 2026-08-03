# Wafina V3 — Phase 1: Connector Analysis (Candid & Benevity)

**Purpose:** Establish exactly what Candid and Benevity can and cannot provide before any feature is proposed, with a specific eye on Angola coverage.

**Method note (read before the sections below):**
- The **Benevity** section is based on **live tool calls I ran in this chat** against the actual `Benevity:benevity_nonprofit_search` and `Benevity:benevity_nonprofit_details` tools, including a real test query for "Angola." What's reported is what the API returned, not a description from memory.
- For **Candid**, I was not able to load a callable Candid tool in this chat surface. Candid appears in your connected services, but its MCP connection is exposed for use *inside Artifacts* (via API calls with `mcp_servers`), not as a directly invocable chat tool here — I confirmed this by searching for it repeatedly and getting no matching tool. So the Candid section below is built from Candid's own current developer-portal documentation (fetched via web search just now, not training memory), not from a live query I executed. I flag this distinction so you don't mistake it for equivalent verification. If you want live Candid data, I can build an Artifact that calls the Candid API directly (Essentials/Premier/Grants endpoints) — that would give you real query results the same way I got real Benevity results below.

---

## Section 1 — Candid

**Data Source: Candid Developer Portal (developer.candid.org), documentation reviewed August 1, 2026 — not a live API call.**

### What data Candid can access
Candid (formed from the 2019 merger of Foundation Center and GuideStar) exposes its data through a family of separate APIs rather than one unified endpoint: **Essentials**, **Premier**, **Charity Check**, **Demographics**, **Grants**, **News**, **Taxonomy**, **Eligibility**, plus PDF/Bulk variants. Each is licensed and called separately — "using Candid" in practice means picking specific API products, not one generic connector.

- **Essentials API** — core nonprofit search/lookup: name, EIN, location, NTEE (cause) code, size, financial range.
- **Premier API (v3)** — deep profile data: financials, programs, leadership, board members, grants received *and* awarded, operating details, affiliations, Financial Trend Analysis (FTA). Also generates a shareable Profile PDF.
- **Charity Check API** — validates IRS tax-exempt/compliance status for a given organization.
- **Grants API** — funder, recipient, and funding-activity data for grant analysis.
- **Demographics API** — self-reported demographic/equity data nonprofits have submitted to Candid.
- **Taxonomy API** — Candid's Philanthropy Classification System (PCS): subject, population, support-strategy, and geographic-area tags.
- **Eligibility API** — rules-based check of whether an org is eligible to receive a grant/donation (IRS status, country, OFAC, custom criteria) — built for automating grantmaking/giving workflows.
- **News API** — real-time sector news curated from ~65,000 sources.

### What searches are possible
Via Essentials: search by org name, EIN, keyword, location, NTEE/cause code, and financial range (revenue, assets, expenses); location + radius search; filter to orgs with recently updated records or submitted demographic data. Via Grants/Premier: query grants by funder, recipient, subject, population, geography, and time period.

### What information is returned
JSON records ranging from lightweight (Essentials: name, mission snippet, website, logo, contact, EIN, NTEE code — built for autocomplete/lookup) to comprehensive (Premier: full financial statements, leadership/board rosters, program descriptions, grants history, FTA, affiliations).

### Limitations
- **The core database is explicitly U.S.-centric**: Candid describes its base offering as ~1.8 million *IRS-recognized* tax-exempt organizations, indexed primarily by **EIN** (a U.S. Employer Identification Number). An organization with no U.S. IRS filing has no natural anchor record in this system.
- Each API is a **separate licensed product** — Essentials, Premier, Grants, etc. are not bundled by default; "Candid access" needs to be scoped to which specific API(s) are contracted.
- Grants/funding data reflects **funders' self-reported or Candid-aggregated grant records**, not a live registry of in-country Angolan grant activity.
- I have not verified current pricing, rate limits, or contract terms — those would need to be confirmed directly with Candid, not assumed.

### Angola coverage
Because Candid's identity system is built around U.S. IRS/EIN records, **there is no indication Candid maintains a native registry of Angola-domiciled nonprofits**. Realistic Angola-relevant coverage would most likely come through the **Grants API**, where a **U.S. or international foundation** that has funded a program *in* Angola shows up as a recipient/geography tag on that funder's grant record — i.e., Candid can potentially show "who funds work in Angola," not "which Angolan organizations exist and are registered." This is an inference from how the API is structured, not a confirmed data point — it should be verified with Candid directly or via a real API call before being relied on.

### Nonprofit profiles
Premier API profiles are the most complete artifact Candid offers: financials, leadership, board, programs, grants received/awarded, FTA, affiliations, and a generated PDF brief. This depth exists for U.S.-registered orgs; depth for an Angolan-only organization is unconfirmed and likely minimal-to-absent absent a U.S. fiscal sponsor or EIN.

### Volunteering
Nothing in Candid's documented API family is a volunteering-match or volunteer-opportunity product. Candid's suite is nonprofit *data* (financial, organizational, grant), not a volunteering marketplace. This is a functional gap relative to Benevity.

### Grants
This is Candid's strongest documented category: a dedicated **Grants API** for funder/recipient/funding-activity analysis, reinforced by grants-received/awarded fields inside Premier profiles.

### Funding
Same as above — funding-flow data (who funds whom, how much, in what subject/population/geography) is a core Candid product via Grants + Taxonomy + Premier.

### Transparency
Charity Check API is purpose-built for IRS-compliance verification. Candid also runs the **Seals of Transparency** program (referenced in its API-portal documentation as something developers can incorporate into grant guidelines), which is a self-reported transparency/accountability signal layered on top of profile data — again, a U.S.-oriented mechanism as documented.

### Organization categories
Handled through the **Taxonomy API** — Candid's own Philanthropy Classification System (PCS): subject area, population served, support strategy, and geographic area, plus **NTEE codes** (the standard U.S. nonprofit classification taxonomy) surfaced in Essentials.

### Geographic filtering
Documented as location + radius search (Essentials) and geographic-area tagging (Taxonomy/Grants). Whether "location" search meaningfully resolves for Angolan cities/provinces (versus only U.S./North American geocoding) is unconfirmed from documentation alone and would need direct testing.

---

## Section 2 — Benevity

**Data Source: Live Benevity connector — `benevity_nonprofit_search` and `benevity_nonprofit_details` tools, called directly in this session. Test query used: "Angola."**

### What data Benevity can access
Two tools are exposed: a **search** tool (keyword/location/cause-type search returning a list of "causes") and a **details** tool (takes cause UUIDs from search and returns organization contact/address data). This is a narrower surface than Candid's — it's built for a donation/cause-matching experience, not deep nonprofit research.

### What searches are possible
Free-text keyword search only, based on the parameter schema (`query: string`) and observed behavior. My live test of `query: "Angola"` did **not** return a location filter parameter — Benevity's own tool description says it supports "keyword, location, or cause type," but the callable schema only exposes a single text field, so location/cause filtering (if it exists) happens implicitly through keyword matching, not a structured filter I can set directly.

### What information is returned
**Search results** (per cause): name, description snippet, city, state, country, geo-coordinates (lat/long), category + subcategory, and highlighted text snippets showing why it matched.
**Detail results** (per UUID): display name, a redirect website URL (routed through Benevity, not the org's raw URL), full mailing address, country (name/ISO numeric/alpha-3 codes), and geo-coordinates. Notably, **no financials, no leadership/board data, no grant history, and no transparency/compliance signal** are returned by the details endpoint — this is a lighter profile than Candid's Premier product by design.

### Limitations
- No dedicated volunteering-opportunity endpoint. The two tools available are nonprofit **search** and **details** only — this MCP surface does not expose Benevity's separate volunteering or grants/matching-program functionality, even if that exists in Benevity's broader corporate-giving platform outside this connector.
- No grants or funding-flow data at all — this connector is about *finding a cause to donate to*, not analyzing funding activity.
- No financial or transparency data (no equivalent to a 990, no compliance-check field) in what's returned.
- Results skew heavily toward **U.S. IRS-registered 501(c)(3) organizations** — every result in my live test had a U.S. city/state and a U.S.-format address.

### Angola coverage — tested live, not assumed
I ran the search `query: "Angola"` and got 10 results back. **None were Angola-domiciled organizations.** The matches were:
1. U.S. organizations physically located in towns named **Angola** — Angola, New York and Angola, Indiana (a summer camp, a university, local churches, a pregnancy center).
2. U.S.-registered international-relief/faith-based organizations whose program *descriptions* mention doing work **in** Angola the country (e.g., an international church-outreach org running food programs in Mozambique and Angola; a women's-empowerment org active in Angola, DR Congo, and Nepal; a global cataract-surgery nonprofit operating in Angola and Burundi; a bicycle-relief charity with programs reaching Angola among many countries).

So Benevity's keyword match is pulling on **place names and free-text description mentions**, not a structured "country of operation" field — and critically, it surfaced zero organizations actually headquartered or registered in Angola. This strongly suggests Benevity's underlying database, like Candid's, is built around U.S.-registered charities (it's a U.S./Canada-oriented corporate-giving platform), and an Angolan grassroots NGO with no U.S. EIN-equivalent presence would likely not appear at all.

### Nonprofit profiles
Thin by design: name, description, address, website (Benevity-redirected), category/subcategory, geo-coordinates. No financials, no staff/leadership, no program-level detail beyond the description text.

### Volunteering
Not present in this connector's callable tools. Cannot be assessed from what I actually queried — would need to be confirmed against Benevity's own product documentation or a different connector/endpoint if volunteering matching is required for Wafina V3.

### Grants
Not present. No grants search, no funder/recipient data anywhere in the two available tools.

### Funding
Not present in the sense of funding-flow analysis. The only "funding" angle available is that this connector is oriented toward donation/matching (this is a corporate workplace-giving platform), but no historical or aggregate funding data is exposed by the tools themselves.

### Transparency
No compliance/IRS-verification field, no transparency seal, nothing analogous to Candid's Charity Check. `isWebsiteVerified` appears in the details response as a boolean, which is the only transparency-adjacent signal observed — it likely reflects whether Benevity has verified the *listed website URL*, not the organization's broader compliance status. This should not be treated as a substitute for legal/financial verification.

### Organization categories
Present and structured: every result includes a `categoryName` and `subcategoryName` (e.g., "Religion-Related / Christian," "Education / Undergraduate College (4-year)," "International, Foreign Affairs, and National Security / International Development, Relief Services"). This taxonomy looks aligned with the U.S. NTEE classification system, similar in spirit to Candid's NTEE/Taxonomy data but without a dedicated taxonomy-lookup tool.

### Geographic filtering
No explicit structured geographic filter parameter is exposed to me — `city`, `state`, `country`, and `geoCoordinates` come back in results, so filtering *could* be done client-side after a broad keyword search, but there is no query parameter like `country=AO` or `radius=`. This is a meaningful gap if Wafina V3 needs true geographic/country-level filtering rather than keyword-based approximation.

---

## Cross-cutting takeaway for Phase 1 (observation only — no feature recommendations per your instruction)

Both connectors, as actually accessible right now, are **built around U.S.-registered nonprofit ecosystems**. Neither returned or documented evidence of Angola-domiciled organizations being natively present:
- **Candid**: no native Angola coverage confirmed; theoretical partial visibility only through international funders' grant records (Grants API), unverified.
- **Benevity**: live-tested — zero Angola-based organizations in a direct "Angola" search; all matches were U.S. orgs or U.S. orgs describing overseas program work.

This is a factual finding to carry into Phase 2, not a judgment about which connector to use — you asked me to hold off on recommendations, so I have.
