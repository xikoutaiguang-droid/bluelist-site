/* スタジアム近くの宿の一覧（自動生成：travel_build.py） */
(function () {
  var box = document.getElementById("hotels");
  if (!box || !window.fetch) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function yen(n) { return n ? n.toLocaleString("ja-JP") + "円〜" : "料金はリンク先で"; }
  fetch("/api/hotels?s=" + encodeURIComponent(box.getAttribute("data-s")))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !(d.cheap.length || d.review.length || d.popular.length)) return;
      var tabs = [["cheap", "料金の安い順"], ["review", "口コミ評価が高い順"], ["popular", "口コミが多い順"]].filter(function (t) { return d[t[0]].length; });
      function list(k) {
        return "<ol>" + d[k].map(function (h) {
          var meta = [h.rev ? "★" + h.rev.toFixed(2) + "（口コミ" + h.n.toLocaleString("ja-JP") + "件）" : "", h.km != null ? "スタジアムから約" + h.km + "km" : "", h.st ? "最寄り " + h.st : ""].filter(Boolean).join("・");
          return '<li><a href="' + esc(h.url) + '" target="_blank" rel="sponsored nofollow noopener">' + (h.img ? '<img src="' + esc(h.img) + '" alt="" loading="lazy">' : "") +
            '<span><span class="hn">' + esc(h.name) + '</span><span class="hm">' + esc(meta) + '</span></span><span class="hp">' + esc(yen(h.min)) + "<small>1泊の目安</small></span></a></li>";
        }).join("") + "</ol>";
      }
      box.innerHTML = '<div class="htabs" role="tablist">' + tabs.map(function (t, i) { return '<button type="button" role="tab" data-k="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + "</button>"; }).join("") +
        '</div><div class="hbody">' + list(tabs[0][0]) + '</div><p class="note">スタジアムから3km以内の宿（楽天トラベル）。料金は1部屋1泊の最安値の目安で、日にちや人数で変わります。「口コミ評価が高い順」は口コミ10件以上の宿だけを並べています。</p>';
      box.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          box.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
          box.querySelector(".hbody").innerHTML = list(b.getAttribute("data-k"));
        });
      });
      box.hidden = false;
    }).catch(function () {});
})();
