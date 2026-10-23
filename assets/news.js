/* 関連ニュース（自動生成：news_build.py） */
(function () {
  var box = document.getElementById("news");
  if (!box || !window.fetch) return;
  var q = box.getAttribute("data-q") || "", n = box.getAttribute("data-n") || "8";
  var css = ".newsbox{margin:18px 0}.newsbox h2,.newsbox h3{margin:0 0 8px;font-size:16px}.newsbox h2 small,.newsbox h3 small{font-size:11px;font-weight:700;opacity:.7;margin-left:6px}" +
    ".newsbox ul{list-style:none;margin:0;padding:0;border:1px solid var(--line,rgba(127,127,127,.3));border-radius:10px;overflow:hidden}" +
    ".newsbox li{border-top:1px solid var(--line,rgba(127,127,127,.3))}.newsbox li:first-child{border-top:0}" +
    ".newsbox a{display:block;padding:10px 12px;color:inherit;text-decoration:none;line-height:1.5}.newsbox a:hover{background:rgba(127,127,127,.08)}" +
    ".newsbox .t{display:block;font-size:14px;font-weight:700}.newsbox .m{display:block;margin-top:2px;font-size:11px;opacity:.7}" +
    ".newsbox .of{display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:#14306b;color:#fff;font-size:10px;font-weight:800}" +
    ".newsbox .nt{margin:6px 2px 0;font-size:11px;opacity:.65}";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function ago(iso) {
    if (!iso) return "";
    var d = (Date.now() - Date.parse(iso)) / 6e4;
    if (d < 60) return Math.max(1, Math.round(d)) + "分前";
    if (d < 1440) return Math.round(d / 60) + "時間前";
    if (d < 1440 * 7) return Math.round(d / 1440) + "日前";
    var t = new Date(iso); return (t.getMonth() + 1) + "/" + t.getDate();
  }
  fetch("/api/news?n=" + encodeURIComponent(n) + (q ? "&q=" + encodeURIComponent(q) : ""))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.items || !d.items.length) return;
      var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      var h = box.getAttribute("data-h") || "h2";
      box.innerHTML = "<" + h + ">" + (q ? esc(q) + "の関連ニュース" : "日本代表の関連ニュース") + "<small>各メディアの記事が開きます</small></" + h + ">" +
        "<ul>" + d.items.map(function (it) {
          return '<li><a href="' + esc(it.link) + '" target="_blank" rel="noopener nofollow"><span class="t">' + esc(it.title) +
            '</span><span class="m">' + (it.official ? '<span class="of">公式</span>' : "") + esc(it.source) + (it.date ? "・" + ago(it.date) : "") + "</span></a></li>";
        }).join("") + "</ul><p class=\"nt\">見出しは各メディア・日本サッカー協会の配信から自動で表示しています。</p>";
      box.hidden = false;
    })
    .catch(function () {});
})();
