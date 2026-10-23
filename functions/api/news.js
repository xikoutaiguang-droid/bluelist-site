// 自動生成：news_build.py（直接書き換えない）
const FEEDS = [{"name": "JFA公式", "url": "https://www.jfa.jp/samuraiblue/news/", "kind": "jfa", "all": true}, {"name": "サッカーキング", "url": "https://www.soccer-king.jp/RSS.rdf", "kind": "rss"}, {"name": "ゲキサカ", "url": "https://web.gekisaka.jp/feed", "kind": "rss"}, {"name": "Football ZONE", "url": "https://www.football-zone.net/feed", "kind": "rss"}];
const INCLUDE = new RegExp("日本代表|森保|サムライブルー|SAMURAI BLUE|A代表");
const EXCLUDE = new RegExp("なでしこ|女子|U-?\\d{2}|フットサル|ビーチ|eスポーツ|ｅスポーツ|パラ|ブラインド|デフ");
const UA = "Mozilla/5.0 (compatible; BLUELIST-news/1.0; +https://bluelist-jp.com/about)";
const TTL = 1800;

const ENT = {amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "};
function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ").trim();
}
function tag(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp("<" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + n + ">", "i"));
    if (m) return decode(m[1]);
  }
  return "";
}
function toTime(s) {
  if (!s) return 0;
  const m = s.match(/(\d{4})[.\/年-](\d{1,2})[.\/月-](\d{1,2})/);
  const t = Date.parse(s);
  if (!isNaN(t)) return t;
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600e3 : 0;
}
function abs(href, base) {
  try { return new URL(href, base).href; } catch (e) { return ""; }
}

function parseRss(xml, feed) {
  const out = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const title = tag(b, ["title"]);
    let link = tag(b, ["link"]);
    if (!link) { const m = b.match(/<link[^>]*href=["']([^"']+)["']/i); link = m ? m[1] : ""; }
    if (!link) { const m = b.match(/rdf:about=["']([^"']+)["']/i); link = m ? m[1] : ""; }
    const date = tag(b, ["pubDate", "dc:date", "published", "updated"]);
    if (title && /^https?:\/\//.test(link)) out.push({title, link, source: feed.name, time: toTime(date)});
  }
  return out;
}

function parseJfa(html, feed) {
  const out = [], seen = new Set();
  const re = /<a\s[^>]*href=["']([^"']*\/news\/\d{6,}\/?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const link = abs(m[1], feed.url);
    if (!link || seen.has(link) || /\/eng\//.test(link)) continue;
    let text = decode(m[2]);
    const dm = text.match(/(\d{4})[.\/年](\d{1,2})[.\/月](\d{1,2})日?/);
    const time = dm ? Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) - 9 * 3600e3 : 0;
    if (dm) text = text.replace(dm[0], "").trim();
    text = text.replace(/^[\s|｜・\-–—]+/, "").trim();
    if (text.length < 8) continue;
    seen.add(link);
    out.push({title: text, link, source: feed.name, time, official: true});
  }
  return out;
}

async function load(feed) {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(feed.url, {headers: {"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.8"},
      signal: ctl.signal, cf: {cacheTtl: TTL, cacheEverything: true}, redirect: "follow"});
    clearTimeout(timer);
    if (!r.ok) return {feed, items: [], status: "HTTP " + r.status, ms: Date.now() - t0};
    const text = await r.text();
    const items = feed.kind === "jfa" ? parseJfa(text, feed) : parseRss(text, feed);
    return {feed, items, status: "ok", ms: Date.now() - t0};
  } catch (e) {
    return {feed, items: [], status: "error " + (e && e.name || e), ms: Date.now() - t0};
  }
}

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("q") || "").replace(/\s+/g, "").slice(0, 20);
  const n = Math.min(Math.max(parseInt(url.searchParams.get("n") || "10", 10) || 10, 1), 20);
  const debug = url.searchParams.get("debug") === "1";
  const cache = caches.default;
  const key = new Request(url.origin + "/api/news?q=" + encodeURIComponent(q) + "&n=" + n + "&v=1");
  if (!debug) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const results = await Promise.all(FEEDS.map(load));
  const now = Date.now(), seen = new Set(), items = [];
  for (const res of results) {
    for (const it of res.items) {
      const plain = it.title.replace(/\s+/g, "");
      if (q) { if (!plain.includes(q)) continue; }
      else if (!res.feed.all && !INCLUDE.test(it.title)) continue;
      if (EXCLUDE.test(it.title)) continue;
      if (it.time && (it.time > now + 864e5 || it.time < now - 30 * 864e5)) continue;
      const k = plain.slice(0, 28);
      if (seen.has(k) || seen.has(it.link)) continue;
      seen.add(k); seen.add(it.link);
      items.push(it);
    }
  }
  items.sort((a, b) => (b.time || 0) - (a.time || 0));
  const body = {updated: new Date().toISOString(), q, items: items.slice(0, n).map(({title, link, source, time, official}) =>
    ({title, link, source, date: time ? new Date(time).toISOString() : null, official: !!official}))};
  if (debug) body.sources = results.map(r => ({name: r.feed.name, url: r.feed.url, status: r.status, found: r.items.length, ms: r.ms,
    sample: r.items.slice(0, 3).map(x => x.title)}));
  const resp = new Response(JSON.stringify(body), {headers: {"Content-Type": "application/json; charset=utf-8",
    "Cache-Control": debug ? "no-store" : "public, max-age=900"}});
  if (!debug) ctx.waitUntil(cache.put(key, new Response(resp.clone().body, {headers: {"Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=" + TTL}})));
  return resp;
}
