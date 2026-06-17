# Stream Resolver API

One file, zero dependencies, no framework. Resolves a TMDB id to a stream URL + subtitles.

## Endpoints

| Method | Path                       | Description    |
|--------|----------------------------|----------------|
| GET    | `/`                        | Health check   |
| GET    | `/movie/:tmdbid`           | Movie          |
| GET    | `/tv/:id/:season/:episode` | Series episode |

### Response

```json
{
  "status": "success",
  "tmdb_id": 299536,
  "access_id": "5lf8",
  "title": "299536.mkv",
  "audio": "Hindi+Multi AAC",
  "poster": "https://asset.seekstreaming.info/.../poster.png",
  "stream_url": "https://slt.floravon.space/v4/c5u/5lf8/cf-master.1763365766.txt",
  "subtitles": {
    "English": "https://tmdb.seeks.cloud/.../adQQJf.srt#en"
  }
}
```

For series, `season` and `episode` are also included.

## Deploy on Coolify

1. Push `server.js`, `package.json`, and `nixpacks.toml` to a git repo (GitHub / Gitea / any git server Coolify can reach).
2. In Coolify: **+ New Resource → Application** → pick your repo.
3. **Build Pack**: Nixpacks (default). Coolify auto-detects Node and uses `nixpacks.toml` for the Node 22 pin.
4. **Port**: set to `3000` (under **Ports & Storages**).
5. Optionally set a domain under **Domains** (e.g. `api.yourdomain.com`) — Coolify auto-issues Let's Encrypt TLS.
6. Click **Deploy**. Done. Auto-redeploys on every git push.

No Dockerfile needed. Nixpacks handles the build.

## Run locally

```bash
node server.js            # → listening on :3000
PORT=8080 node server.js  # custom port
```

## Files

```
server.js       ← the whole API (114 lines)
package.json    ← 0 deps, just declares `npm start`
nixpacks.toml   ← pins Node 22 for Coolify/Nixpacks
```
