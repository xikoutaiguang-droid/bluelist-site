// 自動生成：travel_build.py（直接書き換えない）
// スタジアムの近くの宿を楽天トラベル施設検索APIから取って、安い順・口コミ評価順・口コミが多い順に返す。
// Cloudflare Pages の環境変数 RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY が要る（無ければ 503 を返し、ページ側は何も出さない）。
const ST = {"national-stadium": [35.6781, 139.7147], "saitama-stadium-2002": [35.9031, 139.7175], "nissan-stadium": [35.51, 139.6063], "ajinomoto-stadium": [35.6644, 139.5273], "toyota-stadium": [35.0846, 137.1708], "panasonic-stadium-suita": [34.8028, 135.5383], "yodoko-sakura-stadium": [34.6133, 135.519], "noevir-stadium-kobe": [34.6566, 135.169], "edion-peace-wing-hiroshima": [34.3989, 132.4555], "denka-big-swan": [37.8793, 139.0599], "qa-stadium-miyagi": [38.3263, 140.9713]};
const AFF_ID = "564560c3.27ea07d7.564560c4.e8fc6b4c";
const TTL = 21600;   // 6時間
function dist(a, b, c, d) { const R = 6371, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function wrap(u) { if (!u || /hb\.afl\.rakuten/.test(u) || !AFF_ID) return u;
  return "https://hb.afl.rakuten.co.jp/hgc/" + AFF_ID + "/?pc=" + encodeURIComponent(u) + "&m=" + encodeURIComponent(u); }
export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const s = ST[url.searchParams.get("s") || ""];
  const json = (o, st, cc) => new Response(JSON.stringify(o), {status: st || 200, headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": cc || "public, max-age=1800"}});
  if (!s) return json({error: "unknown stadium"}, 404, "no-store");
  const app = ctx.env.RAKUTEN_APP_ID, key = ctx.env.RAKUTEN_ACCESS_KEY;
  if (!app || !key) return json({error: "not configured"}, 503, "no-store");
  const cache = caches.default, ck = new Request(url.origin + "/api/hotels?s=" + url.searchParams.get("s") + "&v=3");
  const debug = url.searchParams.get("debug") === "1";
  if (!debug) { const hit = await cache.match(ck); if (hit) return hit; }
  const q = new URLSearchParams({applicationId: app, accessKey: key, format: "json", formatVersion: "2", datumType: "1",
    latitude: String(s[0]), longitude: String(s[1]), searchRadius: "3.0", hits: "30", sort: "standard", responseType: "small"});
  if (AFF_ID) q.set("affiliateId", AFF_ID);
  const H = {headers: {"accessKey": key, "Referer": "https://bluelist-jp.com/", "Origin": "https://bluelist-jp.com", "User-Agent": "BLUELIST/1.0"}};
  const API = "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731?";
  let r, body;
  try { r = await fetch(API + q, H); body = await r.text(); } catch (e) { return json({error: "fetch failed"}, 502, "no-store"); }
  if (!r.ok) return json(debug ? {error: "api " + r.status, body: body.slice(0, 500)} : {error: "api " + r.status}, 502, "no-store");
  let d; try { d = JSON.parse(body); } catch (e) { return json({error: "bad json"}, 502, "no-store"); }
  // 近い順に30件ずつ。宿の多い街なら3ページ（90件）まで見て、安い順・口コミ順の取りこぼしを減らす（1秒に1回まで）
  const hotels = (d.hotels || []).slice();
  const pages = Math.min((d.pagingInfo && d.pagingInfo.pageCount) || 1, 3);
  for (let p = 2; p <= pages; p++) {
    await new Promise(res => setTimeout(res, 1100));
    try { q.set("page", String(p)); const rr = await fetch(API + q, H); if (!rr.ok) break; const dd = await rr.json(); hotels.push(...(dd.hotels || [])); } catch (e) { break; }
  }
  const list = hotels.map(h => { const b = Array.isArray(h) ? (h[0] && (h[0].hotelBasicInfo || h[0])) : (h.hotelBasicInfo || h); return b; })
    .filter(b => b && b.hotelName).map(b => ({
      name: b.hotelName, url: wrap(b.hotelNo ? "https://hotel.travel.rakuten.co.jp/hotelinfo/plan/" + b.hotelNo : (b.planListUrl || b.hotelInformationUrl)), img: b.hotelThumbnailUrl || "",
      min: b.hotelMinCharge || null, rev: b.reviewAverage || null, n: b.reviewCount || 0, st: b.nearestStation || "",
      km: (b.latitude && b.longitude) ? Math.round(dist(s[0], s[1], +b.latitude, +b.longitude) * 10) / 10 : null}));
  const top = (arr, f, g) => arr.filter(f).sort(g).slice(0, 5);
  const out = {updated: new Date().toISOString(), total: list.length,
    cheap: top(list, x => x.min, (a, b) => a.min - b.min),
    review: top(list, x => x.rev && x.n >= 10, (a, b) => b.rev - a.rev || b.n - a.n),
    popular: top(list, x => x.n > 0, (a, b) => b.n - a.n)};
  const resp = json(out, 200, "public, max-age=1800");
  if (!debug) ctx.waitUntil(cache.put(ck, new Response(JSON.stringify(out), {headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + TTL}})));
  return resp;
}
