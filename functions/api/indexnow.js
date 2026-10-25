// IndexNow 送信（indexnow_build.py が自動で作るファイル。直接編集しない）
const KEY = "c14b5ad469db963c4acc03de2ff158c2";
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const days = parseInt(url.searchParams.get("days") || "0", 10);
  const cache = caches.default;
  const ck = new Request(url.origin + "/api/indexnow?all=" + (all ? 1 : 0) + "&days=" + days);
  const hit = await cache.match(ck);
  if (hit) return hit;
  const sm = await fetch(url.origin + "/sitemap.xml", { cf: { cacheTtl: 0 } }).then(r => r.text());
  const items = [...sm.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(m => ({ loc: m[1], mod: m[2] }));
  let list;
  if (all) list = items;
  else if (days > 0) {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    list = items.filter(x => x.mod >= since);
  } else {
    const latest = items.reduce((a, x) => x.mod > a ? x.mod : a, "");
    list = items.filter(x => x.mod === latest);
  }
  const urls = list.map(x => x.loc).slice(0, 10000);
  let status = 0, body = "";
  if (urls.length) {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: url.hostname, key: KEY, keyLocation: url.origin + "/" + KEY + ".txt", urlList: urls })
    });
    status = r.status; body = (await r.text()).slice(0, 300);
  }
  const res = new Response(JSON.stringify({ sent: urls.length, status, body, sample: urls.slice(0, 5) }, null, 1), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
  await cache.put(ck, res.clone());
  return res;
}
