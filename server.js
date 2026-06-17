import http from "node:http";
import { fetch as undiciFetch, Agent } from "undici"; // bundled with Node 18+

const PORT = process.env.PORT || 3000;

const SEEK = "https://3rdparty.45.43.92.254.sslip.io/api/seekstreaming";
const DECRYPT = "https://decrypt-tmdb.vercel.app/api/decrypt";
const SUB_HOST = "https://tmdb.seeks.cloud";

// sslip.io upstream uses self-signed certs
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

async function getJSON(url, insecure = false) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await undiciFetch(url, {
      headers: { Accept: "application/json" },
      dispatcher: insecure ? insecureAgent : undefined,
      signal: ctrl.signal,
    });
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(json);
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, null && undefined);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  // GET /  → health
  if (parts.length === 0) {
    return send(res, 200, {
      status: "ok",
      endpoints: { movie: "/movie/:tmdbid", tv: "/tv/:id/:season/:episode" },
    });
  }

  // /movie/:id  ·  /tv/:id/:s/:e
  let tmdbid, season, episode;
  if (parts[0] === "movie" && parts.length === 2) {
    tmdbid = Number(parts[1]);
  } else if (parts[0] === "tv" && parts.length === 4) {
    tmdbid = Number(parts[1]);
    season = Number(parts[2]);
    episode = Number(parts[3]);
  } else {
    return send(res, 400, { status: "error", error: "Use /movie/:id or /tv/:id/:s/:e" });
  }

  if ([tmdbid, season, episode].filter((n) => n !== undefined).some((n) => !Number.isFinite(n))) {
    return send(res, 400, { status: "error", error: "Path segments must be numbers." });
  }

  // 1) seekstreaming → access_id
  const seekUrl = `${SEEK}?tmdbid=${tmdbid}${season != null ? `&s=${season}` : ""}${
    episode != null ? `&e=${episode}` : ""
  }`;
  const seek = await getJSON(seekUrl, true).catch(() => null);
  const item = seek?.data?.[0];
  if (!item?.access_id) {
    return send(res, 404, { status: "error", error: seek?.message || "No stream found." });
  }

  // 2) decrypt → stream URL + subtitles
  const dec = await getJSON(`${DECRYPT}?id=${item.access_id}&ep=video`).catch(() => null);
  const streamUrl = dec?.data?.cf;
  if (!streamUrl) {
    return send(res, 502, { status: "error", error: "Decrypt failed." });
  }

  // 3) subtitle URLs (prefix with SUB_HOST if relative)
  const subtitles = {};
  for (const [lang, p] of Object.entries(dec.data.subtitle ?? {})) {
    if (typeof p === "string") {
      subtitles[lang] = /^https?:/.test(p) ? p : `${SUB_HOST}${p.startsWith("/") ? "" : "/"}${p}`;
    }
  }

  send(res, 200, {
    status: "success",
    tmdb_id: tmdbid,
    ...(season != null ? { season, episode } : {}),
    access_id: item.access_id,
    title: item.title ?? dec.data.title ?? null,
    audio: item.audio ?? null,
    poster: item.preview_url ?? null,
    stream_url: streamUrl,
    subtitles,
  });
}

http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    send(res, 500, { status: "error", error: "Internal error." });
  });
}).listen(PORT, () => console.log(`stream-resolver listening on :${PORT}`));
