const DB = window.BL_DB;
/* 国旗（assets/flags/、flag-icons・MIT） */
const abv = n => flg(n) + '<span class="abv">' + esc((DB.abbr || {})[n] || ((DB.flags || {})[n] || n).replace(/^gb-/, '').slice(0, 3).toUpperCase()) + '</span>';
const flg = (n, c) => { const k = (DB.flags || {})[n]; return k ? '<img class="flag' + (c ? ' ' + c : '') + '" src="assets/flags/' + k + '.png" alt="" width="20" height="15" loading="lazy" decoding="async" onerror="this.remove()">' : ''; };
/* 省いた項目を元に戻す（build_site.py の _compact と対） */
(() => {
  const A = {}, M = {};
  DB.activities.forEach(a => { A[a.id] = a; });
  DB.matches.forEach(m => { M[m.id] = m; m.slots.forEach(s => { if (s.form == null) s.form = ''; if (s.outFor == null) s.outFor = ''; if (s.unc == null) s.unc = false; }); });
  DB.players.forEach(p => {
    p.history.forEach(h => {
      const a = A[h.activityId];
      h.activityName = a.name; h.date = a.startDate; h.category = a.category;
      h.additional = !!h.additional; h.withdrawn = !!h.withdrawn; h.firstCall = !!h.firstCall;
      if (h.numbers && h.numbers.length && Array.isArray(h.numbers[0])) h.numbers = h.numbers.map(x => ({date: M[x[0]].date, opponent: M[x[0]].opponent, no: x[1]}));
    });
    p.apps.forEach(x => { const m = M[x.matchId]; x.date = m.date; x.opponent = m.opponent; x.activityId = m.activityId; });
  });
})();
const AFF = {"rakuten_id": "564560c3.27ea07d7.564560c4.e8fc6b4c", "amazon_tag": "", "dazn_url": "", "unext_url": "", "abema_url": "https://px.a8.net/svt/ejp?a8mat=4BENDO+D8WANE+4EKC+5YJRM", "prime_url": "", "xebio_url": "https://px.a8.net/svt/ejp?a8mat=4BENDO+E4G9PM+4ABU+5YJRM", "wowow_url": "https://h.accesstrade.net/sp/cc?rk=0100pjmj00p1cq", "wowow_px": "https://h.accesstrade.net/sp/rr?rk=0100pjmj00p1cq"};
const SLUGS = DB.slugs || {p:{}, m:{}, a:{}};
const OPP_SLUG = (DB.slugs && DB.slugs.o) || {};
const TEAM = 'JPN';
const ACTS = DB.activities.filter(a => a.team === TEAM).sort((a,b) => a.startDate.localeCompare(b.startDate));
const PLAYERS = DB.players.filter(p => p.team === TEAM);
const BY_ID = Object.fromEntries(PLAYERS.map(p => [p.id, p]));
const POS_ORDER = {GK:0, DF:1, MF:2, FW:3};
const LAST = ACTS[ACTS.length - 1];
const ACT_IDX = Object.fromEntries(ACTS.map((a, i) => [a.id, i]));
const MATCHES = (DB.matches || []).filter(m => m.team === TEAM);
const MATCHES_BY_ACT = {};
MATCHES.forEach(m => (MATCHES_BY_ACT[m.activityId] = MATCHES_BY_ACT[m.activityId] || []).push(m));
const HAS_MATCHES = MATCHES.length > 0;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = id => document.getElementById(id);
const pos = p => '<span class="pos">' + esc(p) + '</span>';
const ym = d => String(d || '').slice(0, 7).replace('/', '.');
const md = d => String(d || '').slice(5).replace('/', '.');
// その活動の試合での背番号。試合ごとに変わっていれば並べる（例：15→22）
const nosOf = h => {
  const list = (h.numbers || []).map(n => n.no).filter(n => n != null && n !== '');
  const uniq = list.filter((n, i) => list.indexOf(n) === i);
  if (uniq.length) return uniq;
  return h.number !== '' && h.number != null ? [h.number] : [];
};
const noText = h => nosOf(h).join('→');
const noDetail = h => (h.numbers || []).map(n => md(n.date) + ' ' + n.opponent + '戦 ' + n.no + '番').join('／');

/* ---------- この端末だけの保存（お気に入り・最後に見た活動） ---------- */
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
};
let FAVS = new Set(store.get('favs', []));
const saveFavs = () => store.set('favs', [...FAVS]);

/* ---------- ペンタゴンの5項目 ----------
   すべて事実の数（誰が数えても同じ結果になるもの）だけで作る。主観の評価点は使わない。
   代表①招集率：初招集以降のA代表活動（E-1選手権を除く）のうち、招集されて参加した数
                 （離脱・不参加は数えない。初招集から4活動未満の選手は4活動として計算）
   代表②出場率：参加した活動の試合のうち、出場した試合
   代表③直近招集：直近4活動のうち招集された数
   クラブ④出場時間：所属クラブの直近5試合の出場時間（90分×試合数に対して）
   クラブ⑤先発：所属クラブの直近5試合の先発数
   クラブのデータがまだないときは、④⑤を代表のデータに置き換える：
   代表④先発率：代表で出場した試合のうち先発した試合
   代表⑤得点関与：代表での得点＋アシスト（収録している全選手の最多を100とする） */
const RECENT = 4, CLUB_N = 5, MIN_WINDOW = 4;
const isE1 = a => a.category === 'E-1選手権';
const HAS_CLUB = PLAYERS.some(p => (p.club || []).length);
const AXES = [
  {k:'callRate', label:'招集率',   grp:'代表'},
  {k:'playRate', label:'出場率',   grp:'代表'},
  {k:'recent',   label:'直近招集', grp:'代表'},
].concat(HAS_CLUB ? [
  {k:'clubMin',  label:'出場時間', grp:'クラブ'},
  {k:'clubStart',label:'先発',     grp:'クラブ'},
] : [
  {k:'startRate',label:'先発率',   grp:'代表'},
  {k:'involve',  label:'得点関与', grp:'代表'},
]);
// 代表でのアシスト（得点データのアシストから数える）
const ASSISTS = {};
MATCHES.forEach(m => (m.goals || []).forEach(g => { if (g.team === '日本' && g.ap) ASSISTS[g.ap] = (ASSISTS[g.ap] || 0) + 1; }));
const involveOf = p => (p.apps || []).reduce((n, a) => n + (a.goals || 0), 0) + (ASSISTS[p.id] || 0);
let MAX_INV = null;
function metrics(p){
  if (p._m) return p._m;
  const byAct = {};
  p.history.forEach(h => byAct[h.activityId] = h);
  const firstIdx = Math.min(...p.history.map(h => ACT_IDX[h.activityId]));

  const win = ACTS.filter((a, i) => i >= firstIdx && !isE1(a));
  const joined = win.filter(a => byAct[a.id] && !byAct[a.id].withdrawn).length;
  const callDen = win.length;
  const callRate = callDen ? Math.round(joined / Math.max(callDen, MIN_WINDOW) * 100) : null;

  const apps = p.apps || [];
  const appIds = new Set(apps.map(a => a.matchId));
  const pool = new Set();
  p.history.forEach(h => { if (!h.withdrawn) (MATCHES_BY_ACT[h.activityId] || []).forEach(m => pool.add(m.id)); });
  apps.forEach(a => pool.add(a.matchId));
  const playRate = HAS_MATCHES && pool.size ? Math.round(appIds.size / pool.size * 100) : null;

  let c4 = 0;
  ACTS.slice(-RECENT).forEach(a => { if (byAct[a.id]) c4++; });

  const club = (p.club || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, CLUB_N);
  const cMin = club.reduce((n, c) => n + (c.minutes || 0), 0);
  const cSt = club.filter(c => c.start).length;
  const hs = p.history.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (MAX_INV == null) MAX_INV = Math.max(1, ...PLAYERS.map(involveOf));
  const nGoals = apps.reduce((n, a) => n + (a.goals || 0), 0), nAst = ASSISTS[p.id] || 0;
  const nStarts = apps.filter(a => a.start).length;

  const m = {
    callRate, playRate, recent: Math.round(c4 / RECENT * 100),
    clubMin: club.length ? Math.round(cMin / (club.length * 90) * 100) : null,
    clubStart: club.length ? Math.round(cSt / club.length * 100) : null,
    startRate: apps.length ? Math.round(nStarts / apps.length * 100) : (HAS_MATCHES ? 0 : null),
    involve: HAS_MATCHES ? Math.round((nGoals + nAst) / MAX_INV * 100) : null,
    basis: {
      startRate: apps.length ? nStarts + ' / ' + apps.length + ' 試合' : '出場なし',
      involve:  nGoals + '得点・' + nAst + 'アシスト（最多 ' + MAX_INV + '）',
      callRate: joined + ' / ' + callDen + ' 活動' + (callDen < MIN_WINDOW ? '（4活動で計算）' : ''),
      playRate: HAS_MATCHES ? appIds.size + ' / ' + pool.size + ' 試合' : '試合データなし',
      recent:   c4 + ' / ' + RECENT + ' 活動',
      clubMin:  club.length ? cMin + ' / ' + (club.length * 90) + ' 分' : '未取得',
      clubStart:club.length ? cSt + ' / ' + club.length + ' 試合' : '未取得',
    },
    natApps: apps.length, natStarts: apps.filter(a => a.start).length,
    natMin: apps.reduce((n, a) => n + (a.minutes || 0), 0),
    natGoals: nGoals, natAssists: nAst,
    club, clubMinutes: club.length ? cMin : null,
    c4, isNew: firstIdx >= ACTS.length - 2,
    first: hs[0], last: hs[hs.length - 1],
  };
  // 評価の言葉は使わず、事実だけをラベルにする
  m.tag = m.isNew ? ym(m.first.date) + ' 初招集'
        : c4 === 0 ? '最終招集 ' + ym(m.last.date)
        : '直近4活動で' + c4 + '回招集';
  const withNo = hs.filter(h => nosOf(h).length);
  m.number = withNo.length ? nosOf(withNo[withNo.length - 1]).slice(-1)[0] : null;
  return (p._m = m);
}
const tag = m => '<span class="tag' + (m.isNew ? ' new' : '') + '">' + esc(m.tag) + '</span>';

/* ---------- タブ ---------- */
const VIEWS = {sheet:'view-sheet', matrix:'view-matrix', rank:'view-rank', fifa:'view-fifa', shop:'view-shop'};
/* タブの中身は初めて開いたときに描く（最初の表示を軽くする） */
const DRAWN = {};
const LAZY = {matrix: () => renderMatrix(), rank: () => renderRank(), fifa: () => renderFifa(), shop: () => renderWatch()};
function showView(key, keepScroll, boot){
  if (!keepScroll) window.scrollTo({top: 0});
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === key)));
  if (!DRAWN[key] && LAZY[key]){ DRAWN[key] = 1; LAZY[key](); }
  Object.entries(VIEWS).forEach(([k, id]) => { $(id).hidden = (k !== key); });
  const tb = document.querySelector('.tab[data-view="' + key + '"]'); if (!boot && tb && tb.scrollIntoView) tb.scrollIntoView({block: 'nearest', inline: 'nearest'});
  store.set('view', key);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && VIEWS[g.dataset.go] && !g.closest('.ov')){ e.preventDefault(); showView(g.dataset.go); } });

/* ---------- 次の代表戦・FIFAランキング ---------- */
const INFO = DB.info || {schedule: [], fifa: []};
const WD = ['日','月','火','水','木','金','土'];
function renderNext(){
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = (INFO.schedule || []).find(x => new Date(x.date.replace(/\//g, '-') + 'T00:00:00') >= today);
  const fr = (INFO.fifa || []).slice(-1)[0];
  if (!next && !fr) return;
  let h = '';
  if (next){
    const d = new Date(next.date.replace(/\//g, '-') + 'T00:00:00');
    const days = Math.round((d - today) / 86400000);
    const tbd = !next.opponent || next.opponent === '未定';
    const last = tbd ? null : MATCHES.filter(m => m.opponent === next.opponent).sort((a, b) => b.date.localeCompare(a.date))[0];
    h += '<div class="lab">次の代表戦</div>' +
      '<div class="vs">' + (tbd ? esc(next.competition || '国際Aマッチデー') : '<b class="nw">' + flg('日本', 'lg') + '日本</b><span>vs</span><b class="nw">' + flg(next.opponent, 'lg') + esc(next.opponent) + '</b>') + '</div>' +
      '<p class="meta">' + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WD[d.getDay()] + '）' + (next.time ? ' ' + esc(next.time) + ' キックオフ' : '') +
        (next.venue ? '<br>' + esc(next.venue.split('（')[0]) : '') + (next.broadcast ? '<br>中継：' + esc(next.broadcast.split('／')[0].replace('全国ネット生中継', '')) : '') + '</p>' +
      '<div class="cd">' + (days === 0 ? '今日' : days) + '<small>' + (days === 0 ? '' : '日後') + '</small></div>' +
      '<div class="acts">' + (last ? '<button class="btn pri" type="button" data-goto="' + esc(last.id) + '">▶ 前回の' + esc(next.opponent) + '戦（' + last.gf + '-' + last.ga + '）を見る</button>' : '') +
        watchBtn(next.broadcast) + (next.preview ? '<a class="btn sec" href="' + esc(next.preview) + '">見どころとデータ</a>' : '<a class="btn sec" href="schedule.html">日程と中継</a>') + '</div>';
  }
  if (fr){
    const prev = (INFO.fifa || []).slice(-2, -1)[0];
    const diff = prev ? prev.rank - fr.rank : 0;
    h += '<div class="rk">FIFAランキング<b>' + fr.rank + '</b>位' + (diff ? '（' + (diff > 0 ? '↑' + diff : '↓' + (-diff)) + '）' : '') +
      '　' + esc(fr.date.slice(5).replace('/', '/')) + '発表' + (fr.asia ? '・アジア' + fr.asia + '位' : '') + '<a href="#" data-go="fifa">世界の順位</a></div>';
  }
  $('nextbar').innerHTML = h;
  $('nextbar').hidden = false;
}
/* 横に流れる列：最新のメンバーと直近の試合 */
function renderRails(){
  const a = LAST;
  const squad = squadOf(a.id).filter(s => !s.h.withdrawn)
    .sort((x, y) => (POS_ORDER[x.p.position] - POS_ORDER[y.p.position]) || ((nosOf(x.h).slice(-1)[0] || 99) - (nosOf(y.h).slice(-1)[0] || 99)));
  const ptiles = squad.map(s => '<button class="tile ptile' + (s.p.position === 'GK' ? ' gk' : '') + '" type="button" data-id="' + esc(s.p.id) + '">' +
    '<span class="ps">' + esc(s.p.position) + '</span>' + (s.h.firstCall ? '<span class="fc">初招集</span>' : '') +
    '<span class="no">' + esc(nosOf(s.h).slice(-1)[0] || '') + '</span><span class="nm">' + esc(s.p.name) + '</span><span class="cl">' + flg(s.h.country, 'sm') + esc(s.h.club || '') + '</span></button>').join('');
  const ms = MATCHES.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 12);
  const mtiles = ms.map(m => '<button class="tile mtile ' + (m.result === '勝' ? 'w' : m.result === '敗' ? 'l' : '') + '" type="button" data-goto="' + esc(m.id) + '">' +
    '<div class="d">' + esc(m.date.replace(/\//g, '.')) + '</div><div class="o">vs ' + flg(m.opponent, 'sm') + esc(m.opponent) + '</div>' +
    '<div class="r">' + (m.result === '勝' ? '勝ち' : m.result === '敗' ? '負け' : '引き分け') + '</div><div class="s">' + m.gf + '-' + m.ga + '</div></button>').join('');
  $('rails').innerHTML =
    '<div class="rail-head"><h3>最新のメンバー</h3><a class="more" href="players/index.html">選手一覧 →</a></div><div class="rail">' + ptiles + '</div>' +
    '<div class="rail-head" style="margin-top:14px"><h3>直近の試合</h3><a class="more" href="matches/index.html">試合結果 →</a></div><div class="rail">' + mtiles + '</div>' +
    '<div class="rail-head" style="margin-top:14px"><h3>読みもの</h3><small>記録やデータを深掘り</small></div><div class="rail">' +
    [['columns/index.html', 'コラム', 'データで読む日本代表'], ['formations.html', '布陣と組み合わせ', '3-4-2-1と4-2-3-1の相性'], ['clubs.html', 'クラブ別・国別', 'どこのクラブから呼ばれた？'], ['birthdays.html', '誕生日カレンダー', '月ごとの誕生日'], ['records.html', '記録集', '得点・アシスト・最年少'], ['numbers/index.html', '背番号の歴代', '10番は誰が付けた？'], ['opponents/index.html', '対戦国別の成績', '国ごとの勝敗と得点者'], ['fifa-ranking-world.html', '世界のFIFAランキング', '全211か国・地域の最新順位'], ['daily.html', '今日の代表選手当て', '毎日1人・6回以内に推理'], ['higher-lower.html', 'どっちが多い？', '記録を比べて連続正解'], ['quiz.html', '日本代表クイズ', '800問以上・称号が育つ'], ['goods.html', '代表グッズ一覧', '一番くじ・お菓子まで'],
     ['clubs.html', '所属クラブ', '海外組の人数の推移'], ['fifa-ranking.html', '日本のFIFA順位', '順位の推移'], ['schedule.html', '試合日程', '次の代表戦と中継'],
     ['players/index.html', '選手一覧', '招集された全員'], ['matches/index.html', '試合結果', 'スタメンと得点者']]
      .map(x => '<a class="tile ltile" href="' + x[0] + '"><b>' + x[1] + '</b><small>' + x[2] + '</small></a>').join('') + '</div>';
}
// 試合へ飛ぶ（ヒーローのボタン・試合のカード）
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]'); if (!g || g.closest('.ov')) return;
  const m = MATCHES.find(x => x.id === g.dataset.goto); if (!m) return;
  cur = ACT_IDX[m.activityId]; mi = matchesOf(m.activityId).findIndex(x => x.id === m.id);
  renderSheet(true);
  document.querySelector('.sheet').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'});
});
function renderFifa(){
  const rows = INFO.fifa || [];
  if (rows.length < 2) return;
  const W = 640, H = 200, padL = 34, padR = 18, padT = 22, padB = 26;
  const ranks = rows.map(r => r.rank);
  const lo = Math.max(1, Math.min(...ranks) - 2), hi = Math.max(...ranks) + 2;
  const x = i => padL + i * (W - padL - padR) / (rows.length - 1);
  const y = r => padT + (r - lo) / (hi - lo) * (H - padT - padB);   // 上が1位
  const grid = [lo, Math.round((lo + hi) / 2), hi].map(r => '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(r) + '" y2="' + y(r) + '"></line><text x="4" y="' + (y(r) + 4) + '">' + r + '位</text>').join('');
  const pts = rows.map((r, i) => x(i).toFixed(1) + ',' + y(r.rank).toFixed(1)).join(' ');
  const dots = rows.map((r, i) => '<circle class="pt' + (i === rows.length - 1 ? ' last' : '') + '" cx="' + x(i) + '" cy="' + y(r.rank) + '" r="4"><title>' + esc(r.date) + '　' + r.rank + '位' + (r.points ? '（' + r.points + 'pt）' : '') + '</title></circle>').join('');
  const labs = rows.map((r, i) => (i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / 5) === 0) ? '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(r.date.slice(2, 7).replace('/', '.')) + '</text>' : '').join('');
  const last = rows[rows.length - 1];
  const best = Math.min(...ranks);
  $('fifa').innerHTML = '<h2>日本のFIFAランキングの推移</h2><p class="lead2">最新は' + last.rank + '位（' + esc(last.date) + '発表）。' +
    rows[0].date.slice(0, 4) + '年' + Number(rows[0].date.slice(5, 7)) + '月以降の最高は' + best + '位。</p>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="日本のFIFAランキングの推移">' + grid +
    '<polyline class="ln" points="' + pts + '"></polyline>' + dots + labs +
    '<text class="v" x="' + (x(rows.length - 1) - 6) + '" y="' + (y(last.rank) - 10) + '" text-anchor="end">' + last.rank + '位</text></svg>';
  $('fifa').hidden = false;
  renderWorld();
}
/* 全加盟国のFIFAランキング（appearances/fifa_world.json） */
const CONF_JA = {AFC: 'アジア', UEFA: 'ヨーロッパ', CONMEBOL: '南米', CONCACAF: '北中米カリブ', CAF: 'アフリカ', OFC: 'オセアニア'};
let wrConf = 'ALL', wrAll = false;
function renderWorld(){
  const W = DB.world; if (!W) return;
  let box = $('world');
  if (!box){ box = document.createElement('div'); box.id = 'world'; $('fifa').appendChild(box); }
  const confs = ['ALL', ...Object.keys(CONF_JA).filter(c => W.rows.some(r => r[3] === c))];
  const inConf = {}, cnt = {};
  W.rows.forEach(r => { cnt[r[3]] = (cnt[r[3]] || 0) + 1; inConf[r[2]] = cnt[r[3]]; });
  const list = W.rows.filter(r => wrConf === 'ALL' || r[3] === wrConf);
  const LIMIT = 20;
  let shown = wrAll ? list : list.slice(0, LIMIT);
  const jp = list.find(r => r[2] === '日本');
  if (!wrAll && jp && !shown.includes(jp)) shown = shown.concat([null, jp]);
  const opp = new Set(MATCHES.map(m => m.opponent));
  const mv = r => r[1] == null ? '' : r[1] > r[0] ? '<span class="up">↑' + (r[1] - r[0]) + '</span>' : r[1] < r[0] ? '<span class="dn">↓' + (r[0] - r[1]) + '</span>' : '<span class="eq">→</span>';
  box.innerHTML = '<h2 class="wh">世界のFIFAランキング <small>' + esc(W.date) + '発表・' + W.rows.length + 'か国・地域</small></h2>' +
    '<div class="wchips">' + confs.map(c => '<button type="button" data-wc="' + c + '" aria-pressed="' + (c === wrConf) + '">' + (c === 'ALL' ? 'すべて' : CONF_JA[c]) + '</button>').join('') + '</div>' +
    '<ol class="wlist">' + shown.map(r => r === null ? '<li class="gap">…</li>' :
      '<li class="' + (r[2] === '日本' ? 'jp' : '') + '"><span class="r">' + r[0] + '</span><span class="mv">' + mv(r) + '</span><span class="t">' + flg(r[2]) + esc(r[2]) +
      (opp.has(r[2]) && r[2] !== '日本' ? '<i>対戦あり</i>' : '') + '</span><span class="c">' + CONF_JA[r[3]] + ' ' + inConf[r[2]] + '位</span><span class="p">' + (r[4] != null ? r[4].toFixed(2) : '') + '</span></li>').join('') + '</ol>' +
    (list.length > LIMIT ? '<button type="button" class="wmore" id="wmore">' + (wrAll ? '上位' + LIMIT + 'だけ表示' : 'すべて表示（' + list.length + '）') + '</button>' : '') +
    '<p class="pagelink"><a href="fifa-ranking-world.html">世界のFIFAランキングのページ（検索つき）→</a></p>';
  box.querySelectorAll('[data-wc]').forEach(b => b.addEventListener('click', () => { wrConf = b.dataset.wc; wrAll = false; renderWorld(); }));
  const more = $('wmore'); if (more) more.addEventListener('click', () => { wrAll = !wrAll; renderWorld(); });
}

/* ---------- アフィリエイトのリンク ---------- */
function rakutenUrl(q){
  const u = 'https://search.rakuten.co.jp/search/mall/' + encodeURIComponent(q) + '/';
  return AFF.rakuten_id ? 'https://hb.afl.rakuten.co.jp/hgc/' + AFF.rakuten_id + '/?pc=' + encodeURIComponent(u) + '&m=' + encodeURIComponent(u) : u;
}
function amazonUrl(q){
  return 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(q) + (AFF.amazon_tag ? '&tag=' + encodeURIComponent(AFF.amazon_tag) : '');
}
const daznUrl = () => AFF.dazn_url || 'https://www.dazn.com/ja-JP/welcome';
/* 次の代表戦の配信サービスに合わせた「観る」ボタン（配信がなければ出さない） */
function watchBtn(bc){
  if (!bc) return '';
  const svc = [['U-NEXT', AFF.unext_url || 'https://video.unext.jp/'], ['DAZN', daznUrl()], ['ABEMA', AFF.abema_url || 'https://abema.tv/'], ['Prime Video', AFF.prime_url || 'https://www.amazon.co.jp/primevideo']]
    .find(([k]) => bc.includes(k));
  return svc ? '<a class="btn watch" href="' + esc(svc[1]) + '" target="_blank" rel="sponsored noopener">▶ ' + esc(svc[0]) + 'で観る<span class="pr">PR</span></a>' : '';
}
const WATCH_SV = [['U-NEXT', 'unext_url', 'https://video.unext.jp/'], ['TVer', '', 'https://tver.jp/'], ['DAZN', 'dazn_url', 'https://www.dazn.com/ja-JP/welcome'], ['ABEMA', 'abema_url', 'https://abema.tv/'], ['Prime Video', 'prime_url', 'https://www.amazon.co.jp/primevideo']];
function watchBtns(bc){
  // 中継情報に名前が出てくる配信サービスだけ。広告リンクのときだけ PR を付ける
  const hit = WATCH_SV.filter(s => bc && bc.includes(s[0]));
  if (!hit.length) return '';
  return '<div class="shop"><div class="btns">' + hit.map(([n, k, u]) => {
    const aff = k && AFF[k];
    return aff ? extLink(aff, n + 'を開く', 'main') + '<span class="pr">PR</span>' : '<a class="main" href="' + esc(u) + '" target="_blank" rel="noopener">' + n + 'を開く</a>';
  }).join('') + '</div></div>';
}
const extLink = (href, label, cls) => '<a class="' + (cls || '') + '" href="' + esc(href) + '" target="_blank" rel="sponsored noopener">' + label + '</a>';
function shopBlock(q, title){
  return '<div class="shop"><div class="btns">' + extLink(rakutenUrl(q), '楽天市場で探す', 'main') + extLink(amazonUrl(q), 'Amazonで探す') + (AFF.xebio_url ? extLink(AFF.xebio_url, 'ゼビオ公式通販') : '') + '</div>' +
    '<p>コピー品に注意。公式ストアか正規販売店の商品を選んでください。</p></div>';
}
/* グッズ一覧（appearances/goods.json：一番くじ・お菓子など小さなものまで） */
const GOODS_CATS = ['くじ・ガチャ', 'お菓子・食品', 'カード', '本・雑誌・カレンダー', '応援グッズ', 'ユニフォーム・ウェア', 'その他'];
function goodsHTML(){
  const G = DB.goods || []; if (!G.length) return '';
  return GOODS_CATS.filter(c => G.some(x => x.cat === c)).map(c =>
    '<div class="sblock"><h3>' + esc(c) + '<span class="pr">PR</span></h3><div class="glist">' + G.filter(x => x.cat === c).map(x =>
      '<div class="gitem"><div class="gt"><b>' + esc(x.name) + '</b>' + (x.status === '終了' ? '<span class="gs end">販売終了</span>' : x.status === '予約受付中' ? '<span class="gs">予約受付中</span>' : '') + '</div>' +
      '<small>' + esc([x.maker, x.release ? x.release + '発売' : '', x.price].filter(Boolean).join('・')) + '</small>' +
      (x.where || x.note ? '<p>' + esc([x.where, x.note].filter(Boolean).join('。')) + '</p>' : '') +
      '<div class="btns">' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">公式の紹介</a>' : '') +
        (x.query ? extLink(rakutenUrl(x.query), '楽天', 'main') + extLink(amazonUrl(x.query), 'Amazon') : '') + '</div></div>').join('') + '</div></div>').join('');
}
function renderWatch(){
  // 次の代表戦（日程の先頭）と、直近の活動のメンバー（出場の多い順）
  const nx = (INFO.schedule || [])[0];
  const lastSquad = squadOf(LAST.id).filter(x => !x.h.withdrawn)
    .map(x => ({p: x.p, no: x.h.number, n: (x.p.apps || []).length}))
    .sort((a, b) => b.n - a.n).slice(0, 12);
  const card = (title, sub, q, tag) => '<div class="gcard"><b>' + title + '</b><small>' + sub + '</small><div class="btns">' +
    extLink(rakutenUrl(q), '楽天市場', 'main') + extLink(amazonUrl(q), 'Amazon') + '</div></div>';
  $('watch').innerHTML =
    '<div class="sblock dazn"><h3>代表戦を観る</h3>' +
      (nx ? '<p class="nx">次の代表戦：' + esc(nx.date.slice(5).replace('/', '月')) + '日 vs ' + esc(nx.opponent || '未定') + (nx.broadcast ? '<small>中継：' + esc(nx.broadcast) + '</small>' : '') + '</p>' : '') +
      watchBtns(nx && nx.broadcast) +
      '<p class="fine">中継・配信は試合ごとに違います。<a href="schedule.html">これからの日程と中継</a></p></div>' +
    '<div class="sblock"><h3>日本代表のユニフォーム<span class="pr">PR</span></h3><div class="ggrid">' +
      card('ホーム ユニフォーム', '青の1st。レプリカとオーセンティックがある', 'サッカー日本代表 ユニフォーム ホーム') +
      card('アウェイ ユニフォーム', '白・2nd', 'サッカー日本代表 ユニフォーム アウェイ') +
      card('キッズ ユニフォーム', '子ども用サイズ', 'サッカー日本代表 ユニフォーム キッズ') +
      card('トレーニングウェア', 'ジャージ・プラクティスシャツ', 'サッカー日本代表 トレーニングウェア') +
    '</div></div>' +
    '<div class="sblock"><h3>選手の名前と背番号入り<span class="pr">PR</span></h3><p class="lead3">' + esc(LAST.name) + 'のメンバーから</p><div class="pchips">' +
      lastSquad.map(x => '<a href="' + esc(rakutenUrl('日本代表 ユニフォーム ' + x.p.name + (x.no ? ' ' + x.no : ''))) + '" target="_blank" rel="sponsored noopener">' +
        (x.no ? '<span class="no">' + esc(x.no) + '</span>' : '') + esc(x.p.name) + '</a>').join('') + '</div>' +
      '<p class="fine">楽天市場の検索結果が開きます。ネーム・ナンバー入りは取り扱いのない選手もあります。</p></div>' +
    goodsHTML() +
    '<div class="sblock"><h3>スタジアムで応援<span class="pr">PR</span></h3><div class="ggrid">' +
      card('タオルマフラー', '応援の定番', 'サッカー日本代表 タオルマフラー') +
      card('キャップ・ニット帽', '', 'サッカー日本代表 キャップ') +
      card('応援フラッグ', '', 'サッカー日本代表 フラッグ 応援') +
    '</div><p class="fine">コピー品に注意。公式ストアか正規販売店の商品を選んでください。</p></div>' +
    '<p class="fine adnote">「PR」の付いたリンクは広告（アフィリエイト）です。</p>';
  // チームシート上部の短い導線
  const bb = '<a class="b1" href="schedule.html">中継・配信</a>' +
    '<a class="b2" href="#" data-go="shop">代表グッズを見る</a>';
  document.querySelectorAll('.buybar').forEach(el => { el.innerHTML = bb; });
}

/* ---------- チームシート ---------- */
const squadOf = id => PLAYERS.flatMap(p => p.history.filter(h => h.activityId === id).map(h => ({p, h})));
const matchesOf = id => (MATCHES_BY_ACT[id] || []).slice().sort((x, y) => x.date.localeCompare(y.date));
const appOf = (p, matchId) => (p.apps || []).find(a => a.matchId === matchId);
let cur = ACTS.length - 1;   // 見ている活動
let mi = -1;                 // 見ている試合（-1 は活動全体）
let t = 0;                   // 試合の時間（分）
let timer = null;

function chipHTML(p, no, cls, idx, extra, o){
  o = o || {};
  const has = no !== '' && no != null;
  return '<button class="pl ' + cls + '" style="--i:' + idx + (o.style || '') + '" data-id="' + esc(p.id) + '" aria-label="' + esc(p.name + (has ? ' 背番号' + no : '') + (o.pos ? ' ' + o.pos : '')) + '">' +
    (o.pos ? '<span class="ps">' + esc(o.pos) + '</span>' : '') + (o.inMin != null ? '<span class="inm" title="途中出場">' + o.inMin + "'</span>" : '') +
    (extra || '') + (FAVS.has(p.id) ? '<span class="star" aria-hidden="true">★</span>' : '') +
    '<span class="no' + (p.position === 'GK' ? ' gk' : '') + (has ? '' : ' blank') + (String(no).includes('·') ? ' multi' : '') + '">' + (has ? esc(no) : '−') + '</span>' +
    '<span class="nm">' + esc(p.name) + '</span>' + (o.sub ? '<span class="sw">' + o.sub + '</span>' : '') + '</button>';
}
/* xOf があれば左右の位置（0=左〜1=右）の順に、なければ背番号順に並べる */
function bandsHTML(list, noOf, clsOf, extraOf, xOf){
  let i = 0;
  const xv = x => { const v = xOf ? xOf(x) : null; return v == null ? 9 : v; };
  return ['FW','MF','DF','GK'].map(ps => {
    const xs = list.filter(x => x.p.position === ps)
      .sort((a, b) => (xv(a) - xv(b)) || ((parseInt(noOf(a)) || 99) - (parseInt(noOf(b)) || 99)) || a.p.name.localeCompare(b.p.name, 'ja'));
    if (!xs.length) return '';
    return '<div class="band-head">' + ps + ' <small>' + xs.length + '人</small></div><div class="band">' +
      xs.map(x => chipHTML(x.p, noOf(x), clsOf(x), i++, extraOf ? extraOf(x) : '')).join('') + '</div>';
  }).join('');
}
function benchChip(p, no, cls, meta){
  const has = no !== '' && no != null;
  return '<button class="bp ' + (cls || '') + '" data-id="' + esc(p.id) + '"><span class="n' + (has ? '' : ' blank') + '">' + (has ? esc(no) : '−') + '</span>' +
    esc(p.name) + (meta ? '<span class="m">' + esc(meta) + '</span>' : '') + '</button>';
}

function renderSheet(animate){
  stopPlay();
  const a = ACTS[cur];
  const ms = matchesOf(a.id);
  if (mi >= ms.length) mi = -1;
  $('act-title').innerHTML = '<b>' + esc(a.name).replace(/／/g, '／<wbr>') + '</b><small><span class="num">' + esc(a.startDate) + ' – ' + esc(md(a.endDate)) + '</span>　' +
    esc(a.category) + '／' + squadOf(a.id).length + '名' + (cur === ACTS.length - 1 ? '／最新' : '') + '</small>';
  $('prev').disabled = cur === ACTS.length - 1;
  $('next').disabled = cur === 0;
  document.querySelectorAll('.tick').forEach(x => x.setAttribute('aria-current', String(+x.dataset.i === cur)));
  $('mtabs').innerHTML = ms.length ? '<button class="mt" data-mi="-1" aria-pressed="' + (mi < 0) + '">活動全体<b>' + ms.length + '試合</b></button>' +
    ms.map((m, i) => '<button class="mt" data-mi="' + i + '" aria-pressed="' + (mi === i) + '">' + esc(md(m.date)) + ' ' + esc(m.opponent) + '<b>' + m.gf + '-' + m.ga + '</b></button>').reverse().join('') : '';
  if (mi < 0){ CUR_M = null; const mc = $('mclock'); if (mc) mc.remove(); renderActivity(a, ms); } else { t = 0; tf = 0; renderMatch(a, ms[mi]); }
  const pitch = $('pitch');
  pitch.classList.remove('swap');
  if (animate){ void pitch.offsetWidth; pitch.classList.add('swap'); }
}

/* 活動全体：出場した選手をピッチに、出場しなかった選手をベンチに */
function renderActivity(a, ms){
  $('board').hidden = true; $('ctrlwrap').hidden = true;
  const squad = squadOf(a.id);
  let pi = cur - 1;
  while (pi >= 0 && !isE1(a) && isE1(ACTS[pi])) pi--;
  const prevAct = pi >= 0 ? ACTS[pi] : null;
  const prev = prevAct ? new Set(squadOf(prevAct.id).map(s => s.p.id)) : null;
  const here = new Set(squad.map(s => s.p.id));
  const ids = new Set(ms.map(m => m.id));
  const played = s => (s.p.apps || []).some(x => ids.has(x.matchId));
  const onPitch = ms.length ? squad.filter(played) : squad;
  const benchNo = ms.length ? squad.filter(s => !played(s) && !s.h.withdrawn) : [];
  const out = ms.length ? squad.filter(s => !played(s) && s.h.withdrawn) : [];
  const clsOf = s => [s.h.firstCall ? 'first' : '', prev && !prev.has(s.p.id) && !s.h.firstCall ? 'newin' : '', s.h.withdrawn ? 'wd' : ''].filter(Boolean).join(' ');
  const side = sideOf(ms);
  $('pitch').querySelectorAll('.side').forEach(e => e.remove());
  $('bands').innerHTML = bandsHTML(onPitch, s => nosOf(s.h).join('·'), clsOf, null, s => side(s.p.id));
  $('bench').hidden = !ms.length;
  $('bench').innerHTML = ms.length ?
    '<h3>出場しなかった選手 <small>' + benchNo.length + '人</small></h3><div class="bench-row">' +
      (benchNo.length ? benchNo.map(s => benchChip(s.p, nosOf(s.h).join('·'), s.h.firstCall ? 'first' : '')).join('') : '<p class="none">全員が出場しました。</p>') + '</div>' +
    (out.length ? '<h3>離脱・不参加 <small>' + out.length + '人</small></h3><div class="bench-row">' + out.map(s => benchChip(s.p, nosOf(s.h).join('·'), 'wd')).join('') + '</div>' : '')
    : '';
  $('legend').innerHTML = '<span><i class="lg first"></i>初招集</span><span><i class="lg newin"></i>前回いなかった選手</span>' +
    '<details class="howto"><summary>見方</summary><p>ピッチはこの活動で出場した選手、下は出場しなかった選手。各列は試合での立ち位置の左右の順。数字はその活動の試合での背番号（変わった場合は「20·10」）。「前回」はE-1選手権を除いた一つ前の活動。上の試合を選ぶと、布陣と試合の流れを再生できます。</p></details>';
  let html = '<div><h3>この活動の試合</h3><ul class="results">' + (ms.length ? ms.map((m, i) =>
    '<li data-mi="' + i + '" style="cursor:pointer"><span class="d">' + esc(md(m.date)) + '</span><span class="o">' + esc(m.opponent) + '</span>' +
    '<span class="s">' + m.gf + '-' + m.ga + '</span><span class="res' + (m.result === '勝' ? ' w' : '') + '">' + esc(m.result) + '</span></li>').reverse().join('')
    : '<li class="none">試合の記録はまだありません。</li>') + '</ul></div>';
  if (prev){
    const outs = [...prev].filter(id => !here.has(id)).map(id => BY_ID[id]).sort((x, y) => POS_ORDER[x.position] - POS_ORDER[y.position]);
    html += '<div><h3>' + esc(prevAct.name) + 'から外れた選手（' + outs.length + '名）</h3><div class="outs">' +
      (outs.length ? outs.map(p => '<button class="chip" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>').join('') : '<p class="none">いません。</p>') + '</div></div>';
  }
  $('under').innerHTML = html;
}

/* 試合：時間ごとにピッチ上の11人と得点を動かす */
function matchState(m, minute, opt){
  opt = opt || {};
  const entry = m.entry && m.entry.length ? m.entry : PLAYERS.filter(p => appOf(p, m.id)).map(p => ({p: p.id, no: ''}));
  const rows = entry.map(e => {
    const p = BY_ID[e.p]; const ap = p ? appOf(p, m.id) : null;
    const from = ap ? (ap.start ? 0 : ap.in) : null;
    const to = ap ? (ap.out == null ? Infinity : ap.out) : null;
    return {p, no: e.no, ap, from, to};
  }).filter(r => r.p);
  const lm = opt.lineupAt == null ? minute : opt.lineupAt;   // 選手の並びを決める時間
  const atEnd = lm >= m.length;
  const on = rows.filter(r => r.ap && r.from <= lm && (lm < r.to || (atEnd && r.to === Infinity)));
  const gAt = (m.goals || []).filter(g => g.min === minute);
  const goals = (m.goals || []).filter(g => g.min < minute).concat(gAt.slice(0, opt.gk == null ? gAt.length : opt.gk));
  return {
    rows, on,
    upcoming: rows.filter(r => r.ap && r.from > lm),
    off: rows.filter(r => r.ap && r.to <= lm && r.to !== Infinity),
    unused: rows.filter(r => !r.ap),
    jp: goals.filter(g => g.team === '日本').length,
    op: goals.filter(g => g.team !== '日本').length,
    goalsBy: goals.reduce((o, g) => { if (g.team === '日本' && !g.og && g.p) o[g.p] = (o[g.p] || 0) + 1; return o; }, {}),
  };
}
const KIND_JA = {PK: 'PK', FK: '直接FK', header: 'ヘディング'};
function goalDetail(g){
  const xs = [];
  if (g.as) xs.push('アシスト ' + esc(g.as));
  if (KIND_JA[g.kind]) xs.push(KIND_JA[g.kind]);
  return xs.length ? '<span class="lt">（' + xs.join('・') + '）</span>' : '';
}
/* 布陣：その分の各選手の位置（列・左から）。データがなければ null */
const hasSlots = m => (m.slots || []).length > 0;
function slotAt(m, pid, minute){
  let s = null;
  (m.slots || []).forEach(x => { if (x.p === pid && x.min <= minute) s = x; });
  return s;
}
function formAt(m, minute){
  let f = m.form || '';
  (m.slots || []).forEach(x => { if (x.form && x.min <= minute) f = x.form; });
  return f;
}
function subPairs(m, x){
  return (m.slots || []).filter(s => s.min === x && s.outFor).map(s => ({inP: BY_ID[s.p], outP: BY_ID[s.outFor], pos: s.pos}));
}
function formationHTML(m, list, minute, noOf, clsOf, extraOf){
  const placed = list.map(r => ({r, s: slotAt(m, r.p.id, minute)}));
  const maxLine = Math.max(1, ...placed.map(x => x.s ? x.s.line : 0));
  const byLine = {};
  placed.forEach(x => { const L = x.s ? x.s.line : 1; (byLine[L] = byLine[L] || []).push(x); });
  let i = 0, html = '';
  Object.keys(byLine).map(Number).sort((a, b) => a - b).forEach(L => {
    const xs = byLine[L].sort((a, b) => (a.s ? a.s.order : 99) - (b.s ? b.s.order : 99));
    const n = xs.length, gap = Math.min(22, 84 / n);
    const top = 88 - L * (70 / maxLine);   // GK=88%、最前列=18%
    xs.forEach((x, k) => {
      const left = 50 + (k - (n - 1) / 2) * gap;
      const sub = x.s && x.s.outFor ? '⇄' + esc((BY_ID[x.s.outFor] || {}).name || '') : '';
      html += chipHTML(x.r.p, noOf(x.r), clsOf(x.r), i++, extraOf ? extraOf(x.r) : '',
        {style: ';left:' + left.toFixed(2) + '%;top:' + top.toFixed(2) + '%', pos: x.s ? x.s.pos : '', sub, inMin: x.s && x.s.outFor ? x.s.min : null});
    });
  });
  const est = placed.some(x => x.s && x.s.unc);
  return '<div class="formation"' + (est ? ' data-est="1"' : '') + '>' + html + '</div>';
}
/* 活動全体：その活動の試合での左右の位置の平均（0=左〜1=右） */
function sideOf(ms){
  const sum = {}, cnt = {};
  ms.forEach(m => {
    const lines = {};
    (m.slots || []).forEach(s => { lines[s.min + ':' + s.line] = Math.max(lines[s.min + ':' + s.line] || 0, s.order); });
    const width = {};
    (m.slots || []).forEach(s => { if (s.min === 0) width[s.line] = Math.max(width[s.line] || 0, s.order); });
    (m.slots || []).forEach(s => {
      const w = width[s.line] || s.order;
      const x = w <= 1 ? .5 : (s.order - 1) / (w - 1);
      sum[s.p] = (sum[s.p] || 0) + x; cnt[s.p] = (cnt[s.p] || 0) + 1;
    });
  });
  return pid => cnt[pid] ? sum[pid] / cnt[pid] : null;
}
function matchEvents(m){
  const ev = [];
  (m.goals || []).forEach(g => ev.push({min: g.min, kind: g.team === '日本' ? 'g' : 'ga',
    text: g.team === '日本' ? (g.og ? '相手のオウンゴール' : '<b>' + esc(g.scorer) + '</b> 得点' + goalDetail(g)) : (g.og ? '<b>' + esc(g.scorer) + '</b> オウンゴール' : esc(m.opponent) + ' 得点' + (g.scorer ? '（' + esc(g.scorer) + '）' : ''))}));
  const ins = {}, outs = {};
  PLAYERS.forEach(p => { const ap = appOf(p, m.id); if (!ap) return;
    if (!ap.start && ap.in != null) (ins[ap.in] = ins[ap.in] || []).push(p.name);
    if (ap.out != null) (outs[ap.out] = outs[ap.out] || []).push(p.name); });
  const mins = new Set([...Object.keys(ins), ...Object.keys(outs)].map(Number));
  [...mins].forEach(x => {
    const pairs = subPairs(m, x);
    ev.push({min: x, kind: 's', text: pairs.length
      ? '交代　' + pairs.map(q => (q.pos ? '<span class="lt">' + esc(q.pos) + '</span> ' : '') + esc(q.outP ? q.outP.name : '') + ' → <b>' + esc(q.inP ? q.inP.name : '') + '</b>').join('／')
      : (!ins[x] && outs[x] ? '退く　' + esc(outs[x].join('、')) + '（交代なし。人数が1人減る）'
      : '交代　' + (ins[x] ? '<b>' + esc(ins[x].join('、')) + '</b> が入り、' : '') + (outs[x] ? esc(outs[x].join('、')) + ' が退く' : ''))});
  });
  return ev.sort((a, b) => a.min - b.min || (a.kind === 's') - (b.kind === 's'));
}
/* 試合のモーション再生
   時計はなめらかに進め、ピッチは出来事（得点・交代・前後半）のときだけ動かす。
   選手は同じ要素のまま位置を移し（FLIP）、退く選手は下へ抜け、入る選手は下から入ってくる。 */
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
let tf = 0, playing = false, busy = false, lastTs = 0, token = 0, speed = 1;
let CUR_M = null, EV_MIN = new Set();
const BASE = 6;   // 1秒あたりの試合時間（分）
const hasGoalData = m => (m.goals || []).length > 0 || (m.gf === 0 && m.ga === 0);
const subsAt = (m, x) => {
  const ins = [], outs = [];
  PLAYERS.forEach(p => { const ap = appOf(p, m.id); if (!ap) return;
    if (!ap.start && ap.in === x) ins.push(p); if (ap.out === x) outs.push(p); });
  return {ins, outs};
};
function eventMinutes(m){
  const set = new Set((m.goals || []).map(g => g.min));
  PLAYERS.forEach(p => { const ap = appOf(p, m.id); if (!ap) return;
    if (!ap.start && ap.in != null) set.add(ap.in); if (ap.out != null) set.add(ap.out); });
  set.add(45);
  return set;
}

function renderMatch(a, m){
  CUR_M = m; EV_MIN = eventMinutes(m);
  $('board').hidden = false; $('ctrlwrap').hidden = false;
  const len = m.length || 90;
  const rng = $('minute'); rng.max = len; rng.step = '0.1';
  $('axis-end').textContent = len + "'";
  $('marks').innerHTML = matchEvents(m).map(e => '<i class="' + e.kind + '" style="left:' + (e.min / len * 100).toFixed(2) + '%"></i>').join('');
  const hl = (DB.hl || {})[m.id], hla = $('hl');
  hla.hidden = !hl;
  if (hl){ hla.href = hl.url; hla.innerHTML = '<span class="yt">▶</span><span><b>公式ハイライトを見る</b><small>' + esc(hl.channel) + '・YouTube</small></span>'; }
  $('board-note').textContent = (hasGoalData(m) ? '' : '得点の時間はまだ登録されていないため、スコアは試合終了時だけ表示します。') +
    'アディショナルタイムの出来事は45分・90分にまとめています。';
  $('score').innerHTML = '<span class="tm">日本<small>' + flg('日本', 'sm') + esc(m.form || '') + '</small>' + '</span><span class="sc"><b id="sc-j">0</b>-<b id="sc-o">0</b><span class="clock" id="clock"></span></span><span class="tm"><button class="tbtn" type="button" data-team="' + esc(m.opponent) + '" aria-label="' + esc(m.opponent) + 'の詳細">' + esc(m.opponent) + '</button><small>' + flg(m.opponent, 'sm') + esc(m.oppForm || '') + '</small>' + '</span>';
  $('cutin').className = 'cutin'; $('cutin').innerHTML = '';
  tf = t;
  drawState(m, {animate: false});
}

function drawClock(m){
  const len = m.length || 90;
  $('minute').value = Math.min(tf, len);
  $('clock').textContent = t >= len ? '試合終了' : Math.floor(tf) + "'";
  // ピッチ右上のスコアと試合時間（テレビ中継のスコア表示のように）
  const mc = ensureMC(m);
  const x = Math.min(tf, len), mm = Math.floor(x), ss = Math.floor((x - mm) * 60);
  mc.classList.toggle('on', playing && x < len);
  mc.querySelector('small').textContent = x >= len ? '終了' : x === 0 && !playing ? '開始前' : x < 45 ? '前半' : (x === 45 && busy) ? 'HT' : x < 90 ? '後半' : '延長';
  const cop = $('cs-op'); if (cop.dataset.n !== m.opponent){ cop.dataset.n = m.opponent; cop.innerHTML = abv(m.opponent); $('cs-jp').innerHTML = abv('日本'); }
  const tm = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  const tmh = tm.split('').map(ch => ch === ':' ? '<b class="col">:</b>' : '<b>' + ch + '</b>').join('');
  $('cs-c').innerHTML = '<small>' + mc.querySelector('small').textContent + '</small><span class="mm">' + tmh + '</span>';
  mc.querySelector('.mm').innerHTML = tmh;
}
function ensureMC(m){
  let mc = $('mclock');
  if (!mc){
    $('pitch').insertAdjacentHTML('beforeend', '<div class="mclock" id="mclock" aria-hidden="true"><span class="sb"><span class="sb-t">' + abv('日本') + '</span><b class="sb-s"><em id="mc-j">0</em><span>-</span><em id="mc-o">0</em></b><span class="sb-t sb-o"></span></span><span class="sb-c"><i></i><small></small><span class="mm"></span></span></div>');
    mc = $('mclock');
  }
  const on = mc.querySelector('.sb-o');
  if (on.dataset.n !== m.opponent){ on.dataset.n = m.opponent; on.innerHTML = abv(m.opponent); }
  return mc;
}
function drawScore(m, st, bump){
  const len = m.length || 90;
  const known = hasGoalData(m);
  const j = known ? st.jp : (t >= len ? m.gf : '–');
  const o = known ? st.op : (t >= len ? m.ga : '–');
  const ej = $('sc-j'), eo = $('sc-o');
  const changed = [];
  if (ej.textContent !== String(j)){ ej.textContent = j; changed.push(ej); }
  if (eo.textContent !== String(o)){ eo.textContent = o; changed.push(eo); }
  const mc = ensureMC(m), mj = $('mc-j'), mo = $('mc-o');
  if (mj.textContent !== String(j)){ mj.textContent = j; changed.push(mj); }
  if (mo.textContent !== String(o)){ mo.textContent = o; changed.push(mo); }
  const cj = $('cs-j'), co = $('cs-o');
  if (cj.textContent !== String(j)){ cj.textContent = j; changed.push(cj); }
  if (co.textContent !== String(o)){ co.textContent = o; changed.push(co); }
  if (bump && !REDUCED) changed.forEach(el => el.animate([{transform:'scale(1.9)', color:'#ffd84d'}, {transform:'scale(1)'}], {duration: 650, easing: 'cubic-bezier(.2,1.4,.4,1)'}));
}

/* opt: animate（動かすか）, lineupAt / gk（その分の途中の状態）, scorer（光らせる選手） */
function drawState(m, opt){
  opt = opt || {};
  const st = matchState(m, t, opt);
  const bands = $('bands'), pitch = $('pitch');
  const anim = opt.animate && !REDUCED;
  if (opt.animate !== undefined && opt.keepSwap !== true && CUR_M && pitch.classList.contains('swap') && (opt.animate || t > 0)) pitch.classList.remove('swap');
  const before = {};
  if (anim) bands.querySelectorAll('.pl').forEach(el => { before[el.dataset.id] = {r: el.getBoundingClientRect(), html: el.outerHTML}; });
  const lm = opt.lineupAt == null ? t : opt.lineupAt;
  const clsS = r => (opt.scorer === r.p.id ? 'scored' : '');
  const glS = r => st.goalsBy[r.p.id] ? '<span class="gl">' + st.goalsBy[r.p.id] + '</span>' : '';
  bands.innerHTML = hasSlots(m) ? formationHTML(m, st.on, lm, r => r.no, clsS, glS) : bandsHTML(st.on, r => r.no, clsS, glS);
  $('estnote').textContent = bands.querySelector('.formation[data-est]') ? '※ 一部の選手の位置は、試合データと報道からの推定です' : '';
  const f = formAt(m, lm);
  pitch.querySelectorAll('.side').forEach(e => e.remove());
  pitch.insertAdjacentHTML('beforeend', '<button type="button" class="side opp" data-team="' + esc(m.opponent) + '" aria-label="' + esc(m.opponent) + 'の詳細"><span>' + abv(m.opponent) + (m.oppForm ? '<b>' + esc(m.oppForm) + '</b>' : '') + '<i class="i">i</i><em class="dir">▲攻める方向</em></span></button>' +
    '<div class="side us"><span>' + abv('日本') + (f ? '<b>' + esc(f) + '</b>' : '') + '</span></div>');
  if (anim){
    const pr = pitch.getBoundingClientRect();
    const seen = new Set();
    bands.querySelectorAll('.pl').forEach(el => {
      const id = el.dataset.id; seen.add(id);
      const r = el.getBoundingClientRect(), b = before[id];
      if (b){
        const dx = b.r.left - r.left, dy = b.r.top - r.top;
        if (Math.abs(dx) + Math.abs(dy) > 1) el.animate([{transform: 'translate(' + dx + 'px,' + dy + 'px)'}, {transform: 'none'}], {duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)'});
      } else {
        el.classList.add('in');
        el.animate([{transform: 'translateY(' + (pr.bottom - r.top) + 'px) scale(.6)', opacity: 0}, {transform: 'translateY(-8px) scale(1.12)', opacity: 1, offset: .75}, {transform: 'none', opacity: 1}],
          {duration: 820, easing: 'cubic-bezier(.2,.8,.2,1)'});
      }
    });
    Object.keys(before).forEach(id => {
      if (seen.has(id)) return;
      const b = before[id];
      const g = document.createElement('div');
      g.className = 'leave';
      g.style.left = (b.r.left - pr.left) + 'px'; g.style.top = (b.r.top - pr.top) + 'px';
      g.innerHTML = b.html;
      pitch.appendChild(g);
      g.animate([{transform: 'none', opacity: 1}, {transform: 'translateY(-10px) scale(1.05)', opacity: 1, offset: .2}, {transform: 'translateY(' + (pr.bottom - b.r.top + 20) + 'px) scale(.6)', opacity: 0}],
        {duration: 760, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards'}).onfinish = () => g.remove();
    });
  }
  drawScore(m, st, opt.animate);
  drawClock(m);
  $('bench').hidden = false;
  $('bench').innerHTML =
    '<h3>ベンチ <small>これから出る ' + st.upcoming.length + '人／出場なし ' + st.unused.length + '人</small></h3><div class="bench-row">' +
      st.upcoming.map(r => benchChip(r.p, r.no, '', r.from + "'に出場")).join('') +
      st.unused.map(r => benchChip(r.p, r.no, '', '')).join('') + '</div>' +
    (st.off.length ? '<h3>交代で退いた選手 <small>' + st.off.length + '人</small></h3><div class="bench-row">' +
      st.off.map(r => { const q = (m.slots || []).find(s => s.outFor === r.p.id && s.min === r.to);
        return benchChip(r.p, r.no, 'off', r.to + "'まで" + (q && BY_ID[q.p] ? ' → ' + BY_ID[q.p].name : '')); }).join('') + '</div>' : '');
  $('legend').innerHTML = '<details class="howto"><summary>見方</summary><p>ピッチは日本が上に攻める向きの布陣。選手の上は立ち位置（試合データと報道で確認したもの。確かめきれない位置を含む場面は、ピッチの下に「推定」と表示）、緑の丸は途中出場した分、緑の札「⇄名前」は代わって退いた選手。▶ を押すと、時計が進み、得点と交代の場面で選手が入れ替わります。出来事の一覧を押すと、その場面から動きます。青い丸の数字は、その時点までの得点数です。</p><p>ゴールの場面のボールの線は「アシストした選手 → 得点者 → ゴール」の流れを表す模式図で、実際の位置や軌道ではありません（アシスト・PK・直接FK・ヘディングは公式記録と報道で確認したもの）。</p></details>';
  const ev = matchEvents(m);
  $('under').innerHTML = '<div style="grid-column:1/-1"><h3>試合の流れ</h3><ul class="events">' +
    (ev.length ? ev.map(e => '<li data-min="' + e.min + '" class="' + (e.min <= t ? 'past' : 'future') + '"><span class="mi">' + e.min + "'</span><i class=\"ic " + e.kind + '"></i><span>' + e.text + '</span></li>').join('') : '<li class="none">記録された出来事はありません。</li>') +
    '</ul><p class="note-s" style="margin-top:8px">' + esc(m.venue || '') + '　' + esc(m.competition || '') +
    (SLUGS.m[m.id] ? '　<a href="matches/' + SLUGS.m[m.id] + '.html">この試合の記録ページ</a>' : '') + '</p></div>';
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function cutin(cls, html, hold){
  const c = $('cutin');
  if (REDUCED){ c.className = 'cutin ' + cls; c.innerHTML = '<div class="ci" style="opacity:1;transform:skewY(-7deg)"><div class="ci-in">' + html + '</div></div>'; await wait(hold); c.className = 'cutin'; c.innerHTML = ''; return; }
  c.className = 'cutin ' + cls; c.innerHTML = '<div class="ci"><div class="ci-in">' + html + '</div></div>';
  void c.offsetWidth; c.classList.add('show');
  await wait(380 + hold);
  c.classList.remove('show'); c.classList.add('hide');
  await wait(320);
  c.className = 'cutin'; c.innerHTML = '';
}

/* ゴールの場面：アシスト→得点者→ゴールの流れをボールで描く。
   線は「誰から誰へ渡って決まったか」を示す模式図で、実際の位置や軌道ではない。 */
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function chipCenter(id){
  if (!id) return null;
  const el = document.querySelector('#bands .pl[data-id="' + id + '"] .no');
  if (!el) return null;
  const r = el.getBoundingClientRect(), pr = $('pitch').getBoundingClientRect();
  return {x: r.left + r.width / 2 - pr.left, y: r.top + r.height / 2 - pr.top};
}
const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
function legPath(a, b, arc){
  // 進行方向の右側にふくらむ2次ベジェ
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const c = {x: mx - dy / L * arc, y: my + dx / L * arc};
  return {c, d: 'M' + a.x + ' ' + a.y + ' Q' + c.x + ' ' + c.y + ' ' + b.x + ' ' + b.y};
}
function animLeg(svg, ball, leg, my){
  return new Promise(res => {
    const {c, d} = legPath(leg.from, leg.to, leg.arc || 0);
    const path = svgEl('path', {d, class: 'trail' + (leg.cls ? ' ' + leg.cls : '')});
    svg.insertBefore(path, ball);
    const len = path.getTotalLength();
    path.style.strokeDasharray = leg.cls && leg.cls.includes('pass') ? '' : len;
    if (!(leg.cls && leg.cls.includes('pass'))) path.style.strokeDashoffset = len;
    const t0 = performance.now(), dur = leg.dur / Math.sqrt(speed);
    const frame = now => {
      if (my !== token) return res(false);
      const k = Math.min(1, (now - t0) / dur), e = leg.shot ? k * k * (1.6 - .6 * k) : ease(k);
      const x = (1 - e) * (1 - e) * leg.from.x + 2 * (1 - e) * e * c.x + e * e * leg.to.x;
      const y = (1 - e) * (1 - e) * leg.from.y + 2 * (1 - e) * e * c.y + e * e * leg.to.y;
      const lift = leg.high ? Math.sin(Math.PI * e) * 0.9 : 0;   // ヘディングへのクロスは浮かせる
      ball.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + (1 + lift) + ')');
      if (leg.cls && leg.cls.includes('pass')) path.setAttribute('d', 'M' + leg.from.x + ' ' + leg.from.y + ' Q' + ((1 - e) * leg.from.x + e * c.x) + ' ' + ((1 - e) * leg.from.y + e * c.y) + ' ' + x + ' ' + y);
      else path.style.strokeDashoffset = len * (1 - e);
      if (k < 1) requestAnimationFrame(frame); else res(true);
    };
    requestAnimationFrame(frame);
  });
}
async function ballPlay(m, g, k){
  if (REDUCED) return true;
  const my = token;
  const pitch = $('pitch'), svg = $('fx');
  const W = pitch.clientWidth, H = pitch.clientHeight, jp = g.team === '日本';
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = '';
  // ゴールの位置（日本は上へ攻める）
  const gy = jp ? 12 : H - 12;
  const gx = W / 2 + ((g.min * 7 + k * 13) % 9 - 4) * W * 0.012;
  svg.appendChild(svgEl('rect', {class: 'goalmouth', x: W / 2 - W * 0.09, y: jp ? 2 : H - 12, width: W * 0.18, height: 10, rx: 2}));
  const ball = svgEl('g', {transform: 'translate(-50 -50)'});
  ball.appendChild(svgEl('circle', {r: 8, fill: '#fff', stroke: '#0b1a3a', 'stroke-width': 1.5}));
  ball.appendChild(svgEl('path', {d: 'M0 -3.2 L3 -1 L1.9 2.6 L-1.9 2.6 L-3 -1Z', fill: '#0b1a3a'}));
  svg.appendChild(ball);
  const goal = {x: gx, y: gy};
  const legs = [];
  const sc = jp && !g.og ? (chipCenter(g.p) || {x: W / 2, y: H * .24}) : null;
  if (jp && !g.og){
    if (g.kind === 'PK') legs.push({from: {x: W / 2, y: 12 + H * 0.085}, to: goal, dur: 460, shot: true});
    else if (g.kind === 'FK') legs.push({from: {x: sc.x < W / 2 ? W * .3 : W * .7, y: H * .27}, to: goal, arc: sc.x < W / 2 ? -46 : 46, dur: 720, shot: true});
    else {
      const as = chipCenter(g.ap);
      if (as) legs.push({from: as, to: sc, arc: g.kind === 'header' ? 60 : 22, dur: 700, cls: 'pass', high: g.kind === 'header'});
      else legs.push({from: {x: sc.x + (sc.x < W / 2 ? 34 : -34), y: sc.y + 62}, to: sc, arc: 0, dur: 520, cls: 'pass'});
      legs.push({from: sc, to: goal, arc: 10, dur: 400, shot: true});
    }
  } else if (jp){
    legs.push({from: {x: W * .3, y: H * .3}, to: {x: W * .52, y: H * .15}, arc: 12, dur: 480, cls: 'pass'});
    legs.push({from: {x: W * .52, y: H * .15}, to: goal, arc: -6, dur: 280, shot: true});
  } else {
    const gk = document.querySelector('#bands .pl .no.gk');
    if (g.kind === 'PK') legs.push({from: {x: W / 2, y: H - 12 - H * 0.085}, to: goal, dur: 460, shot: true, cls: 'ga'});
    else {
      legs.push({from: {x: W * .45, y: H * .5}, to: {x: W * .64, y: H * .74}, arc: 18, dur: 560, cls: 'pass ga'});
      legs.push({from: {x: W * .64, y: H * .74}, to: goal, arc: 6, dur: 380, shot: true, cls: 'ga'});
    }
  }
  // カメラを寄せる・REPLAY・下のテロップ
  pitch.style.setProperty('--zo', '50% ' + (jp ? '8%' : '92%'));
  pitch.classList.add('zoom');
  $('replay').classList.add('on');
  const who = jp ? (g.og ? '相手のオウンゴール' : esc(g.scorer)) : (g.og ? esc(g.scorer) + '（オウンゴール）' : esc(m.opponent) + (g.scorer ? '　' + esc(g.scorer) : ''));
  const lower = $('lower');
  lower.className = 'lower' + (jp ? '' : ' ga');
  lower.innerHTML = '<span class="lm">' + g.min + "'</span><span>" + (jp ? '得点 ' : '失点 ') + who + '</span>' +
    (g.as ? '<span class="lt">アシスト</span><span>' + esc(g.as) + '</span>' : '') +
    (KIND_JA[g.kind] ? '<span class="tag">' + KIND_JA[g.kind] + '</span>' : '');
  void lower.offsetWidth; lower.classList.add('on');
  await wait(450);
  svg.classList.toggle('t2', jp && !!window.BLTitle && BLTitle.lvOf(BLTitle.xp()) >= 2);
  for (const leg of legs){
    if (my !== token) return false;
    const ok = await animLeg(svg, ball, leg, my);
    if (!ok) return false;
  }
  // ネットが揺れる
  const ring = svgEl('circle', {class: 'ring', cx: goal.x, cy: goal.y, r: 4});
  svg.appendChild(ring);
  ring.animate([{r: 4, opacity: 1}, {r: 60, opacity: 0}], {duration: 650, easing: 'ease-out'});
  svg.querySelector('.goalmouth').animate([{transform: 'translateY(0)', fill: 'rgba(255,255,255,.9)'}, {transform: 'translateY(' + (jp ? -4 : 4) + 'px)'}, {transform: 'translateY(0)', fill: 'rgba(255,255,255,.18)'}], {duration: 420});
  await wait(520);
  return my === token;
}
function clearFx(){
  const svg = $('fx'); if (svg) svg.innerHTML = '';
  const p = $('pitch'); if (p) p.classList.remove('zoom');
  ['replay', 'lower'].forEach(id => { const e = $(id); if (e) e.classList.remove('on'); });
}

/* x分の出来事を順番に見せる。途中で止められたら（token が変わったら）やめる */
async function runMinute(m, x){
  const my = token;
  const alive = () => my === token && CUR_M === m;
  const goals = (m.goals || []).filter(g => g.min === x);
  const {ins, outs} = subsAt(m, x);
  t = x; tf = x;
  for (let k = 1; k <= goals.length; k++){
    const g = goals[k - 1], jp = g.team === '日本';
    const st = matchState(m, x, {lineupAt: x - 1, gk: k});
    const who = jp ? (g.og ? '相手のオウンゴール' : esc(g.scorer)) : (g.og ? esc(g.scorer) + '（オウンゴール）' : esc(m.opponent) + (g.scorer ? '　' + esc(g.scorer) : ''));
    if (!(await ballPlay(m, g, k))) return false;
    const tl = jp && window.BLTitle ? BLTitle.lvOf(BLTitle.xp()) : 0;
    if (tl >= 3) BLTitle.celebrate($('pitch'), tl, 'gl');
    await cutin((jp ? 'gl' : 'ga') + (tl ? ' t' + tl : ''), '<span class="ci-min">' + x + "'</span><span class=\"ci-big\">GOAL</span><span class=\"ci-sub\">" + who + '　' + st.jp + '-' + st.op + '</span>', 900);
    clearFx();
    if (!alive()) return false;
    drawState(m, {animate: true, lineupAt: x - 1, gk: k, scorer: jp && !g.og ? g.p : null});
    await wait(REDUCED ? 200 : 700);
    if (!alive()) return false;
  }
  if (x === 45 && x < (m.length || 90)){
    await cutin('ft', '<span class="ci-big">HALF TIME</span><span class="ci-sub">日本 ' + matchState(m, x).jp + '-' + matchState(m, x).op + ' ' + esc(m.opponent) + '</span>', 650);
    if (!alive()) return false;
  }
  const second = x === 45 && x < (m.length || 90);
  if (ins.length || outs.length){
    const pairs = subPairs(m, x);
    await cutin('sub', '<span class="ci-min">' + x + "' 交代</span>" + (pairs.length
      ? '<div class="ci-pair">' + pairs.map(q => '<span class="pz">' + esc(q.pos || '') + '</span><span class="dn">▼ ' + esc(q.outP ? q.outP.name : '') + '</span><span>→</span><span class="up">▲ ' + esc(q.inP ? q.inP.name : '') + '</span>').join('') + '</div>'
      : '<div class="ci-row">' + ins.map(p => '<span class="up">▲ ' + esc(p.name) + '</span>').join('') + '</div>' +
        '<div class="ci-row">' + outs.map(p => '<span class="dn">▼ <s>' + esc(p.name) + '</s></span>').join('') + '</div>'), 900 + pairs.length * 150);
    if (!alive()) return false;
    drawState(m, {animate: true});
    await wait(REDUCED ? 200 : 750);
    if (!alive()) return false;
  } else {
    drawState(m, {animate: false});
  }
  if (second){
    await kickOff(m, true);
    if (!alive()) return false;
  }
  return true;
}
/* 試合開始・後半開始の帯 */
async function kickOff(m, second){
  const f = formAt(m, second ? 45 : 0);
  const tk = window.BLTitle ? BLTitle.lvOf(BLTitle.xp()) : 0;
  if (tk >= 5 && !second) BLTitle.celebrate($('pitch'), tk, 'ko');
  await cutin('ko' + (tk >= 5 && !second ? ' t5' : ''), '<span class="ci-min">' + (second ? "45' 後半開始" : "0' 試合開始") + (tk >= 5 && !second ? '　LEGEND MODE' : '') + '</span><span class="ci-big">' + (second ? '2ND HALF' : 'KICK OFF') + '</span>' +
    '<span class="ci-vs">' + flg('日本') + '日本' + (f ? '<small>' + esc(f) + '</small>' : '') + ' vs ' + flg(m.opponent) + esc(m.opponent) + (m.oppForm && !second ? '<small>' + esc(m.oppForm) + '</small>' : '') + '</span>', second ? 700 : 1000);
}
async function fullTime(m){
  const st = matchState(m, t);
  drawState(m, {animate: false});
  await cutin('ft', '<span class="ci-big">FULL TIME</span><span class="ci-sub">日本 ' + (hasGoalData(m) ? st.jp + '-' + st.op : m.gf + '-' + m.ga) + ' ' + esc(m.opponent) + '</span>', 1300);
}

function step(now){
  if (!playing) return;
  const m = CUR_M, len = m.length || 90;
  if (!busy){
    tf += Math.min(now - lastTs, 100) / 1000 * BASE * speed;
    const next = t + 1;
    if (Math.floor(tf) >= next){
      if (next > len){
        tf = len; t = len; busy = true;
        const my = token;
        fullTime(m).then(() => { if (my === token) stopPlay(); });
      } else if (EV_MIN.has(next)){
        busy = true; tf = next;
        runMinute(m, next).then(ok => { busy = false; lastTs = performance.now(); if (!ok) return; });
      } else {
        t = next;
        if (t === len){ /* 最後の1分は次のフレームで試合終了へ */ }
      }
    }
    drawClock(m);
  }
  lastTs = now;
  requestAnimationFrame(step);
}
function setPlayBtn(on){
  const b = $('play'); if (!b) return;
  b.textContent = on ? '❚❚' : '▶';
  b.setAttribute('aria-label', on ? '一時停止' : '試合の流れを再生');
}
function stopPlay(){
  playing = false; busy = false; token++;
  setPlayBtn(false);
  const c = $('cutin'); if (c){ c.className = 'cutin'; c.innerHTML = ''; }
  clearFx();
  document.querySelectorAll('#pitch .leave').forEach(g => g.remove());
}
function jumpTo(x){
  const m = CUR_M; if (!m) return;
  stopPlay();
  t = Math.max(0, Math.min(Math.floor(x), m.length || 90)); tf = x;
  drawState(m, {animate: false});
}
$('play').addEventListener('click', () => {
  const m = CUR_M; if (!m) return;
  if (playing){ stopPlay(); drawState(m, {animate: false}); return; }
  if (t >= (m.length || 90)) jumpTo(0);
  token++; playing = true; busy = false; tf = Math.max(tf, t); lastTs = performance.now();
  setPlayBtn(true);
  drawClock(m);
  if (t === 0 && tf < 0.05){
    busy = true; const my = token;
    kickOff(m, false).then(() => { if (my !== token) return; busy = false; lastTs = performance.now(); });
  }
  requestAnimationFrame(step);
});
$('speed').addEventListener('click', () => {
  speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  $('speed').textContent = '×' + speed;
});
$('minute').addEventListener('input', e => jumpTo(+e.target.value));
$('mtabs').addEventListener('click', e => { const b = e.target.closest('.mt'); if (!b) return; mi = +b.dataset.mi; renderSheet(true); });
$('under').addEventListener('click', e => {
  const r = e.target.closest('.results li[data-mi]'); if (r){ mi = +r.dataset.mi; renderSheet(true); return; }
  const ev = e.target.closest('.events li[data-min]');
  if (ev){
    const m = CUR_M, x = +ev.dataset.min;
    jumpTo(Math.max(0, x - 1));
    $('pitch').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'center'});
    token++; const my = token;
    busy = true;
    setTimeout(() => { if (my !== token) return; runMinute(m, x).then(() => { if (my === token) busy = false; }); }, REDUCED ? 0 : 350);
  }
});
$('ticks').innerHTML = ACTS.map((a, i) => '<button class="tick" type="button" data-i="' + i + '" title="' + esc(a.name) + '" aria-label="' + esc(a.name) + '"></button>').reverse().join('');   // 左が新しい
$('ticks').addEventListener('click', e => { const x = e.target.closest('.tick'); if (x){ cur = +x.dataset.i; mi = -1; renderSheet(true); } });
$('prev').addEventListener('click', () => { if (cur < ACTS.length - 1){ cur++; mi = -1; renderSheet(true); } });   // 左＝新しい方へ
$('next').addEventListener('click', () => { if (cur > 0){ cur--; mi = -1; renderSheet(true); } });                 // 右＝古い方へ

/* 前回の訪問からの更新は「きょうの日本代表」に移した */


/* ---------- 選手本人の公式SNS（appearances/sns.json。公式と確認できたものだけ） ---------- */
const SNS = DB.sns || {};
const SNS_LABEL = {instagram: 'Instagram', x: 'X', tiktok: 'TikTok', youtube: 'YouTube'};
function snsLinks(pid, cls){
  const s = SNS[pid]; if (!s) return '';
  return '<span class="' + (cls || 'sns') + '">' + Object.keys(SNS_LABEL).filter(k => s[k]).map(k =>
    '<a class="s-' + k + '" href="' + esc(s[k]) + '" target="_blank" rel="noopener">' + SNS_LABEL[k] + '</a>').join('') + '</span>';
}

/* ---------- きょうの日本代表（毎日変わる：更新・誕生日・この日の代表・クイズ・メンバー予想） ---------- */
const NOW = new Date();
const TD = {key: NOW.getFullYear() + '-' + (NOW.getMonth() + 1) + '-' + NOW.getDate(),
  md: String(NOW.getMonth() + 1).padStart(2, '0') + '/' + String(NOW.getDate()).padStart(2, '0')};
const YD = (() => { const d = new Date(NOW); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
function seeded(seed){ let x = 2166136261; for (const c of seed) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SITE = "https://bluelist-jp.com";
const xShare = text => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + (SITE && !/example\.com/.test(SITE) ? '&url=' + encodeURIComponent(SITE + '/') : '');
const jd = d => Number(d.slice(0, 4)) + '年' + Number(d.slice(5, 7)) + '月' + Number(d.slice(8, 10)) + '日';
const LAST_SQUAD = () => squadOf(LAST.id);

function todayUpdates(){
  const fr = (INFO.fifa || []).slice(-1)[0];
  const snap = {acts: ACTS.length, matches: MATCHES.length, fifa: fr ? fr.date : '', world: DB.world ? DB.world.date : ''};
  const old = store.get('snap', null);
  store.set('snap', snap);
  if (!old) return [];
  const out = [];
  if (snap.acts > old.acts) out.push('新しいメンバー発表が' + (snap.acts - old.acts) + '件（' + esc(LAST.name) + '）');
  if (snap.matches > old.matches) out.push('新しい試合の記録が' + (snap.matches - old.matches) + '件');
  if (snap.fifa && snap.fifa !== old.fifa && fr) out.push('FIFAランキング更新：日本は' + fr.rank + '位');
  return out;
}
function todayBirthdays(){
  const recent = new Set(ACTS.slice(-4).flatMap(a => squadOf(a.id).map(x => x.p.id)));
  const bd = p => p.birthday ? p.birthday.slice(5) : '';
  const today = PLAYERS.filter(p => bd(p) === TD.md);
  if (today.length) return today.map(p => '今日は<button class="lk" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>の' + (NOW.getFullYear() - Number(p.birthday.slice(0, 4))) + '歳の誕生日' +
    (SNS[p.id] ? '<span class="bdsns">お祝いを送る：' + snsLinks(p.id, 'sns in') + '</span>' : ''));
  // 1週間以内（最近招集された選手）
  const soon = [];
  for (let k = 1; k <= 7; k++){
    const d = new Date(NOW); d.setDate(d.getDate() + k);
    const md = String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    PLAYERS.filter(p => recent.has(p.id) && bd(p) === md).forEach(p => soon.push(k + '日後は<button class="lk" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>の誕生日'));
  }
  return soon.slice(0, 2);
}
function todayOnThisDay(){
  const hit = MATCHES.filter(m => m.date.slice(5) === TD.md && Number(m.date.slice(0, 4)) < NOW.getFullYear());
  return hit.map(m => (NOW.getFullYear() - Number(m.date.slice(0, 4))) + '年前の今日：<button class="lk" data-goto="' + esc(m.id) + '">日本 ' + m.gf + '-' + m.ga + ' ' + esc(m.opponent) + '</button>');
}

/* クイズ：日付で決まる1問。全員同じ問題になる */
function buildQuiz(key){
  const rnd = seeded('q' + key);
  const pool = [];
  const nameOf = id => (BY_ID[id] || {}).name;
  // 1) 得点者
  MATCHES.forEach(m => (m.goals || []).forEach(g => {
    if (g.team !== '日本' || g.og || !g.p) return;
    const played = PLAYERS.filter(p => appOf(p, m.id) && p.id !== g.p).map(p => p.id);
    if (played.length >= 3) pool.push(() => ({q: jd(m.date) + 'の' + m.opponent + '戦。' + g.min + '分にゴールを決めたのは？', a: nameOf(g.p),
      wrong: shuffle(played, rnd).slice(0, 3).map(nameOf), note: '日本 ' + m.gf + '-' + m.ga + ' ' + m.opponent, goto: m.id, pid: g.p}));
  }));
  // 2) 背番号と 3) 所属クラブ（最新の活動）
  const sq = LAST_SQUAD().filter(x => !x.h.withdrawn);
  sq.forEach(x => {
    const no = x.h.number;
    if (no !== '' && no != null) pool.push(() => ({q: LAST.name + 'で背番号' + no + 'を付けたのは？', a: x.p.name,
      wrong: shuffle(sq.filter(y => y.p.id !== x.p.id), rnd).slice(0, 3).map(y => y.p.name), note: '', pid: x.p.id}));
    const clubs = [...new Set(sq.map(y => y.h.club).filter(c => c && c !== x.h.club))];
    if (x.h.club && clubs.length >= 3) pool.push(() => ({q: x.p.name + 'の所属クラブは？（' + LAST.name + 'の発表時点）', a: x.h.club,
      wrong: shuffle(clubs, rnd).slice(0, 3), note: '', pid: x.p.id}));
  });
  // 4) スコア
  MATCHES.forEach(m => {
    const alt = new Set([m.gf + '-' + m.ga]);
    const cand = [[m.gf + 1, m.ga], [m.gf, m.ga + 1], [Math.max(0, m.gf - 1), m.ga], [m.ga, m.gf], [m.gf + 1, m.ga + 1], [m.gf, Math.max(0, m.ga - 1)]]
      .map(([a, b]) => a + '-' + b).filter(x => !alt.has(x) && (alt.add(x), true));
    if (cand.length >= 3) pool.push(() => ({q: jd(m.date) + '、日本 vs ' + m.opponent + 'のスコアは？（日本-相手）', a: m.gf + '-' + m.ga,
      wrong: shuffle(cand, rnd).slice(0, 3), note: m.result === '勝' ? '日本の勝ち' : m.result === '敗' ? '日本の負け' : '引き分け', goto: m.id}));
  });
  const pick = pool[Math.floor(rnd() * pool.length)]();
  pick.choices = shuffle([pick.a, ...pick.wrong], rnd);
  return pick;
}
function quizHTML(){
  const Q = buildQuiz(TD.key);
  const done = store.get('quiz', {});
  const st = store.get('quizStats', {streak: 0, total: 0, right: 0, last: ''});
  const ans = done.date === TD.key ? done.choice : null;
  const ok = ans != null && ans === Q.a;
  return '<div class="qz" id="qz"><div class="qh"><b>今日の代表クイズ</b><small>' + (st.total ? '正解' + st.right + '/' + st.total + (st.streak > 1 ? '・' + st.streak + '日連続正解' : '') : '毎日1問。明日も新しい問題') + '・' + quizTitle() + '</small></div>' +
    '<p class="qq">' + esc(Q.q) + '</p><div class="qc">' + Q.choices.map(c => {
      const cls = ans == null ? '' : c === Q.a ? ' ok' : c === ans ? ' ng' : ' dim';
      return '<button type="button" class="qb' + cls + '" data-qa="' + esc(c) + '"' + (ans != null ? ' disabled' : '') + '>' + esc(c) + '</button>';
    }).join('') + '</div>' +
    (ans != null ? '<p class="qr">' + (ok ? '正解！' : '残念。正解は「' + esc(Q.a) + '」') + (Q.note ? '　' + esc(Q.note) : '') +
      (Q.goto ? '　<button class="lk" data-goto="' + esc(Q.goto) + '">試合を見る</button>' : Q.pid ? '　<button class="lk" data-id="' + esc(Q.pid) + '">選手を見る</button>' : '') + '</p>' +
      '<a class="xs" href="quiz.html">クイズ集でもっと解く（800問以上）→</a> ' +
      '<a class="xs" target="_blank" rel="noopener" href="' + esc(xShare('BLUE LIST 今日の代表クイズ ' + (ok ? '正解！' : '不正解…') + (st.streak > 1 ? '（' + st.streak + '日連続）' : '') + '\n「' + Q.q + '」\n#BLUELIST #サッカー日本代表')) + '">結果をXでシェア</a>' : '') + '</div>';
}
function quizTitle(){
  if (!window.BLTitle) return '';
  const i = BLTitle.lvOf(BLTitle.xp());
  return '<a class="qtl" href="quiz.html">' + BLTitle.emblem(i, 16) + '称号 ' + BLTitle.LV[i][1] + '</a>';
}
function answerQuiz(c){
  const Q = buildQuiz(TD.key);
  const done = store.get('quiz', {});
  if (done.date === TD.key) return;
  store.set('quiz', {date: TD.key, choice: c});
  const st = store.get('quizStats', {streak: 0, total: 0, right: 0, last: ''});
  const ok = c === Q.a;
  st.total++; if (ok) st.right++;
  st.streak = ok ? (st.last === YD && st.lastOk ? st.streak + 1 : 1) : 0;
  st.last = TD.key; st.lastOk = ok;
  store.set('quizStats', st);
  const xp = store.get('quizXP', {xp: 0, ans: 0, best: {}}); xp.ans++; if (ok) xp.xp++; store.set('quizXP', xp);
  if (window.BLTitle) BLTitle.paint();
  renderToday();
}

/* メンバー予想：次の発表のメンバーを26人まで選んで保存。発表後に答え合わせ */
const PRED_MAX = 26;
function predState(){ return store.get('pred', null); }
function predResult(){
  const pr = predState();
  if (!pr || !pr.picks || !pr.picks.length || pr.base === LAST.id) return null;
  const real = new Set(LAST_SQUAD().map(x => x.p.id));
  const hit = pr.picks.filter(id => real.has(id));
  return {hit: hit.length, n: pr.picks.length, real: real.size, act: LAST.name, missed: [...real].filter(id => !pr.picks.includes(id)).map(id => (BY_ID[id] || {}).name).filter(Boolean)};
}
function predHTML(){
  const pr = predState(), res = predResult();
  let h = '<div class="pd"><div class="qh"><b>次のメンバーを予想</b><small>発表後に答え合わせ</small></div>';
  if (res){
    h += '<p class="pr-res">' + esc(res.act) + 'の予想は<b>' + res.hit + '</b>人的中（' + res.n + '人中）</p>' +
      (res.missed.length ? '<p class="pr-miss">予想に入れていなかった選手：' + res.missed.slice(0, 8).map(esc).join('、') + (res.missed.length > 8 ? ' ほか' : '') + '</p>' : '') +
      '<div class="pdb"><a class="xs" target="_blank" rel="noopener" href="' + esc(xShare('日本代表メンバー予想、' + res.n + '人中' + res.hit + '人的中でした（' + res.act + '）\n#BLUELIST #サッカー日本代表')) + '">結果をXでシェア</a>' +
      '<button type="button" class="pbtn" data-pred="new">次の予想を作る</button></div>';
  } else if (pr && pr.picks && pr.picks.length){
    h += '<p class="pr-res">予想済み <b>' + pr.picks.length + '</b>/' + PRED_MAX + '人（' + esc(pr.at) + '）。次のメンバー発表で答え合わせします。</p><div class="pdb"><button type="button" class="pbtn" data-pred="open">予想を見直す</button></div>';
  } else {
    h += '<p class="pr-res">次の発表に呼ばれる' + PRED_MAX + '人を選んで保存。発表されたら何人当たったか出ます。</p><div class="pdb"><button type="button" class="pbtn main" data-pred="open">予想を始める</button></div>';
  }
  return h + '</div>';
}
function openPred(){
  const pr = predState();
  let picks = new Set(pr && pr.base === LAST.id ? pr.picks : []);
  if (!picks.size && pr && pr.base === LAST.id) picks = new Set(pr.picks);
  let pos = 'ALL', q = '';
  const recent = new Set(ACTS.slice(-4).flatMap(a => squadOf(a.id).map(x => x.p.id)));
  const lastIds = new Set(LAST_SQUAD().map(x => x.p.id));
  const cand = PLAYERS.slice().sort((a, b) => (POS_ORDER[a.position] - POS_ORDER[b.position]) || ((lastIds.has(b.id) - lastIds.has(a.id))) || ((recent.has(b.id) - recent.has(a.id))) || (b.callCount - a.callCount));
  lastFocus = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'ov';
  const save = () => store.set('pred', {base: LAST.id, picks: [...picks], at: (NOW.getMonth() + 1) + '/' + NOW.getDate()});
  const draw = () => {
    const list = cand.filter(p => (pos === 'ALL' || p.position === pos) && (!q || p.name.includes(q)));
    const cnt = {}; [...picks].forEach(id => { const p = BY_ID[id]; if (p) cnt[p.position] = (cnt[p.position] || 0) + 1; });
    ov.querySelector('.pc').textContent = picks.size + '/' + PRED_MAX + '人　GK' + (cnt.GK || 0) + '・DF' + (cnt.DF || 0) + '・MF' + (cnt.MF || 0) + '・FW' + (cnt.FW || 0);
    ov.querySelector('.plist').innerHTML = list.map(p => '<button type="button" class="pp' + (picks.has(p.id) ? ' on' : '') + '" data-pp="' + esc(p.id) + '"><span class="ps">' + esc(p.position) + '</span><b>' + esc(p.name) + '</b><small>' +
      (lastIds.has(p.id) ? '前回招集' : recent.has(p.id) ? '最近招集' : '招集' + p.callCount + '回') + '</small></button>').join('');
    ov.querySelectorAll('[data-pf]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pf === pos)));
  };
  ov.innerHTML = '<div class="card pred" role="dialog" aria-modal="true" aria-label="次のメンバーを予想">' +
    '<div class="ph"><b>次のメンバーを予想</b><button class="icon-btn x" type="button">保存して閉じる</button></div>' +
    '<div class="card-body"><p class="how">選手を押して選ぶ（最大' + PRED_MAX + '人）。この端末に保存され、次のメンバー発表で答え合わせします。</p>' +
    '<p class="pc"></p><div class="pfs">' + ['ALL', 'GK', 'DF', 'MF', 'FW'].map(k => '<button type="button" data-pf="' + k + '">' + (k === 'ALL' ? '全員' : k) + '</button>').join('') +
    '<input type="search" class="pq" placeholder="選手名で探す" aria-label="選手名で探す"></div><div class="plist"></div>' +
    '<div class="pdb"><button type="button" class="pbtn" data-pc="copy">予想をコピー</button><a class="xs" target="_blank" rel="noopener" data-pc="x" href="#">Xでシェア</a><button type="button" class="pbtn" data-pc="clear">全部はずす</button></div></div></div>';
  const close = () => { save(); ov.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; renderToday(); if (lastFocus) lastFocus.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const listText = () => ['GK', 'DF', 'MF', 'FW'].map(k => k + '：' + [...picks].map(id => BY_ID[id]).filter(p => p && p.position === k).map(p => p.name).join('、')).join('\n');
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('.x')) return close();
    const b = e.target.closest('[data-pp]');
    if (b){ const id = b.dataset.pp; if (picks.has(id)) picks.delete(id); else if (picks.size < PRED_MAX) picks.add(id); save(); draw(); return; }
    const f = e.target.closest('[data-pf]'); if (f){ pos = f.dataset.pf; draw(); return; }
    const c = e.target.closest('[data-pc]');
    if (c){
      if (c.dataset.pc === 'clear'){ picks.clear(); save(); draw(); }
      if (c.dataset.pc === 'copy'){ const t = '日本代表メンバー予想（' + picks.size + '人）\n' + listText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { c.textContent = 'コピーしました'; }, () => { c.textContent = 'コピーできませんでした'; }); }
      if (c.dataset.pc === 'x'){
        const newIn = [...picks].filter(id => !lastIds.has(id)).map(id => BY_ID[id].name);
        c.href = xShare('次の日本代表メンバーを予想しました（' + picks.size + '人）。' + (newIn.length ? '前回からの新顔：' + newIn.slice(0, 5).join('、') + (newIn.length > 5 ? ' ほか' : '') : '前回と同じ顔ぶれ') + '\n#BLUELIST #サッカー日本代表');
      }
    }
  });
  ov.querySelector('.pq').addEventListener('input', e => { q = e.target.value.trim(); draw(); });
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(ov);
  draw();
}

function renderToday(){
  if (!renderToday.updates) renderToday.updates = todayUpdates();
  const lines = [...renderToday.updates.map(x => '<li class="up">' + x + '</li>'), ...todayBirthdays().map(x => '<li>' + x + '</li>'), ...todayOnThisDay().map(x => '<li>' + x + '</li>')];
  $('today').innerHTML = '<div class="th"><b>きょうの日本代表</b><small>' + (NOW.getMonth() + 1) + '月' + NOW.getDate() + '日（' + WD[NOW.getDay()] + '）</small></div>' +
    (lines.length ? '<ul class="tl">' + lines.join('') + '</ul>' : '') +
    '<div class="tg">' + quizHTML() + predHTML() + '</div>' +
    (FAVS.size ? '' : '<p class="tfav">選手カードの「☆ お気に入り」を押すと、その選手の招集・出場をここで追えます。</p>');
}
$('today').addEventListener('click', e => {
  const qa = e.target.closest('[data-qa]'); if (qa){ answerQuiz(qa.dataset.qa); return; }
  const pd = e.target.closest('[data-pred]');
  if (pd){ if (pd.dataset.pred === 'new') store.set('pred', null); openPred(); }
});

/* ---------- お気に入り ---------- */
function renderFavs(){
  const list = [...FAVS].map(id => BY_ID[id]).filter(Boolean);
  $('fav-block').hidden = !list.length;
  $('favs').innerHTML = list.map(p => {
    const m = metrics(p);
    const inLast = p.history.some(h => h.activityId === LAST.id);
    return '<button class="fav" data-id="' + esc(p.id) + '"><b>' + esc(p.name) + '</b>' +
      '<small class="' + (inLast ? 'in' : '') + '">' + (inLast ? '最新の活動に招集' : '最新の活動は招集なし') + '</small>' +
      '<small>' + esc(m.tag) + '</small></button>';
  }).join('');
}

/* ---------- 記録メモ（開くたびに違う記録を表示） ---------- */
function buildFacts(){
  const F = [];
  const top = (arr, key) => arr.slice().sort((a, b) => key(b) - key(a))[0];
  const add = (label, p, v, unit) => { if (p && v !== '' && v != null) F.push({label, p, v, unit}); };
  const active = PLAYERS.filter(p => p.missedStreak === 0);
  const st = top(active, p => p.streak); add('いま続いている連続招集が最も長い', st, st && st.streak, '活動連続');
  const cc = top(PLAYERS, p => p.callCount); add('収録期間で最も多く招集された', cc, cc.callCount, '回');
  const mn = top(PLAYERS, p => metrics(p).natMin); add('代表で最も長くプレーした', mn, metrics(mn).natMin, '分');
  const gl = top(PLAYERS, p => metrics(p).natGoals); add('代表で最も多く得点した', gl, metrics(gl).natGoals, '得点');
  const sr = top(PLAYERS, p => metrics(p).natStarts); add('代表で最も多く先発した', sr, metrics(sr).natStarts, '試合');
  const latest = PLAYERS.filter(p => p.history.some(h => h.activityId === LAST.id) && p.birthday);
  const byBirth = latest.slice().sort((a, b) => a.birthday.localeCompare(b.birthday));
  add('最新の活動で最も若い', byBirth[byBirth.length - 1], byBirth.length && byBirth[byBirth.length - 1].age, '歳');
  add('最新の活動で最も年上', byBirth[0], byBirth.length && byBirth[0].age, '歳');
  const clubs = {};
  PLAYERS.forEach(p => { const h = p.history.find(x => x.activityId === LAST.id); if (h) clubs[h.club] = (clubs[h.club] || 0) + 1; });
  const cl = Object.entries(clubs).sort((a, b) => b[1] - a[1])[0];
  if (cl) F.push({label:'最新の活動で最も多く選手を出したクラブ', text:cl[0], v:cl[1], unit:'名'});
  const back = PLAYERS.filter(p => p.history.some(h => h.activityId === LAST.id && !h.firstCall)).map(p => {
    const idx = p.history.map(h => ACT_IDX[h.activityId]).sort((a, b) => a - b);
    const k = idx.indexOf(ACTS.length - 1);
    return {p, gap: k > 0 ? (ACTS.length - 1) - idx[k - 1] - 1 : 0};
  }).sort((a, b) => b.gap - a.gap)[0];
  if (back && back.gap > 0) add('最新の活動で最も久しぶりに戻った', back.p, back.gap, '活動ぶり');
  return F;
}
const FACTS = buildFacts();
function renderMemo(){
  const pick = FACTS.slice().sort(() => Math.random() - .5).slice(0, 3);
  $('memo').innerHTML = pick.map(f => '<div class="memo-item"><small>' + esc(f.label) + '</small>' +
    (f.p ? '<button type="button" data-id="' + esc(f.p.id) + '">' + esc(f.p.name) + '</button>' : '<strong>' + esc(f.text) + '</strong>') +
    '<b>' + esc(f.v) + '<span>' + esc(f.unit) + '</span></b></div>').join('');
}
$('shuffle').addEventListener('click', renderMemo);

/* ---------- 招集マトリクス ---------- */
let mxPos = 'ALL', mxQ = '';
$('mx-head').innerHTML = '<tr><th class="nm">選手</th>' +
  ACTS.map(a => '<th title="' + esc(a.name) + '"><span class="yy">' + esc(a.yy) + '</span><span class="mm">' + esc(a.mm) + '</span></th>').join('') +
  '<th>計</th></tr>';
function renderMatrix(){
  const rows = PLAYERS
    .filter(p => mxPos === 'ALL' || p.position === mxPos)
    .filter(p => !mxQ || p.name.includes(mxQ))
    .sort((a,b) => (POS_ORDER[a.position] - POS_ORDER[b.position]) || (b.callCount - a.callCount) || a.name.localeCompare(b.name, 'ja'));
  const span = ACTS.length + 2;
  if (!rows.length){ $('mx-body').innerHTML = '<tr><td class="empty" colspan="' + span + '">条件に合う選手がいません。絞り込みを変えてください。</td></tr>'; return; }
  let html = '', last = null;
  for (const p of rows){
    if (mxPos === 'ALL' && p.position !== last){ last = p.position; html += '<tr class="grp"><td colspan="' + span + '">' + esc(p.position) + '</td></tr>'; }
    const by = {}; p.history.forEach(h => by[h.activityId] = h);
    html += '<tr data-id="' + esc(p.id) + '"><td class="nm">' + (FAVS.has(p.id) ? '★ ' : '') + esc(p.name) + '</td>' +
      ACTS.map(a => {
        const h = by[a.id];
        if (!h) return '<td class="c"><span class="mk no"></span></td>';
        const cls = h.firstCall ? ' first' : (h.withdrawn ? ' wd' : '');
        const label = a.name + (h.firstCall ? '（初招集）' : h.withdrawn ? '（離脱・不参加）' : '');
        return '<td class="c"><span class="mk' + cls + '" title="' + esc(label) + '"></span></td>';
      }).join('') + '<td class="t">' + p.callCount + '</td></tr>';
  }
  $('mx-body').innerHTML = html;
}
document.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => {
  mxPos = b.dataset.pos;
  document.querySelectorAll('[data-pos]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderMatrix();
}));
$('q-mx').addEventListener('input', e => { mxQ = e.target.value.trim(); renderMatrix(); });

/* ---------- ランキング ---------- */
let rkWhere = 'ALL', rkQ = '', rkSort = 'calls', rkSt = 'ALL';
const lastClub = p => p.history[p.history.length - 1];
const SORTS = {
  inv:    {key: p => involveOf(p), unit: '', note: '収録している代表の試合での、得点とアシストの合計。'},
  calls:  {key: p => p.callCount, unit: '回', note: '収録している全活動のうち、何回メンバーに選ばれたか（離脱・不参加も含む）。'},
  natmin: {key: p => metrics(p).natMin, unit: '分', note: '収録している代表の試合で、実際にプレーした時間の合計。'},
  clubmin:{key: p => metrics(p).clubMinutes == null ? -1 : metrics(p).clubMinutes, unit: '分',
           note: HAS_CLUB ? '所属クラブの直近5試合でプレーした時間の合計（最大450分）。'
                          : 'クラブの出場データは準備中です。取得が始まると、所属クラブの直近5試合の出場時間で並びます。'},
};
// クラブのデータがまだないときは「クラブの出場時間」の並べ替えを「得点＋アシスト」に替える
if (!HAS_CLUB){ const b = document.querySelector('[data-sort="clubmin"]'); if (b){ b.dataset.sort = 'inv'; b.textContent = '代表の得点＋アシスト'; } }
function renderRank(){
  const S = SORTS[rkSort];
  $('rank-note').textContent = S.note;
  const rows = PLAYERS
    .filter(p => {
      const h = lastClub(p);
      if (rkWhere === 'OVERSEAS') return h && h.country !== '日本';
      if (rkWhere === 'DOMESTIC') return h && h.country === '日本';
      if (rkWhere === 'FAV') return FAVS.has(p.id);
      return true;
    })
    .filter(p => rkSt === 'ALL' || (rkSt === 'new' ? metrics(p).isNew : String(metrics(p).c4) === rkSt))
    .filter(p => !rkQ || p.name.includes(rkQ) || p.history.some(h => (h.club || '').includes(rkQ)))
    .sort((a,b) => (S.key(b) - S.key(a)) || (b.callCount - a.callCount) || a.name.localeCompare(b.name, 'ja'));
  if (!rows.length){
    $('rank').innerHTML = '<li class="empty">' + (rkWhere === 'FAV' ? 'お気に入りの選手はまだいません。選手カードの「☆ お気に入り」で追加できます。' : '条件に合う選手がいません。絞り込みを変えてください。') + '</li>';
    return;
  }
  const max = Math.max(1, ...rows.map(S.key));
  let prev = null, rank = 0;
  $('rank').innerHTML = rows.map((p, i) => {
    const v = S.key(p), m = metrics(p);
    if (v !== prev){ rank = i + 1; prev = v; }
    const h = lastClub(p);
    const meta = [m.tag, h ? h.club : '', p.age !== '' ? p.age + '歳' : ''].filter(Boolean).join('／');
    return '<li><button class="row' + (rank <= 3 ? ' top' : '') + '" data-id="' + esc(p.id) + '">' +
      '<span class="rk">' + rank + '</span>' +
      '<span class="who"><span class="pn">' + pos(p.position) + (m.number != null ? '<span class="nb">' + esc(m.number) + '</span>' : '') + esc(p.name) + (FAVS.has(p.id) ? ' ★' : '') + '</span>' +
      '<span class="meta">' + esc(meta) + '</span></span>' +
      '<span class="ct"><span class="gauge"><i style="width:' + (Math.max(v, 0) / max * 100).toFixed(1) + '%"></i></span><b>' + (v < 0 ? '−' : v) + '</b><small>' + S.unit + '</small></span>' +
      '</button></li>';
  }).join('');
}
function bindGroup(attr, set){
  document.querySelectorAll('[' + attr + ']').forEach(b => b.addEventListener('click', () => {
    set(b.getAttribute(attr));
    document.querySelectorAll('[' + attr + ']').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderRank();
  }));
}
bindGroup('data-where', v => rkWhere = v);
bindGroup('data-sort', v => rkSort = v);
bindGroup('data-st', v => rkSt = v);
$('q-rank').addEventListener('input', e => { rkQ = e.target.value.trim(); renderRank(); });

/* ---------- 選手カード ---------- */
/* 直近10試合のフォームガイド：●先発 ◐途中出場 ○出場なし ‐招集外。評価の言葉は使わない */
const FG_N = 10;
function formItems(p){
  const byAct = {}; p.history.forEach(h => byAct[h.activityId] = h);
  const appBy = {}; (p.apps || []).forEach(a => appBy[a.matchId] = a);
  return MATCHES.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, FG_N).map(m => {
    const h = byAct[m.activityId], ap = appBy[m.id];
    const kind = ap ? (ap.start ? 'st' : 'sb') : !h ? 'ot' : h.withdrawn ? 'wd' : 'bn';
    const word = {st: '先発', sb: '途中出場', bn: 'ベンチ（出場なし）', ot: '招集外', wd: '離脱・不参加'}[kind];
    const info = '<b>' + esc(md(m.date)) + '</b>　vs ' + flg(m.opponent, 'sm') + esc(m.opponent) + '（' + m.gf + '-' + m.ga + '）　' + word +
      (ap ? '　<b>' + ap.minutes + '</b>分' + (ap.start ? '' : '（' + ap.in + "'から）") + (ap.goals ? '　' + ap.goals + '得点' : '') : '');
    return {m, ap, kind, info};
  });
}
function formFacts(p){
  const facts = [];
  const byAct = {}; p.history.forEach(h => byAct[h.activityId] = h);
  let streak = 0;
  for (let i = ACTS.length - 1; i >= 0; i--){
    const a = ACTS[i], h = byAct[a.id];
    if (h && !h.withdrawn) streak++;
    else if (isE1(a) && !h) continue;
    else break;
  }
  if (streak >= 2) facts.push(streak + '活動連続で招集中');
  else if (streak === 1) facts.push('最新の活動（' + LAST.name + '）に招集');
  else { const hs = p.history.filter(h => !h.withdrawn).sort((a, b) => b.date.localeCompare(a.date)); if (hs[0]) facts.push('最後の招集：' + ym(hs[0].date) + '（' + hs[0].activityName + '）'); }
  const apps = (p.apps || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const st = apps.find(a => a.start);
  facts.push(st ? '最後の先発：' + md(st.date) + ' ' + st.opponent + '戦（' + st.minutes + '分）' : '収録している試合での先発はなし');
  const gl = apps.find(a => a.goals);
  if (gl) facts.push('最後の得点：' + md(gl.date) + ' ' + gl.opponent + '戦' + (gl.goals > 1 ? '（' + gl.goals + '得点）' : ''));
  const as = MATCHES.slice().sort((a, b) => b.date.localeCompare(a.date)).find(m => (m.goals || []).some(g => g.ap === p.id));
  if (as) facts.push('最後のアシスト：' + md(as.date) + ' ' + as.opponent + '戦');
  return facts;
}
function formHTML(p){
  const items = formItems(p);
  const cnt = k => items.filter(x => x.kind === k).length;
  const dots = items.map((x, i) => '<div class="fgw"><button class="fgd ' + x.kind + (i === 0 ? ' sel' : '') + '" type="button" data-i="' + i + '" aria-label="' + esc(x.info.replace(/<[^>]+>/g, '')) + '">' +
    '<span>' + (x.ap ? x.ap.minutes : '') + '</span>' + (x.ap && x.ap.goals ? '<i class="gdot"></i>' : '') + '</button><small>' + esc(md(x.m.date).replace(/^0/, '')) + '</small></div>').join('');
  const wd = cnt('wd');
  return '<div class="fg"><div class="fg-row">' + dots + '</div>' +
    '<div class="fg-ends"><span>◀ 最新</span><span>古い</span></div>' +
    '<div class="fg-info" aria-live="polite">' + (items[0] ? items[0].info : '') + '</div>' +
    '<p class="fg-cnt">先発<b>' + cnt('st') + '</b>・途中<b>' + cnt('sb') + '</b>・出場なし<b>' + cnt('bn') + '</b>・招集外<b>' + cnt('ot') + '</b>' + (wd ? '・離脱<b>' + wd + '</b>' : '') + '</p>' +
    '<ul class="fg-facts">' + formFacts(p).map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
    '<div class="fg-legend"><span><i style="background:var(--blue)"></i>先発</span><span><i style="background:#d6e2ff;box-shadow:inset 0 0 0 2px var(--blue)"></i>途中出場</span>' +
    '<span><i style="box-shadow:inset 0 0 0 2px var(--sub)"></i>出場なし</span><span><i style="background:var(--line);border-radius:2px;height:4px;vertical-align:2px"></i>招集外</span>' +
    '<span><i style="background:var(--red);width:8px;height:8px"></i>得点</span><span>丸の中の数字＝出場分</span></div></div>';
}

/* 代表での起用の推移：直近8活動の試合ごとの出場時間（評価の点数は付けない） */
const USAGE_N = 8;
function usageHTML(p){
  const acts = ACTS.slice(-USAGE_N).reverse();   // 新しい活動を上に
  const byAct = {}; p.history.forEach(h => byAct[h.activityId] = h);
  const appBy = {}; (p.apps || []).forEach(a => appBy[a.matchId] = a);
  const CAT = {'E-1選手権':'E-1','W杯最終予選':'W杯予選','ワールドカップ':'W杯','親善試合':'親善'};
  let called = 0, played = 0, starts = 0, mins = 0;
  const rows = acts.map(a => {
    const h = byAct[a.id];
    const ms = matchesOf(a.id);
    const lab = '<div class="ul">' + esc(String(a.startDate).slice(2, 7).replace('/', '.')) + '<small>' + esc(CAT[a.category] || a.category) + '</small></div>';
    if (!h) return '<div class="urow out" title="' + esc(a.name) + '">' + lab + '<div class="msg">招集外</div><div class="r"></div></div>';
    called++;
    if (h.withdrawn && !ms.some(m => appBy[m.id])) return '<div class="urow wd" title="' + esc(a.name) + '">' + lab + '<div class="msg">招集後に離脱・不参加</div><div class="r"></div></div>';
    if (!ms.length) return '<div class="urow" title="' + esc(a.name) + '">' + lab + '<div class="msg">試合の記録なし</div><div class="r"></div></div>';
    let n = 0, mm = 0;
    const slots = ms.map(m => {
      const ap = appBy[m.id], len = m.length || 90;
      const tip = md(m.date) + ' vs ' + m.opponent + '：';
      if (!ap) return '<div class="slot nop" title="' + esc(tip + (h.withdrawn ? '離脱・不参加' : '出場なし')) + '"><span class="t">' + esc(m.opponent.slice(0, 4)) + '</span></div>';
      played++; n++; if (ap.start) starts++; mins += ap.minutes || 0; mm += ap.minutes || 0;
      const w = Math.max(6, Math.round((ap.minutes || 0) / len * 100));
      return '<div class="slot on' + (ap.start ? '' : ' sub') + (w < 45 ? ' short' : '') + '" title="' + esc(tip + (ap.start ? '先発' : '途中出場') + ' ' + ap.minutes + '分' + (ap.goals ? '・' + ap.goals + '得点' : '')) + '">' +
        '<span class="fill" style="width:' + w + '%"></span><span class="t"><span>' + ap.minutes + "'</span>" + (ap.goals ? '<span class="g">' + '●'.repeat(Math.min(ap.goals, 3)) + '</span>' : '') + '</span></div>';
    }).join('');
    return '<div class="urow' + (a.id === LAST.id ? ' cur' : '') + '" title="' + esc(a.name) + '">' + lab + '<div class="slots">' + slots + '</div>' +
      '<div class="r"><b>' + n + '</b>/' + ms.length + '試合<br><b>' + mm + '</b>分</div></div>';
  }).join('');
  return '<div class="usage"><p class="sum">直近' + acts.length + '活動で 招集<b>' + called + '</b>回・出場<b>' + played + '</b>試合（先発<b>' + starts + '</b>）・計<b>' + mins + '</b>分</p>' +
    '<div class="urows" role="list" aria-label="直近' + acts.length + '活動の試合ごとの出場時間">' + rows + '</div>' +
    '<div class="ulegend"><span><i style="background:var(--blue)"></i>先発</span><span><i style="background:#7fa6ff"></i>途中出場</span>' +
    '<span><i style="box-shadow:inset 0 0 0 1.5px var(--line)"></i>出場なし（相手名）</span><span style="color:var(--red)">●</span><span style="margin-left:-8px">得点</span>' +
    '<span>帯の長さ＝出場時間（いっぱいで90分）。上が新しい活動</span></div></div>';
}
function radarSvg(m){
  const cx = 130, cy = 120, R = 76;
  const pt = (i, r) => { const g = (-90 + i * 72) * Math.PI / 180; return [cx + r * Math.cos(g), cy + r * Math.sin(g)]; };
  const f = n => n.toFixed(1);
  const poly = r => AXES.map((_, i) => pt(i, r).map(f).join(',')).join(' ');
  let g = '';
  [0.25, 0.5, 0.75, 1].forEach(k => { g += '<polygon class="ring" points="' + poly(R * k) + '"/>'; });
  AXES.forEach((a, i) => { const [x, y] = pt(i, R); g += '<line class="spoke' + (a.grp === 'クラブ' ? ' club' : '') + '" x1="' + cx + '" y1="' + cy + '" x2="' + f(x) + '" y2="' + f(y) + '"/>'; });
  const vals = AXES.map(a => m[a.k] == null ? 0 : m[a.k]);
  g += '<polygon class="area" points="' + vals.map((v, i) => pt(i, R * Math.max(v, 2) / 100).map(f).join(',')).join(' ') + '"/>';
  vals.forEach((v, i) => { if (m[AXES[i].k] == null) return; const [x, y] = pt(i, R * Math.max(v, 2) / 100); g += '<circle class="dot" cx="' + f(x) + '" cy="' + f(y) + '" r="3.5"/>'; });
  AXES.forEach((a, i) => {
    const [x, y] = pt(i, R + 20);
    const anchor = Math.abs(x - cx) < 4 ? 'middle' : (x > cx ? 'start' : 'end');
    const na = m[a.k] == null;
    const yy = y + (i === 0 ? -16 : (y > cy ? 6 : -4));
    g += '<text x="' + f(x) + '" y="' + f(yy) + '" text-anchor="' + anchor + '"><tspan class="grp" x="' + f(x) + '">' + a.grp + '</tspan>' +
         '<tspan x="' + f(x) + '" dy="15">' + a.label + ' </tspan><tspan class="v' + (na ? ' na' : '') + '">' + (na ? '未取得' : m[a.k]) + '</tspan></text>';
  });
  return '<svg class="radar" viewBox="-50 -6 360 262" role="img" aria-label="' + (HAS_CLUB ? '代表とクラブの出場データ' : '代表の招集と出場のデータ') + 'から作った5項目のグラフ">' + g + '</svg>';
}

let lastFocus = null;
function openPlayer(id){
  const p = BY_ID[id]; if (!p) return;
  const m = metrics(p);
  lastFocus = document.activeElement;
  const hist = p.history.slice().sort((a,b) => b.date.localeCompare(a.date));
  const now = hist[0];
  const appsByAct = {};
  (p.apps || []).forEach(a => (appsByAct[a.activityId] = appsByAct[a.activityId] || []).push(a));
  const clubBlock = m.club.length
    ? '<ul class="clubs">' + m.club.map(c =>
        '<li><span class="d">' + esc(md(c.date)) + '</span>' +
        '<span class="o">vs ' + esc(c.opponent) + '<small>' + esc(c.competition) + '／' + esc(c.club) + '</small></span>' +
        (c.squad ? '<span class="m">' + c.minutes + '<small>分' + (c.start ? '・先発' : c.minutes ? '・途中' : '・出場なし') + (c.goals ? '・' + c.goals + '得点' : '') + (c.assists ? '・' + c.assists + 'アシスト' : '') + '</small></span>'
                 : '<span class="m bench">−<small>ベンチ外</small></span>') + '</li>').join('') + '</ul>'
    : '<p class="pending">クラブの出場データは準備中です。所属クラブの直近5試合の出場時間と先発数を、自動で取り込む予定です。</p>';

  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML =
    '<div class="card' + (p.position === 'GK' ? ' gk' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + 'の選手カード">' +
      '<div class="top">' +
        (m.number != null ? '<div class="shirt" title="直近の背番号">' + esc(m.number) + '</div>' : '<div class="shirt blank">背番号<br>未登録</div>') +
        '<h2>' + esc(p.name) + (p.romaji ? '<span class="en">' + esc(p.romaji) + '</span>' : '') + '</h2>' +
        '<div class="sub">' + pos(p.position) + tag(m) + '<span>' + esc([now ? now.club : '', p.birthday ? p.age + '歳' : ''].filter(Boolean).join('／')) + '</span></div>' +
        (SNS[p.id] ? '<div class="sub snsrow">' + snsLinks(p.id) + '</div>' : '') +
        '<div class="tools"><button class="icon-btn fav-btn" type="button" aria-pressed="' + FAVS.has(p.id) + '">' + (FAVS.has(p.id) ? '★ お気に入り' : '☆ お気に入り') + '</button>' +
        '<button class="icon-btn x" type="button">閉じる</button></div>' +
      '</div>' +
      '<div class="card-body">' +
        '<h3 class="sec">代表の直近' + FG_N + '試合</h3>' + formHTML(p) +
        
        '<div class="figs">' +
          '<div class="fig"><b>' + p.callCount + '</b><small>招集回数</small></div>' +
          '<div class="fig"><b>' + m.natApps + '</b><small>出場試合（先発' + m.natStarts + '）</small></div>' +
          '<div class="fig"><b>' + m.natMin + '</b><small>出場時間（分）</small></div>' +
          '<div class="fig"><b>' + m.natGoals + '</b><small>得点</small></div>' +
          '<div class="fig"><b>' + m.natAssists + '</b><small>アシスト</small></div>' +
        '</div>' +
        (SLUGS.p[p.id] ? '<p class="pagelink"><a href="players/' + SLUGS.p[p.id] + '.html">' + esc(p.name) + 'の招集歴・出場記録をすべて見る</a></p>' : '') +
        (m.club.length ? '<h3 class="sec">クラブの直近5試合</h3>' + clubBlock : '') +
        '<h3 class="sec">' + esc(p.name) + 'のユニフォーム<span class="pr">PR</span></h3>' +
          shopBlock('日本代表 ユニフォーム ' + (m.number != null ? m.number + ' ' : '') + p.name,
            '「日本代表 ユニフォーム ' + (m.number != null ? m.number + ' ' : '') + p.name + '」') +
        '<h3 class="sec">招集歴</h3>' +
        '<ul class="tl">' + hist.map(h => {
          const ap = appsByAct[h.activityId] || [];
          const mins = ap.reduce((n, a) => n + a.minutes, 0);
          const nm = (MATCHES_BY_ACT[h.activityId] || []).length;
          const right = (nosOf(h).length ? '<b title="' + esc(noDetail(h)) + '">' + esc(noText(h)) + '</b>' : '') +
            (HAS_MATCHES && !(h.withdrawn && !ap.length) ? ap.length + '/' + nm + '試合・' + mins + '分' : '');
          return '<li><div class="d">' + esc(ym(h.date)) + '<small>' + esc(h.category) + '</small></div>' +
            '<div><div class="a">' + esc(h.activityName) +
              (h.firstCall ? '<span class="badge first">初招集</span>' : '') +
              (h.additional ? '<span class="badge">追加招集</span>' : '') +
              (h.withdrawn ? '<span class="badge">離脱・不参加</span>' : '') + '</div>' +
            '<div class="c">' + esc(h.club) + (h.country && h.country !== '日本' ? '（' + esc(h.country) + '）' : '') + '</div>' +
            (nosOf(h).length > 1 ? '<div class="c">背番号：' + esc(noDetail(h)) + '</div>' : '') + '</div>' +
            '<div class="r">' + right + '</div></li>';
        }).join('') + '</ul>' +
      '</div>' +
    '</div>';

  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.fg-row') && ov.querySelector('.fg-row').addEventListener('click', e => {
    const d = e.target.closest('.fgd'); if (!d) return;
    const items = formItems(p);
    ov.querySelectorAll('.fgd').forEach(x => x.classList.toggle('sel', x === d));
    ov.querySelector('.fg-info').innerHTML = items[+d.dataset.i].info;
  });
  ov.querySelector('.x').addEventListener('click', close);
  ov.querySelector('.fav-btn').addEventListener('click', e => {
    const b = e.currentTarget;
    if (FAVS.has(p.id)) FAVS.delete(p.id); else FAVS.add(p.id);
    saveFavs();
    b.setAttribute('aria-pressed', String(FAVS.has(p.id)));
    b.textContent = FAVS.has(p.id) ? '★ お気に入り' : '☆ お気に入り';
    renderFavs(); if (mi < 0) renderSheet(false); if (DRAWN.matrix) renderMatrix(); if (DRAWN.rank) renderRank();
  });
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(ov);
  ov.querySelector('.x').focus();
}
/* 対戦相手のカード：収録している試合の中での対戦成績・布陣・得点者 */
const CONF = {
  '中国':'AFC（アジア）','バーレーン':'AFC（アジア）','サウジアラビア':'AFC（アジア）','オーストラリア':'AFC（アジア）','インドネシア':'AFC（アジア）',
  'ホンコン・チャイナ':'AFC（アジア）','韓国':'AFC（アジア）','メキシコ':'CONCACAF（北中米カリブ海）','アメリカ':'CONCACAF（北中米カリブ海）',
  'パラグアイ':'CONMEBOL（南米）','ブラジル':'CONMEBOL（南米）','ボリビア':'CONMEBOL（南米）','ウルグアイ':'CONMEBOL（南米）','ベネズエラ':'CONMEBOL（南米）','エクアドル':'CONMEBOL（南米）',
  'ガーナ':'CAF（アフリカ）','チュニジア':'CAF（アフリカ）','スコットランド':'UEFA（ヨーロッパ）','イングランド':'UEFA（ヨーロッパ）','アイスランド':'UEFA（ヨーロッパ）',
  'オランダ':'UEFA（ヨーロッパ）','スウェーデン':'UEFA（ヨーロッパ）','ニュージーランド':'OFC（オセアニア）'
};
function openTeam(name){
  const ms = MATCHES.filter(m => m.opponent === name).sort((a, b) => b.date.localeCompare(a.date));
  if (!ms.length) return;
  lastFocus = document.activeElement;
  const w = ms.filter(m => m.result === '勝').length, d = ms.filter(m => m.result === '分').length, l = ms.filter(m => m.result === '敗').length;
  const gf = ms.reduce((n, m) => n + m.gf, 0), ga = ms.reduce((n, m) => n + m.ga, 0);
  const forms = [...new Set(ms.map(m => m.oppForm).filter(Boolean))];
  const scorers = {};
  ms.forEach(m => (m.goals || []).forEach(g => { if (g.team !== '日本' && !g.og && g.scorer) scorers[g.scorer] = (scorers[g.scorer] || 0) + 1; }));
  const actName = id => (ACTS.find(a => a.id === id) || {}).name || '';
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML =
    '<div class="card team" role="dialog" aria-modal="true" aria-label="' + esc(name) + 'の詳細">' +
      '<div class="top"><h2>' + esc(name) + '</h2>' +
        '<div class="sub">' + (CONF[name] ? '<span class="conf">' + esc(CONF[name]) + '</span>' : '') + '<span>日本代表の対戦相手</span></div>' +
        '<div class="tools"><button class="icon-btn x" type="button">閉じる</button></div></div>' +
      '<div class="card-body">' +
        '<h3 class="sec">日本との対戦成績（収録している' + ms.length + '試合）</h3>' +
        '<div class="rec"><div><b>' + w + '</b><small>日本の勝ち</small></div><div><b>' + d + '</b><small>引き分け</small></div><div><b>' + l + '</b><small>日本の負け</small></div></div>' +
        '<p class="how">得点 日本 ' + gf + ' − ' + ga + ' ' + esc(name) +
          (forms.length ? '　／　' + esc(name) + 'の布陣：' + forms.map(esc).join('・') : '') +
          (Object.keys(scorers).length ? '　／　日本から得点した選手：' + Object.entries(scorers).map(([k, v]) => esc(k) + (v > 1 ? '（' + v + '）' : '')).join('、') : '') + '</p>' +
        '<h3 class="sec">試合</h3><ul class="tm-list">' + ms.map(m => {
          const jg = (m.goals || []).filter(g => g.team === '日本').map(g => g.og ? '相手OG' : esc(g.scorer) + ' ' + g.min + "'");
          const og = (m.goals || []).filter(g => g.team !== '日本').map(g => (g.og ? esc(g.scorer) + '（OG）' : esc(g.scorer || name)) + ' ' + g.min + "'");
          return '<li><div class="h"><span class="d">' + esc(m.date) + '</span><span class="res' + (m.result === '勝' ? ' w' : '') + '">' + esc(m.result) + '</span><span class="s">' + m.gf + '-' + m.ga + '</span></div>' +
            '<div class="c">' + esc(actName(m.activityId)) + '／' + esc(m.venue || '') + (m.form || m.oppForm ? '／布陣 日本 ' + esc(m.form || '−') + '・' + esc(name) + ' ' + esc(m.oppForm || '不明') : '') + '</div>' +
            '<div class="g">' + (jg.length ? '<b>日本</b> ' + jg.join('、') : '<b>日本</b> 得点なし') + (og.length ? '<br><b>' + esc(name) + '</b> ' + og.join('、') : '') + '</div>' +
            '<button class="go" type="button" data-go="' + esc(m.id) + '">この試合を再生 ▶</button></li>';
        }).join('') + '</ul>' +
        (OPP_SLUG[name] ? '<p class="pagelink"><a href="opponents/' + OPP_SLUG[name] + '.html">' + esc(name) + 'との対戦成績のページを見る</a></p>' : '') +
        '<p class="how">2023年3月以降に収録しているA代表の試合だけを数えています。</p>' +
      '</div></div>';
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', e => {
    if (e.target === ov) return close();
    const go = e.target.closest('[data-go]');
    if (go){
      const m = MATCHES.find(x => x.id === go.dataset.go);
      const ai = ACTS.findIndex(a => a.id === m.activityId);
      close();
      document.querySelector('.tab[data-view="sheet"], [data-view="sheet"]') && document.querySelector('[data-view="sheet"]').click();
      cur = ai; mi = matchesOf(m.activityId).findIndex(x => x.id === m.id); renderSheet(true);
      $('board').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: 'start'});
    }
  });
  ov.querySelector('.x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(ov);
  ov.querySelector('.x').focus();
}
document.addEventListener('click', e => {
  const tm = e.target.closest('[data-team]');
  if (tm && !tm.closest('.ov')){ openTeam(tm.dataset.team); return; }
  const t = e.target.closest('[data-id]');
  if (t && !t.closest('.ov')) openPlayer(t.dataset.id);
});

/* ---------- フッター・初期表示 ---------- */
const ymj = d => d.slice(0, 4) + '年' + Number(d.slice(5, 7)) + '月';
$('range').textContent = '収録範囲：' + ymj(ACTS[0].startDate) + '〜' + ymj(LAST.startDate) + 'のA代表全' + ACTS.length + '活動' + (HAS_MATCHES ? '・' + MATCHES.length + '試合' : '') + '。招集回数・出場時間はこの範囲内の数です。';
$('updated').textContent = DB.updatedAt;

(() => {
  const q = new URLSearchParams(location.search);
  const m = q.get('m') && MATCHES.find(x => x.id === q.get('m'));
  const a = q.get('a') || (m && m.activityId);
  if (a && ACT_IDX[a] != null){ cur = ACT_IDX[a]; mi = m ? matchesOf(a).findIndex(x => x.id === m.id) : -1; }
})();
renderSheet(false);
renderToday();
renderNext();
renderRails();
(() => { const pid = new URLSearchParams(location.search).get('p'); if (pid && BY_ID[pid]) openPlayer(pid); })();
renderFavs();
renderMemo();
{ const qv = new URLSearchParams(location.search).get('v'); const v = VIEWS[qv] ? qv : store.get('view', 'sheet'); if (VIEWS[v]) showView(v, true, true); }
