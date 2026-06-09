# Redstone on Windows PC (Option A — Cloudflare Tunnel)

Your **Windows PC** runs Ollama, `cloudflared`, and Redstone. This Mac is dev only.

## Architecture

```
Browser → redstone.deoxylabs.com → Cloudflare Tunnel → Windows PC :3000 (Next.js)
                                                              ↘ :11434 (Ollama, local)
```

## 1. On the Windows PC — prerequisites

- [Node.js 20+](https://nodejs.org)
- [Git](https://git-scm.com/download/win)
- `cloudflared` already running (you use it for `ollama.deoxylabs.com`)

## 2. Clone and build

```powershell
cd $HOME
git clone https://github.com/Spdrcrv6tt/Redstone.git
cd Redstone
copy deploy\env.production.example .env.production
# Edit .env.production — set OLLAMA_API_KEY and BRAVE_SEARCH_API_KEY
npm ci
npm run build
```

## 3. Run Redstone

```powershell
npm run start
```

Keep this running (or install as a Windows Service with NSSM — see below).

## 4. Add tunnel hostname

In **Cloudflare Zero Trust** → your tunnel → **Public Hostname**:

| Field | Value |
|-------|-------|
| Subdomain | `redstone` |
| Domain | `deoxylabs.com` |
| Service | `http://localhost:3000` |

Or add the `redstone.deoxylabs.com` block from `deploy/tunnel-ingress.example.yml` to your `config.yml`, then restart `cloudflared`.

## 5. Verify

- http://localhost:3000 — works on the PC
- https://redstone.deoxylabs.com — works from any browser

## Optional — run at boot (NSSM)

```powershell
# Install NSSM, then:
nssm install Redstone "C:\Program Files\nodejs\npm.cmd" run start
nssm set Redstone AppDirectory "C:\path\to\Redstone"
nssm set Redstone AppEnvironmentExtra "PORT=3000"
nssm start Redstone
```

Set env vars via NSSM or keep `.env.production` in the app directory.
