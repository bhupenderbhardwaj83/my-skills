# Security — what the skill guarantees and what each app must keep

The components are built so the safe way is the default. Apps stay safe when they keep these rules.
Run `python3 scripts/security_check.py <app>` before calling any app finished; fix every HIGH.

## Contents
1. Already handled by the components
2. Front-end rules
3. Backend rules (FastAPI)
4. Content Security Policy
5. Embeds, links and files
6. Desktop apps (Tauri / Electron)

## 1. Already handled by the components

| Risk | How it is handled |
|---|---|
| HTML / script injection (XSS) | Everything renders as React text. `AiAssistant`'s formatter builds elements, never HTML. The only `dangerouslySetInnerHTML` is the constant `themeInitScript`. `calm.js` builds DOM nodes, no HTML strings. |
| Spreadsheet formula injection | CSV export prefixes `= + - @ tab CR` cells with `'` (numbers stay numbers) — `DataTable`, `calm.js`, and `csv_cell` in the FastAPI example. |
| Unsafe embeds | `VideoTip` plays only same-origin/https `.mp4`/`.webm` or allow-listed hosts (youtube-nocookie, Vimeo, Loom) in a sandboxed iframe; nothing loads until ▶. |
| Unsafe links | `HelpTip` "Learn more" accepts only `https://` or same-site paths, opens with `rel="noopener noreferrer"`. |
| Tokens leaking to other sites | `api.ts` refuses absolute URLs as paths, sends cookies same-origin unless told otherwise, takes bearer tokens from a callback. |
| CSRF | `api.ts` copies the CSRF cookie into `X-CSRF-Token` on writes; the example backend checks it with `compare_digest`. |
| Requests that hang / leak | Timeouts cover the whole body; Stop and unmount abort and close streams. |
| What's stored in the browser | Only UI preferences (theme, folds, widths, dismissed tips, recent commands) and — if `remember` — assistant chat history. Never tokens. |

## 2. Front-end rules

- **Render data as text.** Never put user, server or AI content into `innerHTML`,
  `dangerouslySetInnerHTML`, `document.write` or `eval`. If rich HTML is truly needed (CMS
  content), sanitise with DOMPurify on render, and say so in a comment.
- **URLs from data**: allow only `https:` (and same-site paths) before using them in `href`,
  `src` or `window.open`; block `javascript:` and `data:`. Use `new URL(x, location.origin)`.
- **No secrets in the browser bundle.** Anything in `NEXT_PUBLIC_*` / `VITE_*` is public. API
  keys for AI or payment providers live on the server; the browser calls your backend.
- **No tokens in localStorage/sessionStorage.** Prefer an HttpOnly, Secure, SameSite cookie
  session; otherwise keep the token in memory and refresh it.
- **Assistant history** stays in this browser only. Pass `remember={false}` when chats may
  contain personal or confidential data, or on shared computers.
- **Don't log secrets** or personal data to the console; strip them from error reports.
- **Authorisation is the server's job.** Hiding a button is UX, not security — the API must
  check every request.
- **Dependencies**: no new packages for things the components already do; pin versions; run
  `pnpm audit` / `npm audit` before release.

## 3. Backend rules (FastAPI)

- CORS: exact origins only (`allow_origins=["https://app.example.com"]`); never `*` with
  `allow_credentials=True`. Limit `allow_headers` to what the client sends.
- Validate everything with Pydantic and bound it: string lengths, list sizes, page size ≤ 200,
  `extra="forbid"`. Sort/filter fields are `Literal` allow-lists.
- SQL only through bound parameters (SQLAlchemy expressions). No f-strings, `%` or `.format()`.
- Check ownership on every read and write (`WHERE owner_id = :user`), not just "is signed in".
- Cookies: `httponly=True, secure=True, samesite="lax"` for sessions (the CSRF cookie is the
  one deliberate non-HttpOnly cookie).
- Errors: generic message + reference id to the client; details to the log.
- Rate-limit costly endpoints (AI, exports, sign-in). The example's in-process limiter suits
  one server; use the proxy or Redis behind several workers.
- Uploads: check size and type, store outside the web root under generated names, never trust
  the client's filename; resolve paths and confirm they stay inside the upload folder.
- Docs (`/docs`, `/openapi.json`) off in production unless the API is public.
- Local sidecars (Tauri/Electron): bind `127.0.0.1`, require a per-launch token header.
- Secrets from the environment or a secret manager; `.env` files in `.gitignore`.

## 4. Content Security Policy

Serve the site with a CSP. Next.js (`next.config.js` headers, or middleware with a nonce):

```
default-src 'self'; script-src 'self' 'sha256-<themeInitScript hash>'; style-src 'self' 'unsafe-inline';
img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https://api.example.com;
frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```
- Hash for the theme script: `node -e "const {themeInitScript}=require('./theme-init');console.log(require('crypto').createHash('sha256').update(themeInitScript).digest('base64'))"`
  (or use a per-request nonce with Next.js middleware). Dev mode needs `'unsafe-eval'`; production doesn't.
- `frame-src` lists exactly the video hosts you use; drop it if there are no embeds.
- Also send `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  and HSTS over https. The FastAPI example does this for the API.

## 5. Embeds, links and files

- Training videos: `VideoTip` (host allow-list + sandbox + nothing loads before ▶). Add hosts to
  `EMBED_HOSTS` deliberately; never accept an arbitrary embed URL from data.
- Downloads: build files from data with `Blob` + `URL.createObjectURL`, revoke after use;
  sanitise filenames (`downloadFrom` does).
- Third-party assets (icons, fonts, videos): licensed for the use, credited where required.

## 6. Desktop apps (Tauri / Electron)

- **Least privilege.** Tauri capabilities list only what the UI calls (no `fs:*`, no shell); Electron
  uses `contextIsolation`, no `nodeIntegration`, a typed preload bridge.
- **Strict CSP** in production: `script-src 'self'`, `object-src 'none'`, `connect-src` only the
  app's own services; `freezePrototype` on.
- **Local services** (a Python sidecar) bind to `127.0.0.1` only, require a random token stored with
  0600 permissions and compared with `hmac.compare_digest`, cap upload sizes, allow-list CORS
  origins, and never log request bodies.
- **Files.** Every command that takes a path checks the extension allow-list and a size cap,
  canonicalises and keeps it inside its folder (decks, assets), and refuses symlinks out. Prefer
  paths the user picked or dropped in this session for reads outside the app's folders. Names
  from users are made safe (no `/ \ : * ? " < > |`, no leading dots). Writes are atomic
  (write temp → rename).
- **Untrusted files** (workbooks, archives) are size-checked from their directory before
  unpacking (zip bombs), parsed with safe libraries, and never executed.
- **Updates and installs** are signed (and notarised on macOS when possible); installers use HTTPS
  downloads from each project's own site and verify what they fetch.
- **Privacy.** No microphone / screen / camera without the user asking; no telemetry unless opted in;
  AI local by default — cloud providers only when the user connects them.
