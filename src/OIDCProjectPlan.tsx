
import { useState } from "react";

const PHASES = [
  {
    id: 1,
    title: "Architecture Decision & Foundation",
    duration: "Week 1–2",
    color: "bg-violet-100 border-violet-400",
    headerColor: "bg-violet-400",
    tasks: [
      {
        title: "Decide where the OIDC server lives",
        detail:
          "platform-accounts has all user data but no browser-facing layer. Options: (A) Add OIDC endpoints directly to platform-accounts, (B) add them to platform-login which already calls platform-accounts, or (C) create a new oidc-provider microservice. Recommended: Option B — platform-login, since it's already the browser-facing auth service and calling platform-accounts for user data over the API key is clean.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "JWK key-pair generation & rotation strategy",
        detail:
          "Generate RSA (RS256) or EC (ES256) key pairs for signing ID tokens & access tokens. Store private keys securely (AWS Secrets Manager / KMS). Implement a kid-indexed JWKS that supports key rotation without downtime. Plan for periodic key rotation (e.g. every 90 days).",
        status: "todo",
        shopifyReq: "ID Token: RS256/ES256 signing required; HS256 not supported",
      },
      {
        title: "OAuth client registry — new DB table",
        detail:
          "Create an `oauth_clients` table with: client_id, client_secret (hashed), redirect_uris[], scopes[], token_endpoint_auth_method (default: client_secret_basic), pkce_required (bool), name, created_at. Shopify will be registered as a confidential client.",
        status: "todo",
        shopifyReq: "client_secret_basic is the default auth method",
      },
      {
        title: "Authorization code store — Redis or DB table",
        detail:
          "Short-lived (≤10 min) authorization codes keyed by `code`. Store: client_id, user_id, redirect_uri, scopes, nonce, code_challenge (for PKCE), code_challenge_method, expires_at. Redis with TTL is preferred for performance.",
        status: "todo",
        shopifyReq: "Authorization code flow required",
      },
    ],
  },
  {
    id: 2,
    title: "Core OIDC Endpoints",
    duration: "Week 2–4",
    color: "bg-blue-100 border-blue-400",
    headerColor: "bg-blue-400",
    tasks: [
      {
        title: "GET /.well-known/openid-configuration",
        detail:
          "Discovery document listing: issuer, authorization_endpoint, token_endpoint, jwks_uri, userinfo_endpoint, end_session_endpoint, scopes_supported, response_types_supported (code only), grant_types_supported, subject_types_supported, id_token_signing_alg_values_supported, token_endpoint_auth_methods_supported, claims_supported. Must respond in <1s.",
        status: "todo",
        shopifyReq: "Required endpoint — OpenID Discovery 1.0",
      },
      {
        title: "GET /.well-known/jwks.json",
        detail:
          "Return the public key set used to verify ID token signatures. Keys should include `kid`, `kty`, `alg`, `use: sig`, and the key material (n+e for RSA, x+y+crv for EC). Cache-friendly — serve with long Cache-Control headers but support key rotation. Must respond in <1s.",
        status: "todo",
        shopifyReq: "Required endpoint — RFC 7517 Section 5",
      },
      {
        title: "GET /POST /oauth/authorize",
        detail:
          "Handles the authorization request. Required params: response_type=code, client_id, redirect_uri, scope (must include openid), state. Validates client, redirects to login UI if not authenticated. After login: generates auth code, redirects back with ?code=...&state=.... Must reject implicit flow (response_type=token). For public clients: require code_challenge and code_challenge_method=S256.",
        status: "todo",
        shopifyReq: "Authorization code flow only; no implicit/hybrid",
      },
      {
        title: "POST /oauth/token",
        detail:
          "Handles code exchange and refresh. For code exchange: validate client credentials (client_secret_basic via Authorization header), verify code, verify redirect_uri, verify PKCE code_verifier if present, then issue access_token (JWT), id_token (JWT), refresh_token (opaque), expires_in. For refresh: validate refresh token, issue new tokens (rotate refresh token). Must respond in <1s.",
        status: "todo",
        shopifyReq: "RFC 6749 §4.1.3 + §6; client_secret_basic; refresh tokens",
      },
    ],
  },
  {
    id: 3,
    title: "ID Token & Claims",
    duration: "Week 3–4",
    color: "bg-emerald-100 border-emerald-400",
    headerColor: "bg-emerald-400",
    tasks: [
      {
        title: "JWT issuer — ID token generation",
        detail:
          "Build a JWT signing utility using a library like `jose` or `jsonwebtoken`. The ID token must include: sub (user UUID from platform-accounts), iss (your issuer URL), aud (client_id), iat, exp, nonce (echoed from auth request), email (from users table), email_verified (true — enforce in issuer logic). Sign with RS256 or ES256. Do NOT use HS256.",
        status: "todo",
        shopifyReq:
          "Required claims: sub, nonce, email, email_verified=true, iss, aud. No HS256.",
      },
      {
        title: "email_verified enforcement",
        detail:
          "platform-accounts already tracks email_verified_at on the users table. The OIDC layer must check this before issuing an ID token. If email_verified_at is null, block the authorization flow or require verification inline. Shopify requires email_verified=true — this cannot be false or omitted.",
        status: "todo",
        shopifyReq: "email_verified must be true",
      },
      {
        title: "sub claim — stable user identifier",
        detail:
          "Use the user UUID from platform-accounts as the sub claim. This must be stable and never recycled. Confirm with the team that user UUIDs are permanent even after deactivation/anonymization (check anonymize.ts — if sub is obfuscated on anonymization, OIDC history breaks).",
        status: "todo",
        shopifyReq: "sub: unique, stable identifier",
      },
      {
        title: "GET /userinfo endpoint",
        detail:
          "Bearer-token-protected endpoint returning the claims from the ID token at minimum (sub, email, email_verified, plus any requested scopes like profile). Call platform-accounts /api/v1/user/get with the API key to fetch fresh data. Must respond in <1s.",
        status: "todo",
        shopifyReq: "Implied by OIDC Core; needed for well-known discovery listing",
      },
    ],
  },
  {
    id: 4,
    title: "PKCE Support",
    duration: "Week 4",
    color: "bg-amber-100 border-amber-400",
    headerColor: "bg-amber-400",
    tasks: [
      {
        title: "code_challenge / code_verifier implementation",
        detail:
          "On /authorize: accept code_challenge and code_challenge_method=S256. Store the challenge with the authorization code. On /token: if code had a challenge, require code_verifier. Verify: BASE64URL(SHA256(code_verifier)) === code_challenge. Reject S256 mismatches or plain method. For public clients (no client_secret), require PKCE.",
        status: "todo",
        shopifyReq:
          "PKCE required for public clients (mobile). code_challenge_method=S256 only.",
      },
    ],
  },
  {
    id: 5,
    title: "Session & Refresh Token Lifecycle",
    duration: "Week 4–5",
    color: "bg-orange-100 border-orange-400",
    headerColor: "bg-orange-400",
    tasks: [
      {
        title: "Refresh token issuance & storage",
        detail:
          "Issue an opaque refresh token at /token time. Store in a new `oauth_refresh_tokens` table or Redis: token_hash, client_id, user_id, scopes, expires_at (90 days), used_at, revoked_at. Return in token response as refresh_token.",
        status: "todo",
        shopifyReq: "Refresh tokens required to maintain 90-day Shopify sessions",
      },
      {
        title: "Refresh token rotation",
        detail:
          "On each refresh grant: issue a new refresh_token and access_token, and revoke (or mark as used) the old refresh_token. Implement refresh token reuse detection — if an already-used token is presented, revoke the entire token family (security).",
        status: "todo",
        shopifyReq: "RFC 6749 §1.5 and §6",
      },
      {
        title: "Access token expiry & refresh flow",
        detail:
          "Access tokens should be short-lived (~1 hour, configurable). When Shopify refreshes, it calls /token with grant_type=refresh_token. Verify the refresh token, ensure it hasn't expired or been revoked, re-fetch user data from platform-accounts, issue new tokens.",
        status: "todo",
        shopifyReq: "Sessions last up to 90 days via refresh",
      },
    ],
  },
  {
    id: 6,
    title: "RP-Initiated Logout",
    duration: "Week 5",
    color: "bg-rose-100 border-rose-400",
    headerColor: "bg-rose-400",
    tasks: [
      {
        title: "GET /oauth/logout (RP-Initiated Logout 1.0)",
        detail:
          "Accepts: id_token_hint (the ID token issued to Shopify), post_logout_redirect_uri (must match registered URIs for the client), and state (echoed back). Validates the id_token_hint, ends the corresponding platform-accounts session (call /api/v1/session/end), revokes associated refresh tokens, then redirects to post_logout_redirect_uri?state=...",
        status: "todo",
        shopifyReq:
          "RP-Initiated Logout 1.0 required. Back-Channel and Front-Channel logout NOT supported.",
      },
      {
        title: "Session linkage — OIDC token ↔ platform session",
        detail:
          "At token issuance time, record the mapping between the OIDC token family and the platform-accounts sessionId. This is needed so that logout can call /api/v1/session/end with the correct sessionId. Store in the oauth_refresh_tokens table as a session_id column.",
        status: "todo",
        shopifyReq: "Required to implement logout correctly",
      },
    ],
  },
  {
    id: 7,
    title: "Security Hardening",
    duration: "Week 5–6",
    color: "bg-slate-100 border-slate-400",
    headerColor: "bg-slate-400",
    tasks: [
      {
        title: "Nonce replay attack prevention",
        detail:
          "Store issued nonces in Redis with a TTL matching the ID token lifetime. On ID token issuance, check that the nonce has not been used before. This prevents replay of captured ID tokens.",
        status: "todo",
        shopifyReq: "nonce required in ID token to prevent replay attacks",
      },
      {
        title: "State parameter validation",
        detail:
          "The state param in /authorize must be echoed back unchanged to the redirect URI. The client (Shopify) verifies it. Ensure the state is stored server-side with the auth code and not modified.",
        status: "todo",
        shopifyReq: "Standard OIDC/OAuth2 security",
      },
      {
        title: "redirect_uri strict matching",
        detail:
          "Compare redirect_uri in /authorize and /token against the registered list for the client. Use exact string matching (no prefix/wildcard). Reject mismatches with error=invalid_request.",
        status: "todo",
        shopifyReq: "Standard OAuth2 security requirement",
      },
      {
        title: "Response time SLO — <1s for token, discovery, userinfo",
        detail:
          "Shopify requires these three endpoints to respond within 1 second. Profile each endpoint under realistic load. Ensure JWKS is cached in memory (not fetched from DB per request), user lookups hit the Redis session cache, and the DB query for user data is indexed on id.",
        status: "todo",
        shopifyReq: "Timeouts will break login flow",
      },
    ],
  },
  {
    id: 8,
    title: "Shopify UX Integration Strategy",
    duration: "Week 6–7",
    color: "bg-cyan-100 border-cyan-400",
    headerColor: "bg-cyan-400",
    tasks: [
      {
        title: "Understand the flow direction: you are the IdP, Shopify is the RP",
        detail:
          "The OIDC flow does NOT originate on Shopify's website from the user's perspective. Your system is the Identity Provider. When a user hits Shopify checkout without a Shopify customer session, Shopify initiates the OIDC flow by redirecting the browser to your /oauth/authorize. Your server checks if the user already has a session → if yes, it immediately issues an auth code and redirects back to Shopify with no login prompt shown. The user experiences this as a fast, invisible redirect chain (~200ms). They never see a Shopify login page.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "Handle the already-authenticated case in /oauth/authorize",
        detail:
          "This is the critical implementation detail. When Shopify redirects to your /oauth/authorize, the endpoint must read your existing session cookie (set by platform-login). If a valid session exists: skip login UI entirely, generate auth code, redirect back to Shopify immediately. If no session: redirect to your login page, then back to /oauth/authorize after login completes. This is what makes the SSO seamless — users who are already logged into your site never see a login screen.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "Deep-link to bypass Shopify's interstitial screen",
        detail:
          "By default, Shopify may show a brief 'Sign in' interstitial page before redirecting to your IdP. To skip this entirely, link users directly to Shopify's OIDC authorization initiation URL (provided by Shopify during IdP setup) rather than to the generic checkout URL. This takes the user straight from your site → your /oauth/authorize → back to Shopify checkout, with no Shopify-branded screen in between. Confirm the exact URL format with Shopify when registering your IdP.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "Pre-authentication with prompt=none (silent SSO)",
        detail:
          "For the smoothest possible checkout experience, pre-authenticate users with Shopify before they even reach checkout. When a user logs into your site (or views a product page / adds to cart), initiate the OIDC flow in the background using prompt=none — a standard OIDC parameter that instructs your IdP to return a code immediately if the user is already logged in, without showing any UI. Shopify gets their customer session proactively, so by the time they hit checkout, the handoff has already happened. Confirm whether Shopify supports initiating prompt=none requests, or whether your frontend needs to trigger this directly.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "Define the pre-auth trigger point in the user journey",
        detail:
          "Decide at what point in the user journey to trigger pre-authentication. Options in order of earliness: (1) On login — immediately after user logs into your site; (2) On product page view — signals purchase intent; (3) On add-to-cart — strong purchase signal, still before checkout; (4) On checkout entry — last resort, works but may add a visible redirect. Earlier is better for UX. Recommended: trigger on add-to-cart as a balance between coverage and avoiding unnecessary OIDC calls for users who are just browsing.",
        status: "todo",
        shopifyReq: null,
      },
    ],
  },
  {
    id: 9,
    title: "Testing & Shopify Integration",
    duration: "Week 6–8",
    color: "bg-teal-100 border-teal-400",
    headerColor: "bg-teal-400",
    tasks: [
      {
        title: "Unit tests for JWT issuance & validation",
        detail:
          "Test: correct claims are set, wrong algorithm is rejected, expired tokens fail validation, nonce is present, email_verified is always true or token is not issued.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "Integration tests for the full authorization code flow",
        detail:
          "End-to-end test: authorize → login → code redirect → token exchange → userinfo → refresh → logout. Use a test client registered in the DB. Assert all response shapes match OIDC spec.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "PKCE-specific test suite",
        detail:
          "Test: code_challenge present but no code_verifier → rejected. Wrong code_verifier → rejected. plain method → rejected. Correct S256 code_verifier → accepted.",
        status: "todo",
        shopifyReq: "PKCE for mobile/public clients",
      },
      {
        title: "Register Shopify as an OIDC client",
        detail:
          "In staging: create an oauth_clients record for Shopify's redirect URIs, store client_id and hashed client_secret. Share credentials with Shopify. Test the full flow end-to-end with a dev store.",
        status: "todo",
        shopifyReq: null,
      },
      {
        title: "OpenID Connect conformance testing (optional but recommended)",
        detail:
          "Run the OpenID Foundation's conformance test suite (https://openid.net/certification) against your server in a test environment. This catches edge cases in spec compliance before Shopify integration.",
        status: "todo",
        shopifyReq: "Recommended — How to Certify Your Implementation",
      },
    ],
  },
];

const GAPS = [
  {
    req: "OAuth 2.0 authorization code flow",
    current: "Opaque session UUIDs via /api/v1/session/start",
    gap: "No /authorize or /token endpoints exist anywhere",
    severity: "critical",
  },
  {
    req: "PKCE (code_challenge + S256)",
    current: "Not implemented",
    gap: "Needs code_challenge storage and verification in auth code flow",
    severity: "critical",
  },
  {
    req: "OIDC Discovery (/.well-known/openid-configuration)",
    current: "Not present",
    gap: "New endpoint required",
    severity: "critical",
  },
  {
    req: "JWKS endpoint (/.well-known/jwks.json)",
    current: "Not present — no JWTs issued at all",
    gap: "Need key generation, management, and JWKS serving",
    severity: "critical",
  },
  {
    req: "ID tokens (JWT with sub, nonce, email, email_verified, iss, aud)",
    current: "Sessions are opaque UUIDs, no JWTs",
    gap: "Full JWT issuance layer required",
    severity: "critical",
  },
  {
    req: "email_verified = true",
    current: "email_verified_at column exists on users table ✓",
    gap: "Must gate ID token issuance on email_verified_at being non-null",
    severity: "medium",
  },
  {
    req: "Refresh tokens (90-day sessions)",
    current: "platform-accounts sessions last configurable days already",
    gap: "Need RFC 6749 refresh_token grant in the new token endpoint",
    severity: "critical",
  },
  {
    req: "RP-Initiated Logout 1.0",
    current: "/api/v1/session/end exists ✓ — but it's API-key gated, not OIDC",
    gap: "Need /oauth/logout accepting id_token_hint and post_logout_redirect_uri",
    severity: "critical",
  },
  {
    req: "Token endpoint response < 1s",
    current: "No token endpoint yet",
    gap: "Must design for performance from the start; Redis session cache helps",
    severity: "medium",
  },
  {
    req: "RS256/ES256 signing (no HS256)",
    current: "No JWTs issued",
    gap: "Need asymmetric key pair generation and storage strategy",
    severity: "critical",
  },
];

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border border-red-300",
  medium: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  low: "bg-green-100 text-green-800 border border-green-300",
};


function Task({
  task,
}: {
  task: {
    title: string;
    detail: string;
    status: string;
    shopifyReq: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="mt-0.5 text-slate-400">{open ? "▾" : "▸"}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-slate-800">{task.title}</div>
          {task.shopifyReq && (
            <div className="text-xs text-indigo-600 mt-0.5 truncate">
              Shopify req: {task.shopifyReq}
            </div>
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
          {task.detail}
        </div>
      )}
    </div>
  );
}

function Phase({ phase }: { phase: (typeof PHASES)[0] }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`rounded-xl border-2 ${phase.color} overflow-hidden mb-5`}>
      <button
        className={`w-full flex items-center justify-between px-5 py-3 ${phase.headerColor} text-white`}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">Phase {phase.id}</span>
          <span className="font-semibold">{phase.title}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="bg-white/20 rounded-full px-3 py-0.5">{phase.duration}</span>
          <span>{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>
      {!collapsed && (
        <div className="p-4">
          {phase.tasks.map((t) => (
            <Task key={t.title} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

type TabId = "plan" | "gaps" | "arch";

export default function OIDCProjectPlan() {
  const [tab, setTab] = useState<TabId>("plan");

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-block bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
            platform-accounts → Shopify OIDC
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            OIDC Compliance Project Plan
          </h1>
          <p className="text-slate-500 text-base">
            Roadmap to meet{" "}
            <a
              href="https://help.shopify.com/en/manual/customers/customer-accounts/sign-in-options/identity-provider/requirements"
              className="text-indigo-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              Shopify's identity provider requirements
            </a>
            {" "}— 9 phases across ~9 weeks.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-lg w-fit">
          {(
            [
              { id: "plan", label: "Implementation Phases" },
              { id: "gaps", label: "Gap Analysis" },
              { id: "arch", label: "Architecture Notes" },
            ] as { id: TabId; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Implementation Phases */}
        {tab === "plan" && (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Phases", value: "9", color: "text-indigo-600" },
                { label: "Total Tasks", value: PHASES.flatMap((p) => p.tasks).length.toString(), color: "text-blue-600" },
                { label: "Est. Timeline", value: "~9 weeks", color: "text-emerald-600" },
                { label: "Critical Gaps", value: GAPS.filter((g) => g.severity === "critical").length.toString(), color: "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {PHASES.map((phase) => (
              <Phase key={phase.id} phase={phase} />
            ))}
          </div>
        )}

        {/* Gap Analysis */}
        {tab === "gaps" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">
                Current State vs. Shopify Requirements
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Based on analysis of platform-accounts (Fastify + Postgres + Redis). The service currently uses opaque session UUIDs — no OIDC or JWT layer exists.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full px-6">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="text-left py-3 px-6">Shopify Requirement</th>
                    <th className="text-left py-3 px-3">Current State</th>
                    <th className="text-left py-3 px-3">Gap</th>
                    <th className="text-left py-3 px-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {GAPS.map((g) => (
                    <tr key={g.req} className="hover:bg-slate-50">
                      <td className="py-3 px-6 font-medium text-sm">{g.req}</td>
                      <td className="py-3 px-3 text-sm text-slate-600">{g.current}</td>
                      <td className="py-3 px-3 text-sm">{g.gap}</td>
                      <td className="py-3 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SEV_COLORS[g.severity]}`}>
                          {g.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Architecture Notes */}
        {tab === "arch" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Recommended Architecture</h2>
              <div className="font-mono text-sm bg-slate-900 text-slate-100 rounded-lg p-4 leading-7">
                <div className="text-slate-400">{"// Browser / Shopify"}</div>
                <div>Shopify store</div>
                <div className="text-amber-400 ml-4">↓ GET /oauth/authorize?response_type=code&client_id=shopify...</div>
                <div className="mt-2 text-slate-400">{"// New OIDC layer (add to platform-login or new service)"}</div>
                <div>platform-login <span className="text-emerald-400">[OIDC server — NEW endpoints]</span></div>
                <div className="text-slate-400 ml-4">/.well-known/openid-configuration</div>
                <div className="text-slate-400 ml-4">/.well-known/jwks.json</div>
                <div className="text-slate-400 ml-4">/oauth/authorize  /oauth/token  /oauth/logout  /userinfo</div>
                <div className="text-amber-400 ml-4">↓ calls platform-accounts over internal API key</div>
                <div className="mt-2 text-slate-400">{"// Existing service — minimal changes needed"}</div>
                <div>platform-accounts <span className="text-blue-400">[user/session backend — mostly unchanged]</span></div>
                <div className="text-slate-400 ml-4">POST /api/v1/session/start → create internal session</div>
                <div className="text-slate-400 ml-4">POST /api/v1/session/end → revoke on OIDC logout</div>
                <div className="text-slate-400 ml-4">GET  /api/v1/user/get → fetch claims for ID token</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">platform-accounts Changes Required</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2"><span className="text-emerald-500 font-bold mt-0.5">✓</span><span><strong>email_verified_at already tracked</strong> — just needs to be surfaced in userinfo/ID token claims.</span></li>
                <li className="flex gap-2"><span className="text-emerald-500 font-bold mt-0.5">✓</span><span><strong>session/end already exists</strong> — OIDC logout can call this after revoking OIDC tokens.</span></li>
                <li className="flex gap-2"><span className="text-amber-500 font-bold mt-0.5">~</span><span><strong>anonymize.ts</strong> — Verify that anonymizing a user doesn't change their UUID (the sub claim). If it does, Shopify's account linkage will break. Check and potentially exclude the id field from anonymization.</span></li>
                <li className="flex gap-2"><span className="text-red-500 font-bold mt-0.5">✗</span><span><strong>No new OIDC tables needed in platform-accounts</strong> — oauth_clients, authorization_codes, oauth_refresh_tokens should live in the OIDC layer's own database or schema.</span></li>
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Key Library Recommendations</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { pkg: "jose", use: "JWT/JWK signing & verification (RS256, ES256). JOSE-compliant, maintained by Panva." },
                  { pkg: "oidc-provider", use: "Full-featured OIDC server for Node. Handles spec compliance, but heavy — evaluate if it fits your Fastify setup." },
                  { pkg: "@panva/hkdf", use: "Key derivation if needed for session encryption." },
                  { pkg: "pkce-challenge", use: "Lightweight PKCE code_challenge/verifier helpers." },
                ].map((l) => (
                  <div key={l.pkg} className="border border-slate-200 rounded-lg p-3">
                    <div className="font-mono font-semibold text-indigo-700">{l.pkg}</div>
                    <div className="text-slate-600 mt-1">{l.use}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">User Journey — What the User Actually Experiences</h2>
              <div className="font-mono text-sm bg-slate-900 text-slate-100 rounded-lg p-4 leading-8">
                <div className="text-emerald-400">1. User logs into your site normally</div>
                <div className="text-emerald-400">2. User browses, adds to cart</div>
                <div className="text-slate-400 ml-4 text-xs">{"// Optional: silent pre-auth fires here with prompt=none (invisible)"}</div>
                <div className="text-emerald-400">3. User clicks "Checkout"</div>
                <div className="text-slate-400 ml-4 text-xs">{"// You deep-link to Shopify's OIDC initiation URL (skips Shopify's login screen)"}</div>
                <div className="text-amber-400 ml-4">→ Shopify redirects browser to your /oauth/authorize</div>
                <div className="text-amber-400 ml-4">→ Your server sees active session → issues auth code immediately</div>
                <div className="text-amber-400 ml-4">→ Browser redirected back to Shopify with ?code=...</div>
                <div className="text-amber-400 ml-4">→ Shopify exchanges code at your /token (server-to-server)</div>
                <div className="text-amber-400 ml-4">→ Shopify matches/creates customer account via email from ID token</div>
                <div className="text-emerald-400">4. User lands on Shopify checkout — already authenticated</div>
                <div className="text-slate-400 ml-4 text-xs">{"// Steps 3→4 take ~200ms and are invisible to the user"}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-2">Silent SSO — prompt=none</h2>
              <p className="text-sm text-slate-600 mb-3">For the best UX, pre-authenticate with Shopify <em>before</em> the user hits checkout. Your <code className="bg-slate-100 px-1 rounded">/oauth/authorize</code> endpoint must support the <code className="bg-slate-100 px-1 rounded">prompt=none</code> parameter per OIDC Core §3.1.2.1. If the user has a session → return code immediately. If not → return <code className="bg-slate-100 px-1 rounded">error=login_required</code> (no UI shown either way).</p>
              <div className="grid grid-cols-4 gap-2 text-xs text-center">
                {[
                  { trigger: "On login", ux: "Best", note: "Maximizes coverage" },
                  { trigger: "Product view", ux: "Great", note: "Likely purchase intent" },
                  { trigger: "Add to cart", ux: "Good", note: "Strong intent signal" },
                  { trigger: "Checkout entry", ux: "OK", note: "Visible redirect fallback" },
                ].map((r) => (
                  <div key={r.trigger} className="border border-slate-200 rounded-lg p-2">
                    <div className="font-semibold text-slate-700">{r.trigger}</div>
                    <div className="text-indigo-600 font-bold mt-1">{r.ux}</div>
                    <div className="text-slate-500 mt-0.5">{r.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="font-semibold text-amber-900 mb-2">⚠ Watch out: anonymize.ts</h2>
              <p className="text-sm text-amber-800">
                The currently open file <code className="bg-amber-100 px-1 rounded">src/api/user/anonymize.ts</code> likely nullifies or randomizes user data. If it ever changes or hashes the user's UUID (<code className="bg-amber-100 px-1 rounded">id</code>), the OIDC <code className="bg-amber-100 px-1 rounded">sub</code> claim will become invalid for any existing Shopify customer account linked to that user. Confirm this is not the case before going live.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
