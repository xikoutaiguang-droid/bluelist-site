// 自動生成：vote_build.py（直接書き換えない）
const POLLS = {"pred-2026-11-14-brazil": {"close": "2026-11-14T19:15:00+09:00", "options": ["win", "draw", "lose"]}, "pred-2026-11-17-paraguay": {"close": "2026-11-17T22:10:00+09:00", "options": ["win", "draw", "lose"]}};
const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});

async function hash(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function onRequest(ctx) {
  const kv = ctx.env.VOTES;
  if (!kv) return json({error: "not_ready"}, 503);
  const req = ctx.request;
  const url = new URL(req.url);
  let poll = url.searchParams.get("poll"), option = null;
  if (req.method === "POST") {
    try { const b = await req.json(); poll = b.poll; option = b.option; } catch (e) { return json({error: "bad_request"}, 400); }
  } else if (req.method !== "GET") {
    return json({error: "method"}, 405);
  }
  const def = POLLS[poll];
  if (!def) return json({error: "unknown_poll"}, 404);
  const closed = def.close ? Date.now() >= Date.parse(def.close) : false;
  const ip = req.headers.get("CF-Connecting-IP") || "0";
  const vk = "v:" + poll + ":" + await hash(ip + "|" + poll);
  let counts = (await kv.get("c:" + poll, "json")) || {};
  let voted = await kv.get(vk);
  if (option !== null) {
    if (closed) return json({counts, voted, closed, error: "closed"}, 403);
    if (!def.options.includes(option)) return json({error: "bad_option"}, 400);
    if (!voted) {
      counts[option] = (counts[option] || 0) + 1;
      await kv.put("c:" + poll, JSON.stringify(counts));
      await kv.put(vk, option, {expirationTtl: 60 * 60 * 24 * 90});
      voted = option;
    }
  }
  return json({counts, voted, closed});
}
