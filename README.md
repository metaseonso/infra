# infra

Infrastructure for Seonso projects. Public on purpose: nothing secret is in this repository.
Secrets live only in GitHub secrets; logs print no data (Cloudflare answers are age-encrypted to the Summoner's key).

| What | Where |
|---|---|
| Cloudflare API calls | `.github/workflows/cloudflare.yml` |
| Outside watcher (Cloudflare Worker, every 2 min) | `watcher/worker.js`, deployed by `.github/workflows/watcher.yml` |

The watcher checks https://circle.mushin.space/health from outside the server and tells the Summoner through
the Circle bot when the server goes dark, when it is back, and when it restarted by itself.
