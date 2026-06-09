# Windows deployment runbook — for Cursor agent

**Give this file to your Cursor agent on the Windows PC and say:**
> Follow `deploy/WINDOWS_AGENT_RUNBOOK.md` end-to-end. Deploy Redstone at https://redstone.deoxylabs.com via the existing Cloudflare tunnel. Do not stop until verified.

---

## Context (read first)

| Fact | Detail |
|------|--------|
| **This machine** | Windows PC — production host |
| **Dev machine** | Mac — not involved in hosting |
| **Ollama** | Runs locally on this Windows PC (`127.0.0.1:11434`) |
| **Existing tunnel** | `ollama.deoxylabs.com` → localhost:11434 (already works) |
| **Goal** | Add `redstone.deoxylabs.com` → localhost:3000 |
| **Repo** | https://github.com/Spdrcrv6tt/Redstone (branch `main`) |
| **Stack** | Next.js 16 — requires `npm run build` + `npm run start` (Node server, not static) |

**Critical:** `.env.production` must use `OLLAMA_HOST=http://127.0.0.1:11434` — NOT `https://ollama.deoxylabs.com`. Ollama is on the same box; routing through the public tunnel URL is wrong and slower.

**Never commit:** `.env.production`, `.env.local`, or any file containing API keys.

---

## Phase 0 — Prerequisites (verify before coding)

Run these checks. Fix anything missing before continuing.

```powershell
node -v          # need v20+
npm -v
git --version
cloudflared --version
curl http://127.0.0.1:11434/api/tags -H "Authorization: Bearer YOUR_KEY"  # Ollama reachable?
```

Ask the user for if not already known:
1. **OLLAMA_API_KEY** — Bearer token for Ollama (same one used for the tunnel)
2. **BRAVE_SEARCH_API_KEY** — from https://brave.com/search/api/
3. **Where to clone** — e.g. `C:\Users\<name>\Redstone` or `C:\Apps\Redstone`
4. **How cloudflared runs** — Windows service, scheduled task, or manual? (needed to restart after config change)

---

## Phase 1 — Get the code

```powershell
# If not cloned yet:
cd $HOME
git clone https://github.com/Spdrcrv6tt/Redstone.git
cd Redstone

# If already cloned:
cd C:\path\to\Redstone   # adjust
git pull origin main
```

Confirm `deploy/WINDOWS_AGENT_RUNBOOK.md` exists (this file).

---

## Phase 2 — Production environment

```powershell
cd C:\path\to\Redstone

# Create env file if missing
if (-not (Test-Path .env.production)) {
  Copy-Item deploy\env.production.example .env.production
}
```

Edit `.env.production` — must contain:

```env
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_API_KEY=<from user>
BRAVE_SEARCH_API_KEY=<from user>
PORT=3000
```

**Do not** put these values in git. Confirm `.env.production` is gitignored.

---

## Phase 3 — Build

```powershell
cd C:\path\to\Redstone
npm ci
npm run build
```

Build must exit 0. If it fails, fix errors — do not proceed.

---

## Phase 4 — Run Redstone (test locally)

```powershell
cd C:\path\to\Redstone
npm run start
```

In another terminal:

```powershell
curl http://localhost:3000 -UseBasicParsing | Select-Object StatusCode
# Expect 200
```

Leave `npm run start` running for Phase 5. Stop with Ctrl+C only after public URL is verified, unless installing NSSM service.

---

## Phase 5 — Cloudflare tunnel (add hostname)

Redstone must be reachable at `redstone.deoxylabs.com`. Use **one** of these methods:

### Method A — Cloudflare dashboard (preferred if user has Zero Trust access)

1. Go to https://one.dash.cloudflare.com → **Networks** → **Tunnels**
2. Open the tunnel that serves `ollama.deoxylabs.com`
3. **Public Hostname** → Add:
   - **Subdomain:** `redstone`
   - **Domain:** `deoxylabs.com`
   - **Type:** HTTP
   - **URL:** `localhost:3000`
4. Save. No DNS record needed manually — tunnel creates it.

### Method B — Edit `config.yml` (if tunnel is file-driven)

Typical Windows path: `%USERPROFILE%\.cloudflared\config.yml`

Merge from `deploy/tunnel-ingress.example.yml`. Final `ingress` must include **before** any catch-all:

```yaml
ingress:
  - hostname: ollama.deoxylabs.com
    service: http://127.0.0.1:11434
  - hostname: redstone.deoxylabs.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Restart cloudflared after editing:

```powershell
# If installed as Windows service:
Restart-Service cloudflared
# Or find the user's usual restart method (Services.msc, task, etc.)
```

Ask the user how they restart `cloudflared` if unsure.

---

## Phase 6 — Verify public URL

```powershell
curl https://redstone.deoxylabs.com -UseBasicParsing | Select-Object StatusCode
```

Browser check: open https://redstone.deoxylabs.com — landing page loads.

Send a test chat message — confirm streaming response works (proves Ollama + Brave paths).

---

## Phase 7 — Run at boot (recommended)

So Redstone survives reboots. Use **NSSM** (Non-Sucking Service Manager):

```powershell
# Download NSSM from https://nssm.cc if not installed
# Adjust paths:

$AppDir = "C:\path\to\Redstone"
$Npm = "C:\Program Files\nodejs\npm.cmd"

nssm install Redstone $Npm "run" "start"
nssm set Redstone AppDirectory $AppDir
nssm set Redstone AppStdout "$AppDir\logs\stdout.log"
nssm set Redstone AppStderr "$AppDir\logs\stderr.log"
New-Item -ItemType Directory -Force -Path "$AppDir\logs"
nssm start Redstone
```

`.env.production` in `$AppDir` is loaded automatically by Next.js in production.

Verify after NSSM install:

```powershell
Get-Service Redstone
curl http://localhost:3000 -UseBasicParsing | Select-Object StatusCode
```

---

## Phase 8 — Report back to user

When done, summarize:

- [ ] Repo path on Windows
- [ ] `npm run build` succeeded
- [ ] http://localhost:3000 works
- [ ] https://redstone.deoxylabs.com works
- [ ] Test message streamed from model
- [ ] Persistent service installed (NSSM) or manual start documented
- [ ] Secrets only in `.env.production`, not in git

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `localhost:3000` fails | Redstone not running — `npm run start` or NSSM service |
| Public URL 502 / error | Tunnel points wrong port, or Redstone down; check cloudflared logs |
| Chat errors "Ollama" | Wrong `OLLAMA_HOST` — must be `http://127.0.0.1:11434` on this PC |
| 401 on Ollama | `OLLAMA_API_KEY` wrong in `.env.production` |
| No web search | `BRAVE_SEARCH_API_KEY` missing in `.env.production` |
| Build fails | Run on Windows after `git pull`; Node 20+ required |

---

## What NOT to do

- Do not deploy from the Mac
- Do not use Cloudflare Pages (app needs Node API routes)
- Do not set `OLLAMA_HOST=https://ollama.deoxylabs.com` on the Windows server
- Do not commit `.env.production` or API keys
- Do not force-push `main`

---

## Quick script

Alternatively run `scripts\production-setup.ps1` after creating `.env.production`, then complete Phases 4–7 manually.
