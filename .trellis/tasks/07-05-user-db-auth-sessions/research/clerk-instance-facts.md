# Clerk platform fact-check (2026-07-05)

Verifying claims for the design decision in `prd.md` D1/D1a (keep Clerk dev instance
`driven-troll-28.clerk.accounts.dev`, add server-side JWT verification on the Node
backend with built-in `crypto`, no Clerk SDK).

## Summary table

| # | Question | Verified answer | Source |
|---|----------|------------------|--------|
| 1a | Dev instance session mechanism | Confirmed. Dev instances use a "dev browser" object whose client token travels via querystring param `__clerk_db_jwt` instead of a same-site cookie. Docs call this "not secure enough for production use." | [Instances/Environments — Development](https://clerk.com/docs/guides/development/managing-environments) |
| 1b | Dev instance caps/banners | Confirmed. **Capped at 100 users**, data cannot transfer to another instance, and the Clerk Dashboard shows a persistent banner when you're on non-production data. Domains end in `accounts.dev` (matches the app's `driven-troll-28.clerk.accounts.dev`). | same as above |
| 1c | Long-term production use of a dev instance | **Explicitly unsupported** per docs — both the insecure querystring token mechanism and the 100-user cap rule it out for a real production app. | same as above |
| 2a | Production instance requires custom domain + DNS | Confirmed. Docs say you must "have a domain you own" and "be able to add DNS records" before deploying to production; a Frontend API subdomain (e.g. `clerk.example.com`) is provisioned via CNAME. A `*.vercel.app` domain cannot satisfy this (no DNS control). A **proxy** is offered as an alternative if you can't add the Frontend-API CNAME, but the root/production domain requirement (and its DNS records) still stands. | [Deploy to production](https://clerk.com/docs/guides/development/deployment/production), [Change domain/subdomain](https://clerk.com/docs/guides/development/deployment/changing-domains) |
| 2b | Cost / free-tier MAU cap | Clerk's free ("Hobby") plan now allows **50,000 Monthly Retained Users**, and is usable in production (not dev-only) — this is a **2026 pricing increase** from an older 10,000 figure. Paid Pro tier is $20–25/mo + $0.02/MRU above the cap. | [Clerk Pricing](https://clerk.com/pricing) |
| 3a | JWKS URL pattern | Confirmed two options: instance-scoped `https://<frontend-api-domain>/.well-known/jwks.json`, or the account-scoped `https://api.clerk.com/v1/jwks` (Backend API, needs a request). For a dev instance this is `https://driven-troll-28.clerk.accounts.dev/.well-known/jwks.json`. | [Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification) |
| 3b | Algorithm | Confirmed **RS256**. | same as above |
| 3c | Claims to validate | Confirmed: `exp` (expiration), `nbf` (not-before), `azp` (authorized parties — must match your known origins, or you're open to CSRF), `iss` (issuer = your instance's Frontend API URL), plus standard `iat`/`sub`/`sid`. | [Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [Session tokens](https://clerk.com/docs/guides/sessions/session-tokens) |
| 3d | Token location: same-origin vs cross-origin | Confirmed. Same-origin: token auto-sent via non-HttpOnly `__session` cookie. Cross-origin (this app's Vercel↔Render split): must be sent manually via `Authorization: Bearer <token>` header, token fetched with `getToken()`; cross-site cookies are deliberately avoided (Safari blocks `SameSite=None` by default). | [Same-Origin Requests](https://clerk.com/docs/request-authentication/same-origin), [How Clerk works — Cookies](https://clerk.com/docs/guides/how-clerk-works/cookies) |
| 4a | Session token lifetime + refresh | Confirmed **60-second** session JWT lifetime; Clerk's frontend SDK auto-refreshes on a ~50-second interval (10s buffer for latency); Core 3 `getToken()` uses stale-while-revalidate within the last 15s. **Confirms the design requirement**: a cross-origin backend must receive a fresh token per request via `await Clerk.session.getToken()`, never a cached/stored one. | [How Clerk works — Overview](https://clerk.com/docs/guides/how-clerk-works/overview), search-aggregated (Clerk blog "How We Roll — Sessions", `force-token-refresh` docs) — **could not open a single page with the 60s figure stated verbatim; triangulated from multiple Clerk-authored sources, treat as high-confidence but not single-source-quoted** |
| 4b | Overall session lifetime settings (inactivity/max) & free-plan configurability | Free ("Hobby") plan: **fixed 7-day session lifetime, not configurable**. Pro/Business: "Custom session lifetime" (configurable inactivity timeout + max lifetime). So on the free plan, a signed-in user survives a browser restart for up to 7 days by default, but you cannot tune this without upgrading. | [Clerk Pricing](https://clerk.com/pricing) — **note: this came from the pricing page's feature-comparison table, not a dedicated session-settings doc page; worth a second confirmation against the Session Options doc (`clerk.com/docs/authentication/configuration/session-options`) before relying on the exact "7 day fixed" figure** |
| 5a | Clerk JS v4 (Core 1) support status | **Could not verify a definitive EOL/deprecation date.** Docs confirm Clerk is now on Core 2 (v5+) and recommend upgrading; they note some "no-longer-supported / EOL" *base dependency* versions aren't guaranteed to work, but I found no explicit statement that `@clerk/clerk-js@4` itself is unsupported or unpatched. Treat v4 as legacy/unmaintained-in-spirit but not confirmed dead. | [Versioning overview](https://clerk.com/docs/guides/development/upgrading/versioning), [Upgrade @clerk/clerk-js to Core 2](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2/javascript) |
| 5b | v4→v5 changes relevant to the above answers | Breaking changes are mostly API-surface (`setSession()`→`setActive()`, `User.update({password})`→`User.updatePassword()`, image props renamed to `imageUrl`) — **nothing found that changes session-token mechanics, JWKS endpoint, claims, or cross-origin header behavior** between v4 and v5. So the answers above should apply equally to the app's pinned v4. | [Core 2 upgrade guides overview](https://clerk.com/docs/guides/development/upgrading/overview) |
| 5c | China-network / CDN notes | **Not found in official docs.** Searches turned up nothing from Clerk about regional/China endpoint behavior for either v4 or v5; this is expected since it's not a documented feature. The app's own history (Clerk "nearly abandoned 2026-04-15, unusable on China network paths") is the only source for this — external/undocumented network reachability, not something Clerk publishes guidance on. |  — (not verifiable via docs) |

## Details

### 1. Dev vs. production instances — session persistence

From [Instances / Environments — Development](https://clerk.com/docs/guides/development/managing-environments):

- Development instances use an object called the "dev browser," linked to the client token, which is transmitted via querystring (`__clerk_db_jwt`) rather than a cookie — a workaround for the cross-site relationship between `localhost`/preview domains and `*.accounts.dev`.
- Production instances instead set a same-site `__client` (session/handshake) cookie; no querystring token is used.
- Direct quote (via fetch): the `__clerk_db_jwt` querystring mechanism "is not secure enough for production use" and "is not used in production instances," because a token in a querystring "can be seen directly in server logs, browser history, internet providers' logs, and could be potentially intercepted."
- Dev instances are capped at **100 users**; user data cannot be migrated/transferred to a production instance later — this matters if the team starts accumulating real users on the current dev instance and later needs to "graduate."
- A persistent Clerk Dashboard banner marks an instance as non-production.
- Direct implication for this app: sessions on the current dev instance already work via the querystring/dev-browser mechanism (not real first-party cookies) — this is functionally fine for local dev but is explicitly documented as not intended for a real deployed app serving actual users, independent of the 100-user cap being hit.

### 2. Production instance requirements

From [Deploy your Clerk app to production](https://clerk.com/docs/guides/development/deployment/production) and [Change domain or subdomain](https://clerk.com/docs/guides/development/deployment/changing-domains):

- You must own a domain and be able to add DNS records to it. A `*.vercel.app` domain (no DNS control given to the tenant) cannot satisfy this — **confirms the app cannot go to a Clerk production instance without acquiring a custom domain first**, regardless of the auth-architecture decision.
- Roughly five DNS records get created for a production instance, covering the Frontend API subdomain (CNAME) and email-sending/verification records (SPF/DKIM-style).
- If you can't add a CNAME for the Frontend API specifically, Clerk offers a **reverse-proxy** alternative — but this only substitutes for that one record; it does not remove the "you need a domain you control" requirement overall.
- DNS propagation can take up to 48 hours per Clerk's own guidance.
- Setting a *root* domain extends cookies/session-sharing across subdomains automatically.
- **Bottom line for the PRD's D1 decision**: since the project doesn't currently own a custom domain (per the task brief), moving to a Clerk *production* instance is blocked on acquiring one — orthogonal to, and a prerequisite ahead of, any server-side-verification work. Staying on Clerk's dev instance while adding backend JWT verification (the plan) sidesteps this domain requirement, at the cost of the dev-instance limitations in item 1.

### 3. Manual/networkless JWT verification

From [Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification) and [Session tokens](https://clerk.com/docs/guides/sessions/session-tokens):

- **JWKS URL**: `https://<your-frontend-api-domain>/.well-known/jwks.json` (per-instance), or the shared Backend API endpoint `https://api.clerk.com/v1/jwks` (requires your secret key / a live network call — Clerk's own SDK calls this the network-dependent path).
  - For this app's dev instance, that resolves to `https://driven-troll-28.clerk.accounts.dev/.well-known/jwks.json`.
- **Algorithm**: RS256 (confirmed both in prose and in the code sample `{ algorithms: ['RS256'] }`).
- **Claims to check**:
  - `exp` — expiration Unix timestamp, reject if in the past.
  - `nbf` — not-before Unix timestamp, reject if in the future.
  - `azp` (authorized parties) — should equal one of your known allowed origins; Clerk explicitly warns that skipping this check "can open your application to CSRF attacks." For a cross-origin setup this should be checked against `https://aquarius-seven.vercel.app` (and any preview-deploy origins you want to allow).
  - `iss` — issuer, equals your Frontend API URL; a straightforward instance-identity check.
  - `sub` — the Clerk user ID (maps to the app's own DB user).
  - `sid` — session ID (useful for revocation checks).
- Clerk's own backend SDKs do the RS256/JWKS verification "networklessly" once you cache/supply the PEM public key or JWKS — confirms that hand-rolling this with Node's built-in `crypto` (as the PRD's D1 plans) is a legitimate, Clerk-sanctioned approach, not working against the grain of the platform.

### 4. Session token lifetime & where it lives

From [How Clerk works — Overview](https://clerk.com/docs/guides/how-clerk-works/overview), [Same-Origin Requests](https://clerk.com/docs/request-authentication/same-origin), [How Clerk works — Cookies](https://clerk.com/docs/guides/how-clerk-works/cookies), and search-triangulated sources (Clerk blog/docs on refresh behavior):

- The session JWT itself is short-lived — **60 seconds** — and is distinct from the underlying multi-day/week *session* (the long-lived session lives server-side at Clerk; the JWT is just a signed, cacheable snapshot of it).
- Clerk's frontend SDK (Clerk.js) automatically refreshes this JWT roughly every 50 seconds (leaving ~10s buffer), and in newer "Core 3" behavior serves a cached token immediately (stale-while-revalidate) if it's within 15 seconds of expiry while a refresh happens in the background. Practical effect: application code should always call `getToken()` fresh per outgoing request rather than caching the JWT itself in app state — matches the PRD's planned D1a transport.
- **Same-origin**: the token also lives in a non-HttpOnly `__session` cookie scoped to the app's domain, auto-attached to same-origin requests.
- **Cross-origin** (this app's actual topology — Vercel frontend, Render backend, different origins): the `__session` cookie is not usable (browsers restrict cross-site cookies; Safari blocks `SameSite=None` outright without a flag), so the token must be fetched client-side via `Clerk.session.getToken()` / the React `useAuth().getToken()` hook and sent as `Authorization: Bearer <token>` — this is Clerk's own documented pattern for split-origin deployments, not a workaround the app is inventing. **Directly validates PRD decision D1a.**

### 5. Overall session lifetime settings & plan gating

From [Clerk Pricing](https://clerk.com/pricing):

- Free/Hobby plan: fixed **7-day session lifetime**, not configurable (no custom inactivity timeout or max-lifetime controls).
- Pro/Business: "Custom session lifetime" — configurable inactivity timeout and maximum lifetime.
- Free/Hobby MAU cap for *production* use is now **50,000 Monthly Retained Users** (a 2026 pricing update; older docs/blogs reference 10,000 — the current live pricing page is authoritative and supersedes those).
- Practical implication for the PRD's user-facing goal ("stays signed in across browser restarts, days later"): on the free plan this works out of the box for up to 7 days per session without any extra configuration; beyond 7 days of inactivity a re-login would be required unless the team upgrades to Pro for custom session lifetime.

### 6. Clerk JS v4 vs v5

From [Versioning overview](https://clerk.com/docs/guides/development/upgrading/versioning) and [Upgrading @clerk/clerk-js to Core 2](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2/javascript):

- Clerk ships roughly one major ("Core") version bump every ~6 months across all SDKs.
- v5 = "Core 2": mostly component/API renames (`setSession()` → `setActive()`, `Organization.create('x')` → `Organization.create({name:'x'})`, `User.update({password})` → `User.updatePassword()`, all image fields renamed to `imageUrl`), plus UX polish (no "flash of white page" during auth). A `@clerk/upgrade` CLI codemod exists to automate most of the migration.
- **Nothing found indicating v4 vs v5 changes session-token format, JWKS endpoint shape, claims, refresh cadence, or cross-origin header handling** — the fact-checked mechanics in sections 1–5 above should apply identically whether the app stays pinned to v4 or eventually moves to v5.
- **Could not confirm** an explicit EOL/unsupported date for v4/Core 1 — docs push upgrading but don't state Core 1 has stopped receiving security patches. Worth a direct question to Clerk support/community if this matters for a long-lived deployment decision, rather than assuming either "still fully supported" or "abandoned."
- **China network reachability**: no official Clerk documentation found (searched specifically) — this is an operational/network-topology fact (whether `*.clerk.accounts.dev` and Clerk's OAuth redirect domains are reachable from China), not something Clerk documents or commits to either way for any SDK version. The app's existing 2026-04-15 experience (it was "nearly abandoned... unusable on China network paths" before being made to work) remains the only evidence here and predates this research — treat as unchanged since no version-specific claims were found.

## Not verified / could not confirm

- Exact single-source doc page stating "60 second" token lifetime in Clerk's own words (triangulated across multiple Clerk-authored pages/blog instead of one authoritative quote).
- Whether the "fixed 7-day session lifetime" free-plan figure is stated identically on a dedicated session-configuration doc page (only found on the pricing/feature-comparison page).
- Explicit EOL or "no longer receiving security patches" statement for `@clerk/clerk-js` v4 / Core 1.
- Any Clerk-published statement about China network/CDN reachability for any SDK version — none exists to find.
