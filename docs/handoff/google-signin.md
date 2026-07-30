# Handoff — "Sign in with Google" (Gmail) as an alternate credential

Google/OIDC sign-in is a **new credential only**. It does **not** change the authorisation
model. A Google-authenticated user is matched to an **existing active** `User` by email and
receives **exactly** the JWT + `Actor` that `POST /auth/login` issues — same role, same
object-scope. There is **no auto-provisioning**: if the Google email has no matching active
user, sign-in is denied and audited.

Owner: platform-core. Files: `apps/api/src/platform/auth/google.service.ts`,
`auth.controller.ts`, `auth.service.ts` (`loginWithGoogle`), `auth.module.ts`.

---

## 1. Endpoints (both `@Public()`)

### `GET /auth/google`
- **302** redirect to Google's OAuth 2.0 consent screen.
- Scopes: `openid email profile`. `access_type=online`. `prompt=select_account`.
- Carries a **signed, short-lived `state`** (a 10-minute JWT with a nonce + purpose claim)
  for CSRF. The callback verifies it before doing anything else.
- **503** `{ "error": "google_signin_not_configured" }` if any Google env var is missing.

### `GET /auth/google/callback?code=&state=`
1. Verify `state` (signature + purpose + expiry). Bad/expired/forged → **401**.
2. Exchange `code` → tokens (server-to-server, uses `GOOGLE_CLIENT_SECRET`).
3. **Verify the Google ID token** with `OAuth2Client.verifyIdToken` against
   `GOOGLE_CLIENT_ID` (checks signature, issuer, audience — unverified claims are never
   trusted). Require `email_verified === true`.
4. Match an **existing active** `User` by email, **case-insensitively**.
5. On success → **200** `{ accessToken, actor, mfaRequired: false }` (identical shape to
   `POST /auth/login`). On first success, records the verified `googleSub` +
   `authProvider='google'` on the user (additive; never changes role or scope).
- Denials → **401**, each written to the audit log **before** throwing:
  | Case | Audit `reason` |
  |---|---|
  | email matches no user | `NO_MATCHING_USER` |
  | user has `disabledAt` | `ACCOUNT_DISABLED` |
  | user `expiresAt` is in the past | `ACCOUNT_EXPIRED` |
  | user has MFA enabled (redirect flow can't collect a 2nd factor) | `MFA_REQUIRED` |
- **503** `{ "error": "google_signin_not_configured" }` if unconfigured.

---

## 2. Environment variables (`apps/api/.env`)

Optional. If **any** of the three Google vars is unset, the endpoints answer 503 and the app
still runs. Placeholders are in `apps/api/.env.example`. **Never commit real secrets.**

```
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
WEB_ORIGIN="http://localhost:3100"   # web app origin (see integration below)
```

---

## 3. Google Cloud setup — the human must do this once

1. Go to **Google Cloud Console → APIs & Services**.
2. **OAuth consent screen**: choose **External** (or Internal for a Workspace org). Fill app
   name, support email, developer contact. Add scopes `openid`, `email`, `profile`. While in
   *Testing*, add each Gmail that may sign in (e.g. `iradyv7@gmail.com`) as a **Test user**,
   or **Publish** the app to allow any Google account.
3. **Credentials → Create Credentials → OAuth client ID → Web application**.
   - **Authorized redirect URIs**: add the **exact** `GOOGLE_CALLBACK_URL`, e.g.
     `http://localhost:3000/auth/google/callback` (and the production callback later). It must
     match byte-for-byte — Google rejects mismatches.
   - (Authorized JavaScript origins are not required for this server-side flow.)
4. Copy the generated **Client ID** and **Client secret** into `apps/api/.env` as
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Restart the API.
5. Ensure the Gmail maps to an active `User` (the seed adds `iradyv7@gmail.com` as `ceo`).

---

## 4. Frontend integration contract (Next.js) — wire it exactly like this

The API is **stateless**; the callback returns JSON, not a cookie/redirect. The web app owns
the round trip. Recommended: **redirect the top-level window** (not a hidden iframe — Google
blocks framing).

**Start** — the "Sign in with Google" button navigates the browser to the API:
```
window.location.href = `${API_ORIGIN}/auth/google`;
```
(`API_ORIGIN` = the api base, e.g. `http://localhost:3000`.) The API 302s to Google. If you
prefer a popup, open `${API_ORIGIN}/auth/google` in a popup and postMessage the result back
from the return page; the redirect approach below is simplest.

**Return** — Google redirects the browser to `GOOGLE_CALLBACK_URL`
(`/auth/google/callback`), which returns JSON `{ accessToken, actor, mfaRequired }`.
Because the browser navigated there directly, you have two clean options — **pick A**:

- **Option A (recommended): make the callback land on the web app.**
  Set `GOOGLE_CALLBACK_URL` to a **web** route that itself calls the API. i.e. point Google
  at `${WEB_ORIGIN}/auth/google/return`, and have that Next.js route/server-action forward
  the `code` + `state` to the API's `GET /auth/google/callback`, read
  `{ accessToken, actor }` from the JSON, persist the token (httpOnly cookie via a server
  action, or your existing token store), and redirect into the app.
  > If you choose this, change `GOOGLE_CALLBACK_URL` **and** the Google Console redirect URI
  > to the web route, and the web route calls the API callback server-side. The API callback
  > stays the single place that verifies the ID token and issues the app JWT.

- **Option B (as shipped): API is the redirect target.**
  Google → `http://localhost:3000/auth/google/callback` → the API returns the JSON
  `{ accessToken, actor }` directly in the browser. Fine for local testing, but the token
  ends up rendered in the API origin; you then need to hand it to the web app. Prefer A for
  production.

**Consume** — treat `accessToken` exactly like the password-login token:
`Authorization: Bearer <accessToken>` on every subsequent request. `actor` is the standard
`@uza/contracts` `Actor` (`{ userId, role, office, scope }`) — store/use it identically to
the `POST /auth/login` result. `mfaRequired` is always `false` here.

**Errors the button must handle:**
- `503 { error: "google_signin_not_configured" }` → hide/disable the Google button (creds
  not set up yet).
- `401` on the callback → the Google account is verified but **not permitted** (no matching
  active user). Show "this Google account isn't authorised — contact your administrator".

---

## 5. Security notes / limitations

- The Google ID token is **verified** (`verifyIdToken`), never trusted from raw claims. We
  require `email_verified`.
- `state` is a signed 10-minute JWT (nonce + purpose). It guarantees integrity/expiry. It is
  **not** bound to a browser session because the platform has no session store; if you later
  add server-side sessions, bind `state` to the session for full login-CSRF protection.
- MFA-enabled accounts are **refused** via Google (the redirect flow can't collect a second
  factor) and told to use password + MFA. Revisit when Google-flow MFA is designed.
- Match is by **email**. `googleSub` is recorded on first success to strengthen later logins;
  it is additive and never used to change authorisation.
