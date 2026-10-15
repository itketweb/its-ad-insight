/* its-ad-insight — 화면 동작 + 데이터 연동
   js/config.js 에 웹앱 주소·비밀키가 있으면 실제 데이터(Google Ads·네이버 검색광고)를, 없으면 예시 데이터를 보여 준다.
   메뉴·테마·툴팁 동작과 차트 그리는 방식은 itket-analytics 와 같게 맞춘다. */
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ── 연결 설정: config.js(window.ADI) → localStorage 순으로 읽는다 ── */
function getCfg() {
  const c = window.ADI || {};
  if (c.url && c.key) return c;
  try { const s = JSON.parse(localStorage.getItem('adi_cfg') || '{}'); if (s.url && s.key) return s; } catch (e) {}
  return {};
}
function openCfg() {
  const c = getCfg();
  $('cfgUrl').value = c.url || ''; $('cfgKey').value = c.key || '';
  $('cfgScrim').classList.add('on'); setTimeout(() => $('cfgUrl').focus(), 50);
}

/* ── 테마 ── */
try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
const isDark = () => { const r = document.documentElement; return r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; };
const syncTheme = () => { $('theme').setAttribute('aria-checked', isDark()); render(); };
$('theme').onclick = () => { const r = document.documentElement; r.dataset.theme = isDark() ? 'light' : 'dark'; try { localStorage.setItem('theme', r.dataset.theme); } catch (e) {} syncTheme(); };
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', syncTheme);
$('print').onclick = () => print();

/* ── 모바일 메뉴 ── */
function drawer(on) {
  $('side').classList.toggle('open', on); $('scrim').classList.toggle('on', on);
  document.body.classList.toggle('lock', on); $('burger').setAttribute('aria-expanded', on);
}
$('burger').onclick = () => drawer(true);
$('scrim').onclick = $('sclose').onclick = () => drawer(false);
addEventListener('keydown', (e) => { if (e.key === 'Escape') { drawer(false); $('cfgScrim').classList.remove('on'); } });
$('cfgBtn').onclick = openCfg;
$('cfgCancel').onclick = $('cfgScrim').onclick = () => $('cfgScrim').classList.remove('on');
$('cfgDialog').onclick = (e) => e.stopPropagation();
$('cfgSave').onclick = async () => {
  const url = $('cfgUrl').value.trim(), key = $('cfgKey').value.trim();
  if (!url || !key) return;
  try { localStorage.setItem('adi_cfg', JSON.stringify({ url, key })); } catch (e) {}
  $('cfgScrim').classList.remove('on'); await load();
};

/* ── 화면 전환: 메뉴마다 다른 화면을 보여 준다 (주소의 #은 새로고침 시 같은 화면 유지용) ── */
const views = [...document.querySelectorAll('.view')];
const navs = [...document.querySelectorAll('#toc .nv')];
let cur = '';
function mark() {
  navs.forEach((b) => {
    const grp = b.closest('.grp'), closed = grp && !grp.classList.contains('open');
    // 상위 메뉴는 하위 메뉴가 접혀 있을 때만, 하위 메뉴는 펼쳐져 있을 때만 현재 위치를 표시
    const own = b.hasAttribute('data-parent') ? closed && !!grp.querySelector(`.subs [data-v="${cur}"]`) : b.dataset.v === cur && !(closed && b.classList.contains('sub'));
    b.classList.toggle('on', own);
    if (own) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function go(v) {
  if (!views.some((x) => x.dataset.view === v)) v = views[0].dataset.view;
  cur = v;
  views.forEach((x) => x.classList.toggle('on', x.dataset.view === v));
  const view = views.find((x) => x.dataset.view === v);
  $('crumb').textContent = view.dataset.title;
  document.title = view.dataset.title + ' · its-ad-insight 기획안';
  history.replaceState(null, '', '#' + v);
  mark(); drawer(false); render(); window.scrollTo({ top: 0 });
}
navs.forEach((b) => b.onclick = () => {
  const grp = b.closest('.grp');
  if (grp && b.hasAttribute('data-parent')) fold(grp, true);
  go(b.dataset.v);
});
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.dataset.go));

/* ── 하위 메뉴 접기/펼치기 ── */
function fold(grp, open) {
  grp.classList.toggle('open', open);
  const b = grp.querySelector('.fold');
  b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', open ? '하위 메뉴 접기' : '하위 메뉴 펼치기');
  mark();
}
document.querySelectorAll('#toc .grp').forEach((grp) => {
  grp.querySelector('.fold').onclick = () => fold(grp, !grp.classList.contains('open'));
});

/* ── 필터 탭: data-k 의 값을 바꾸고 다시 그린다 ── */
const ST = { year: 0, mode: 'chart', media: 'all', type: 'SA' };
document.addEventListener('click', (e) => {
  const b = e.target.closest('.seg[data-k] button');
  if (!b) return;
  const k = b.closest('.seg').dataset.k;
  ST[k] = k === 'year' ? Number(b.dataset.v) : b.dataset.v;
  render();
});
function syncSeg() {
  document.querySelectorAll('.seg[data-k]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(ST[g.dataset.k]) === b.dataset.v)));
}

/* ── 툴팁: data-tip="제목|값" ── */
const tip = $('tip');
document.addEventListener('pointermove', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.style.opacity = 0; return; }
  const [h, v] = t.dataset.tip.split('|');
  tip.innerHTML = `<span>${h}</span><b>${v}</b>`;
  const w = tip.offsetWidth, x = e.clientX + 12 + w > innerWidth ? e.clientX - 12 - w : e.clientX + 12;
  tip.style.left = x + 'px'; tip.style.top = (e.clientY + 12) + 'px'; tip.style.opacity = 1;
});

/* ── 날짜 ── */
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const NOW = new Date(), THIS_Y = NOW.getFullYear(), THIS_M = ym(THIS_Y, NOW.getMonth() + 1);
const prevM = (mo) => { const [y, m] = mo.split('-').map(Number); return m === 1 ? ym(y - 1, 12) : ym(y, m - 1); };
const mLabel = (mo) => `${+mo.slice(5)}월`;
const sumBy = (rows, f) => rows.reduce((a, r) => a + f(r), 0);

/* ── 데이터 모델 ──
   spend    : { month, media, type(SA/DA), campaign, adgroup, cost(원), imp, clk, conv }
   manual   : { month, item(MDF/META/STORE), amount }
   keywords : { media, type, campaign, adgroup, keyword, match, bid, quality, cost, imp, clk, conv } — 최근 30일
   ads      : { media, type, campaign, adgroup, title, url, image }
   mapping  : 시트의 mapping (media·campaign·ad_group → category, ratio) */
let D = sample(), MAP = new Map(), STATUS = 'sample';

function sample() {
  const M = NOW.getMonth() + 1;
  const cats = [['서버', 0.34], ['워크스테이션', 0.29], ['스토리지', 0.17], ['PC·노트북', 0.13], ['공통(브랜드)', 0.07]];
  const base = { 'Google SA': 600, 'Google DA': 210, 'Naver SA': 760, 'Naver DA': 110 }; // 만원
  const spend = [], manual = [];
  [THIS_Y - 1, THIS_Y].forEach((y) => {
    for (let m = 1; m <= (y === THIS_Y ? M : 12); m++) {
      const mo = ym(y, m), wave = 1 + 0.08 * Math.sin(m) - (y < THIS_Y ? 0.06 : 0);
      manual.push({ month: mo, item: 'MDF', amount: 2000000 });
      Object.entries(base).forEach(([k, v]) => {
        const [media, type] = k.split(' ');
        cats.forEach(([c, w], i) => {
          const cost = Math.round(v * w * wave * (1 + 0.05 * Math.cos(m + i)) * 1e4);
          spend.push({ month: mo, media, type, campaign: c, adgroup: `${c}_${type}`, cost, imp: Math.round(cost / 25), clk: Math.round(cost / 900), conv: Math.round(cost / 60000) });
        });
      });
    }
  });
  const kw = (media, campaign, adgroup, keyword, bid, quality, imp, clk, conv) => ({ media, type: 'SA', campaign, adgroup, keyword, match: '', bid, quality, cost: clk * bid * 0.8, imp, clk, conv });
  return {
    updated: '', spend, manual, mapping: [],
    keywords: [kw('Naver', '서버', '랙서버', '랙서버', 1200, 6, 18400, 412, 9), kw('Naver', '서버', '랙서버', '델 서버 견적', 950, 7, 5300, 188, 7), kw('Naver', '서버', '랙서버', 'HPE 서버', 870, 5, 7200, 156, 3),
      kw('Google', '워크스테이션', 'Z시리즈', 'hp z8 워크스테이션', 1450, 8, 3100, 142, 6), kw('Google', '워크스테이션', 'Z시리즈', '워크스테이션 구매', 1100, 6, 9800, 201, 4)],
    ads: [{ media: 'Google', type: 'DA', campaign: '서버', adgroup: '서버_리타겟팅', title: '서버 구축 상담 배너', url: 'https://www.itket.com/', image: '' },
      { media: 'Naver', type: 'DA', campaign: '워크스테이션', adgroup: '워크스테이션', title: 'Z 워크스테이션 프로모션', url: 'https://www.zbyhp.co.kr/', image: '' },
      { media: 'Naver', type: 'SA', campaign: '스토리지', adgroup: 'NAS', title: 'NAS 스토리지 구축 상담', url: 'https://www.itket.com/', image: '' }],
  };
}

/** 웹앱 JSON(시트 그대로) → 데이터 모델 */
function fromApi(j) {
  const n = (v) => Number(v) || 0;
  const row = (media, r) => ({ month: String(r.month).slice(0, 7), media, type: r.type || 'SA', campaign: String(r.campaign), adgroup: String(r.ad_group ?? ''), cost: n(r.cost), imp: n(r.impressions), clk: n(r.clicks), conv: n(r.conversions) });
  const spend = (j.g_adgroup_monthly || []).map((r) => row('Google', r));
  // 광고그룹이 없는 캠페인(P-Max 등)은 캠페인 합계를 그대로 넣는다
  const hasGroup = new Set(spend.map((r) => r.month + '\u0001' + r.campaign));
  (j.g_campaign_monthly || []).forEach((r) => { const c = row('Google', r); if (!hasGroup.has(c.month + '\u0001' + c.campaign)) spend.push(Object.assign(c, { adgroup: '(광고그룹 없음)' })); });
  (j.n_adgroup_monthly || []).forEach((r) => spend.push(row('Naver', r)));
  const manual = (j.manual || []).map((r) => ({ month: String(r.month).slice(0, 7), item: String(r.item).trim().toUpperCase(), amount: n(r.amount) })).filter((r) => r.amount);
  manual.filter((r) => r.item === 'META').forEach((r) => spend.push({ month: r.month, media: 'Meta', type: 'DA', campaign: 'Meta', adgroup: '', cost: r.amount, imp: 0, clk: 0, conv: 0 }));
  const kw = (media, r) => ({ media, type: r.type, campaign: String(r.campaign), adgroup: String(r.ad_group), keyword: String(r.keyword), match: r.match, bid: n(r.bid), quality: n(r.quality), cost: n(r.cost), imp: n(r.impressions), clk: n(r.clicks), conv: n(r.conversions) });
  const ad = (media, r) => ({ media, type: r.type, campaign: String(r.campaign), adgroup: String(r.ad_group), title: String(r.title || r.ad_type || ''), url: r.url || '', image: r.image || '' });
  const upd = (rows) => ((rows || []).find((r) => r.key === 'updated') || {}).value || '';
  return {
    updated: [upd(j.g_meta), upd(j.n_meta)].filter(Boolean).sort().pop() || j.served || '',
    sources: { google: upd(j.g_meta), naver: upd(j.n_meta) },
    spend, manual, mapping: j.mapping || [],
    quotes: (j.quotes_monthly || []).map((r) => ({ month: String(r.month).slice(0, 7), category: String(r.category), source: String(r.source), count: n(r.count) })),
    keywords: (j.g_keywords || []).map((r) => kw('Google', r)).concat((j.n_keywords || []).map((r) => kw('Naver', r))),
    ads: (j.g_ads || []).map((r) => ad('Google', r)).concat((j.n_ads || []).map((r) => ad('Naver', r))),
  };
}

/** 카테고리: mapping 시트(광고그룹 → 캠페인 순)로 정하고, 없으면 캠페인 이름을 그대로 쓴다. */
function buildMap() {
  MAP = new Map();
  D.mapping.filter((r) => String(r.category || '').trim()).forEach((r) => {
    const k = [r.media, r.campaign, r.ad_group || ''].join('\u0001');
    if (!MAP.has(k)) MAP.set(k, []);
    MAP.get(k).push({ c: String(r.category).trim(), w: (Number(r.ratio) || 100) / 100 });
  });
}
const catsOf = (r) => MAP.get([r.media, r.campaign, r.adgroup].join('\u0001')) || MAP.get([r.media, r.campaign, ''].join('\u0001')) || [{ c: r.campaign || '미분류', w: 1 }];
function catSum(rows, f) {
  const o = {};
  rows.forEach((r) => catsOf(r).forEach(({ c, w }) => { o[c] = (o[c] || 0) + f(r) * w; }));
  return o;
}

/* ── 불러오기 (10분마다) ── */
async function load() {
  const c = getCfg();
  if (!c.url || !c.key) { STATUS = 'sample'; status(); return; }
  try {
    const res = await fetch(c.url + (c.url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(c.key));
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    D = fromApi(j); STATUS = 'live';
  } catch (e) {
    console.error('[its-ad-insight] 데이터를 불러오지 못했습니다', e);
    STATUS = STATUS === 'live' ? 'live' : 'error'; // 이미 받은 데이터가 있으면 그대로 둔다
  }
  buildMap(); status(); render();
}
function status() {
  const live = STATUS === 'live';
  const u = document.querySelector('.upd');
  u.classList.toggle('live', live);
  if (live) { u.textContent = `실제 데이터 · ${D.updated} 수집`; }
  else { u.innerHTML = (STATUS === 'error' ? '연동 오류' : '예시 데이터') + ' <button class="link-btn" onclick="openCfg()">연결 설정</button>'; }
  document.querySelectorAll('[data-src]').forEach((x) => { x.textContent = live ? '실제 데이터' : '예시 데이터'; x.classList.toggle('live', live); });
  document.body.classList.toggle('live', live);
}

/* ── 차트: 컨테이너 실제 폭으로 그려 글자가 늘거나 줄지 않게 한다 ── */
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
const axisC = (v) => v >= 1000 ? (+(v / 1000).toFixed(1)) + 'k' : String(Math.round(v));
const legend = (id, series) => { $(id).innerHTML = series.map((s) => `<span><i style="background:var(${s.c})"></i>${s.k}</span>`).join(''); };
const empty = (msg) => `<div class="empty">${msg}</div>`;

/** labels: x축 이름, series: [{ k, c, v:[값] }] */
function stacked(id, labels, series, unit) {
  const box = $(id), r = rem(), W = box.clientWidth, H = 15 * r, L = 2.5 * r, B = 1.5 * r, T = 0.5 * r;
  if (!W) return; // 숨겨진 화면은 보일 때 그린다
  if (!series.length) { box.innerHTML = empty('표시할 데이터가 없습니다'); return; }
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.v[i] || 0), 0));
  const max = niceMax(Math.max(...totals)), ph = H - B - T, bw = (W - L) / labels.length;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = T + ph - ph * i / 4;
    g += `<line class="g" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text x="${L - 0.5 * r}" y="${y + 0.25 * r}" text-anchor="end">${axisC(max * i / 4)}</text>`;
  }
  labels.forEach((m, i) => {
    let acc = 0; const x = L + i * bw + bw * 0.2;
    series.forEach((s) => {
      const h = ph * (s.v[i] || 0) / max;
      if (h > 0) g += `<rect class="hit" x="${x}" y="${T + ph - acc - h}" width="${bw * 0.6}" height="${Math.max(h - 1, 0)}" fill="var(${s.c})" data-tip="${m} · ${esc(s.k)}|${fmt(s.v[i])}${unit}"/>`;
      acc += h;
    });
    g += `<text x="${L + i * bw + bw / 2}" y="${H - 0.25 * r}" text-anchor="middle">${m}</text>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${g}</svg>`;
}

/** list: [{ k, cur, prev, q? }] — 만원 단위, q 가 있으면 견적 수 표시 */
function catChart(id, list) {
  const box = $(id), r = rem(), W = box.clientWidth, rowH = 2.5 * r, L = 7 * r, hasQ = list.some((c) => c.q != null), R = (hasQ ? 8.5 : 4) * r, H = list.length * rowH;
  if (!W) return;
  if (!list.length) { box.innerHTML = empty('표시할 데이터가 없습니다'); return; }
  const max = niceMax(Math.max(...list.map((c) => Math.max(c.cur, c.prev)))), pw = W - L - R;
  let g = '';
  list.forEach((c, i) => {
    const y = i * rowH, d = c.prev ? Math.round((c.cur - c.prev) / c.prev * 1000) / 10 : null;
    const name = c.k.length > 9 ? c.k.slice(0, 8) + '…' : c.k;
    g += `<text x="${L - 0.5 * r}" y="${y + 1.25 * r}" text-anchor="end" style="fill:var(--ink2)"><title>${esc(c.k)}</title>${esc(name)}</text>`;
    g += `<rect class="hit" x="${L}" y="${y + 0.25 * r}" width="${pw * c.cur / max}" height="${0.75 * r}" rx="0" fill="var(--bar)" data-tip="${esc(c.k)} · 기준월|${fmt(c.cur)}만원"/>`;
    g += `<rect class="hit" x="${L}" y="${y + 1.25 * r}" width="${pw * c.prev / max}" height="${0.5 * r}" rx="0" fill="var(--bar2)" data-tip="${esc(c.k)} · 전월|${fmt(c.prev)}만원"/>`;
    if (d != null) g += `<text x="${L + pw * Math.max(c.cur, c.prev) / max + 0.5 * r}" y="${y + r}" style="fill:var(${d >= 0 ? '--up' : '--down'});font-weight:600">${d >= 0 ? '▲' : '▼'}${Math.abs(d)}%</text>`;
    if (hasQ) g += `<text x="${W}" y="${y + 1.25 * r}" text-anchor="end" style="fill:var(--ink2);font-weight:600">견적 ${c.q}건</text>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${g}</svg>`;
}

/** 증감률. lowerBetter 면 줄어든 쪽을 초록으로 */
const pct = (a, b, lowerBetter) => {
  if (!b) return null;
  const p = Math.round((a - b) / b * 1000) / 10, up = p >= 0, good = lowerBetter ? !up : up;
  return { cls: p === 0 ? 'flat' : good ? 'up' : 'down', txt: `${up ? '▲' : '▼'} ${Math.abs(p)}%` };
};
const delta = (a, b, label, lowerBetter) => { const p = pct(a, b, lowerBetter); return p ? `<div class="d ${p.cls}">${p.txt} <small>${label}</small></div>` : `<div class="d flat">– <small>${label} 값 없음</small></div>`; };
const dspan = (a, b, lowerBetter) => { const p = pct(a, b, lowerBetter); return p ? `<span class="d ${p.cls}">${p.txt}</span>` : '–'; };

/* ── 01 월별 광고비 ── */
const SERIES = [
  { k: 'Google SA', c: '--c-g', f: (r) => r.media === 'Google' && r.type === 'SA' },
  { k: 'Google DA', c: '--c-g2', f: (r) => r.media === 'Google' && r.type === 'DA' },
  { k: 'Naver SA', c: '--c-n', f: (r) => r.media === 'Naver' && r.type === 'SA' },
  { k: 'Naver DA', c: '--c-n2', f: (r) => r.media === 'Naver' && r.type === 'DA' },
  { k: 'Meta', c: '--c-m', f: (r) => r.media === 'Meta' },
];
function renderAds() {
  const years = [...new Set(D.spend.map((r) => Number(r.month.slice(0, 4))))].sort((a, b) => b - a);
  if (!years.includes(ST.year)) ST.year = years[0] || THIS_Y;
  $('segYear').innerHTML = (years.length ? years : [THIS_Y]).map((y) => `<button data-v="${y}">${y}</button>`).join('');
  syncSeg();
  const Y = ST.year, months = Array.from({ length: Y === THIS_Y ? NOW.getMonth() + 1 : 12 }, (_, i) => ym(Y, i + 1));
  const at = (mo) => D.spend.filter((r) => r.month === mo);
  const tot = (mo) => sumBy(at(mo), (r) => r.cost);
  const man = (mo, item) => sumBy(D.manual.filter((r) => r.month === mo && r.item === item), (r) => r.amount);
  const curM = months[months.length - 1], pv = prevM(curM), upTo = +curM.slice(5);
  const ytd = (y) => sumBy(D.spend.filter((r) => r.month >= ym(y, 1) && r.month <= ym(y, upTo)), (r) => r.cost);
  const cpa = (mo) => { const c = sumBy(at(mo), (r) => r.conv); return c ? tot(mo) / c : 0; };
  const ing = curM === THIS_M ? ' <small class="muted">(진행 중)</small>' : '';
  $('kpiAds').innerHTML =
    `<div class="kpi"><div class="l">${mLabel(curM)} 광고비${ing}</div><div class="v">${fmt(tot(curM))}</div>${delta(tot(curM), tot(pv), '전월')}</div>` +
    `<div class="kpi"><div class="l">${Y}년 누적 (1~${upTo}월)</div><div class="v">${fmt(ytd(Y))}</div>${delta(ytd(Y), ytd(Y - 1), '전년 동기')}</div>` +
    `<div class="kpi"><div class="l">${mLabel(curM)} MDF 소진</div><div class="v">${fmt(man(curM, 'MDF'))}</div>${delta(man(curM, 'MDF'), man(pv, 'MDF'), '전월')}</div>` +
    `<div class="kpi"><div class="l">${mLabel(curM)} 전환 1건당 광고비</div><div class="v">${fmt(cpa(curM))}</div>${delta(cpa(curM), cpa(pv), '전월', true)}</div>`;

  const series = SERIES.map((s) => ({ ...s, raw: months.map((mo) => sumBy(at(mo).filter(s.f), (r) => r.cost)) })).filter((s) => s.raw.some((v) => v));
  const cats = (mo) => catSum(at(mo), (r) => r.cost);
  const a = cats(curM), b = cats(pv), keys = Object.keys(a).concat(Object.keys(b).filter((k) => !(k in a))).sort((x, y) => (a[y] || 0) - (a[x] || 0));
  const top = keys.slice(0, 7), rest = keys.slice(7);
  const list = top.map((k) => ({ k, cur: (a[k] || 0) / 1e4, prev: (b[k] || 0) / 1e4 }));
  if (rest.length) list.push({ k: `기타 ${rest.length}개`, cur: sumBy(rest, (k) => a[k] || 0) / 1e4, prev: sumBy(rest, (k) => b[k] || 0) / 1e4 });
  const hasQuotes = STATUS === 'live' && D.quotes && D.quotes.length > 0;
  const qOf = (mo, c) => D.quotes.filter((r) => r.month === mo && r.category === c).reduce((a, r) => a + r.count, 0);
  if (STATUS !== 'live') list.forEach((c, i) => { c.q = [96, 88, 41, 52, 23][i] ?? 10; }); // 연동 전에는 예시만
  else if (hasQuotes) list.forEach((c) => { c.q = qOf(curM, c.k); });
  $('ttCat').innerHTML = `카테고리별 소진 (${mLabel(curM)} vs ${mLabel(pv)})${STATUS === 'live' && !hasQuotes ? ' <span class="muted">견적 수는 견적 연동 후 표시</span>' : ' · 견적 수'}`;

  const chart = ST.mode === 'chart';
  $('lgSpend').hidden = $('lgCat').hidden = !chart;
  if (chart) {
    legend('lgSpend', series);
    stacked('chSpend', months.map(mLabel), series.map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) })), '만원');
    catChart('chCat', list);
    return;
  }
  const lastY = (mo) => tot(ym(Y - 1, +mo.slice(5)));
  $('chSpend').innerHTML = `<div class="tw"><table class="stk"><thead><tr><th>월</th>${series.map((s) => `<th class="n">${s.k}</th>`).join('')}<th class="n">합계</th><th class="n">MDF</th><th class="n">스토어</th><th class="n">전년 동월</th><th class="n">전년비</th></tr></thead><tbody>` +
    months.map((mo, i) => { const t = tot(mo), l = lastY(mo); return `<tr><td>${mLabel(mo)}</td>${series.map((s) => `<td class="n">${fmt(s.raw[i])}</td>`).join('')}<td class="n"><b>${fmt(t)}</b></td><td class="n">${fmt(man(mo, 'MDF'))}</td><td class="n">${fmt(man(mo, 'STORE'))}</td><td class="n">${fmt(l)}</td><td class="n">${dspan(t, l)}</td></tr>`; }).join('') +
    `<tr class="grp"><td>합계</td>${series.map((s) => `<td class="n">${fmt(sumBy(s.raw, (v) => v))}</td>`).join('')}<td class="n">${fmt(sumBy(months, tot))}</td><td class="n">${fmt(sumBy(months, (m) => man(m, 'MDF')))}</td><td class="n">${fmt(sumBy(months, (m) => man(m, 'STORE')))}</td><td class="n">${fmt(sumBy(months, lastY))}</td><td></td></tr></tbody></table></div><p class="muted small">단위: 원 · 스토어·MDF·Meta 는 시트 manual 탭 입력값</p>`;
  $('chCat').innerHTML = list.length ? `<table><thead><tr><th>카테고리</th><th class="n">${mLabel(curM)}</th><th class="n">${mLabel(pv)}</th><th class="n">증감</th></tr></thead><tbody>` +
    list.map((c) => `<tr><td>${esc(c.k)}</td><td class="n">${fmt(c.cur * 1e4)}</td><td class="n">${fmt(c.prev * 1e4)}</td><td class="n">${dspan(c.cur, c.prev)}</td></tr>`).join('') + '</tbody></table>' : empty('표시할 데이터가 없습니다');
}

/* ── 02 카테고리 세부 ── */
function renderKw() {
  syncSeg();
  const pass = (r) => (ST.media === 'all' || r.media === ST.media) && r.type === ST.type;
  const pill = (m) => `<span class="pill ${m === 'Google' ? 'g' : m === 'Naver' ? 'n' : 'm'}">${m}</span>`;

  // 카테고리별 전환·소진 (데이터가 있는 마지막 달)
  const ms = [...new Set(D.spend.map((r) => r.month))].sort(), mo = ms.filter((m) => m <= THIS_M).pop();
  const rows = D.spend.filter((r) => r.month === mo && pass(r));
  const cost = catSum(rows, (r) => r.cost), clk = catSum(rows, (r) => r.clk), conv = catSum(rows, (r) => r.conv);
  $('ttCatConv').innerHTML = `카테고리별 전환 · 소진 <span class="muted">${mo ? `${mo.slice(0, 4)}년 ${mLabel(mo)}` : ''}${mo === THIS_M ? ' (진행 중)' : ''}</span>`;
  const ck = Object.keys(cost).sort((a, b) => cost[b] - cost[a]);
  $('tbCatConv').innerHTML = ck.length ? '<thead><tr><th>카테고리</th><th class="n">광고비</th><th class="n">클릭</th><th class="n">전환</th><th class="n">전환당 비용</th></tr></thead><tbody>' +
    ck.map((k) => `<tr><td>${esc(k)}</td><td class="n">${fmt(cost[k])}</td><td class="n">${fmt(clk[k])}</td><td class="n">${fmt(conv[k])}</td><td class="n">${conv[k] ? fmt(cost[k] / conv[k]) : '–'}</td></tr>`).join('') + '</tbody>'
    : `<tbody><tr><td>${empty('이 조건의 데이터가 없습니다')}</td></tr></tbody>`;

  // 키워드 (SA만)
  if (ST.type === 'DA') {
    $('ttKw').textContent = '키워드';
    $('tbKw').innerHTML = `<tbody><tr><td>${empty('DA는 키워드 대신 배너 소재로 운영합니다 — 아래 소재를 확인하세요')}</td></tr></tbody>`;
  } else {
    const ks = D.keywords.filter(pass), groups = {};
    ks.forEach((k) => { const g = [k.media, k.campaign, k.adgroup].join('\u0001'); (groups[g] = groups[g] || { media: k.media, campaign: k.campaign, adgroup: k.adgroup, cost: 0, list: [] }).list.push(k); groups[g].cost += k.cost; });
    const gs = Object.values(groups).sort((a, b) => b.cost - a.cost).slice(0, 10);
    $('ttKw').innerHTML = `키워드 <span class="muted">최근 30일 · 광고비 상위 광고그룹 ${gs.length}개, 그룹당 상위 10개</span>`;
    $('tbKw').innerHTML = '<thead><tr><th>캠페인 › 광고그룹 / 키워드</th><th class="n">현재 입찰가</th><th>품질</th><th class="n">노출</th><th class="n">클릭</th><th class="n">CTR</th><th class="n">전환</th><th class="n">광고비</th></tr></thead><tbody>' +
      (gs.length ? gs.map((g) => `<tr class="grp"><td colspan="8">${pill(g.media)} ${esc(g.campaign)} › ${esc(g.adgroup)}</td></tr>` +
        g.list.sort((a, b) => b.cost - a.cost || b.clk - a.clk).slice(0, 10).map((k) => {
          const max = k.media === 'Naver' ? 7 : 10, q = Array.from({ length: max }, (_, i) => `<i class="${i < k.quality ? 'on' : ''}"></i>`).join('');
          return `<tr><td class="ind">${esc(k.keyword)}</td><td class="n">${fmt(k.bid)}원</td><td>${k.quality ? `<span class="qs-bar" data-tip="품질${k.media === 'Naver' ? '지수' : '점수'}|${k.quality} / ${max}">${q}</span>${k.quality}` : '<span class="muted">–</span>'}</td>` +
            `<td class="n">${fmt(k.imp)}</td><td class="n">${fmt(k.clk)}</td><td class="n">${k.imp ? (k.clk / k.imp * 100).toFixed(1) + '%' : '–'}</td><td class="n">${fmt(k.conv)}</td><td class="n">${fmt(k.cost)}</td></tr>`;
        }).join('')).join('') : `<tr><td colspan="8">${empty('이 조건의 키워드가 없습니다')}</td></tr>`) + '</tbody>';
  }

  // 소재
  const ads = D.ads.filter(pass).sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0)).slice(0, 12);
  const colors = { Google: '--c-g', Naver: '--c-n', Meta: '--c-m' };
  $('creatives').innerHTML = ads.length ? ads.map((c) =>
    `<div class="cr"><div class="img" style="background:var(${colors[c.media] || '--c-it'})">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy" referrerpolicy="no-referrer">` : `${esc(c.title)}<small>${c.type === 'SA' ? '텍스트 광고' : '이미지 없음'}</small>`}</div>` +
    `<div class="meta"><b>${esc(c.title)}</b>${c.media} ${c.type} · ${esc(c.campaign)} › ${esc(c.adgroup)}<br>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a>` : ''}</div></div>`).join('')
    : empty('이 조건의 소재가 없습니다');
}

/* ── 03 견적 Data (견적 시트 집계가 있으면 실제 값, 없으면 예시) ── */
const Q_MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월'];
const QUOTES = [
  { k: 'ITKET', c: '--c-it', v: [140, 128, 152, 160, 155, 170, 162, 150, 165, 172] },
  { k: '캐드코리아', c: '--c-g', v: [40, 38, 45, 50, 46, 52, 48, 44, 49, 51] },
  { k: 'ZbyHP', c: '--c-m', v: [22, 20, 26, 28, 25, 30, 27, 24, 28, 30] },
  { k: '전화상담', c: '--c-etc', v: [35, 33, 38, 40, 37, 42, 40, 36, 39, 41] }
];
const SRC = [{ k: 'Naver', c: '--c-n', v: 46 }, { k: 'Google', c: '--c-g', v: 31 }, { k: '직접·기타', c: '--sub', v: 21 }, { k: 'Meta', c: '--c-m', v: 2 }];
function renderQuotes() {
  const live = STATUS === 'live' && D.quotes && D.quotes.length;
  let labels = Q_MONTHS, series = QUOTES, src = SRC;
  if (live) {
    // 올해(가장 최근 견적이 있는 해) 1월부터 최근 달까지, 카테고리별로 쌓아서 보여 준다
    const last = D.quotes.reduce((m, r) => (r.month > m ? r.month : m), '');
    const yr = last.slice(0, 4), mm = +last.slice(5, 7);
    labels = Array.from({ length: mm }, (_, i) => `${i + 1}월`);
    const cats = ['서버', '워크스테이션', '스토리지', 'PC·노트북', '기타'];
    const colors = ['--c-it', '--c-g', '--c-m', '--c-etc', '--c-n'];
    const cnt = (mo, k) => D.quotes.filter((r) => r.month === mo && r.category === k).reduce((a, r) => a + r.count, 0);
    series = cats.map((k, ci) => ({ k, c: colors[ci], v: labels.map((_, i) => cnt(`${yr}-${String(i + 1).padStart(2, '0')}`, k)) })).filter((s) => s.v.some((x) => x));
    // 유입경로는 수집을 시작한 달부터만 있으므로 '미수집'은 비율에서 뺀다
    const bySrc = {};
    D.quotes.filter((r) => r.month.startsWith(yr) && r.source !== '미수집').forEach((r) => { bySrc[r.source] = (bySrc[r.source] || 0) + r.count; });
    const tot = Object.values(bySrc).reduce((a, b) => a + b, 0);
    const sc = { Naver: '--c-n', Google: '--c-g', Meta: '--c-m', '직접·기타': '--sub' };
    src = tot ? Object.keys(bySrc).sort((a, b) => bySrc[b] - bySrc[a]).map((k) => ({ k, c: sc[k] || '--sub', v: Math.round((bySrc[k] / tot) * 100) })) : [];
  }
  legend('lgQuote', series); stacked('chQuote', labels, series, '건');
  if (!src.length) { $('chSrc').innerHTML = empty('유입경로 수집이 시작된 뒤부터 표시됩니다'); return; }
  const bar = src.map((x) => `<span style="flex:${x.v};background:var(${x.c})" data-tip="${x.k}|${x.v}%"></span>`).join('');
  const rows = src.map((x) => `<tr><td><span class="pill" style="--pc:var(${x.c})">${x.k}</span></td><td class="n">${x.v}%</td></tr>`).join('');
  $('chSrc').innerHTML = `<div style="display:flex;height:1.25rem;overflow:hidden;gap:1px;margin-bottom:0.75rem">${bar}</div><table>${rows}</table>`;
}

function render() {
  if (cur === 'ads') renderAds();
  else if (cur === 'keywords') renderKw();
  else if (cur === 'quotes') renderQuotes();
}

let rt;
addEventListener('resize', () => { if (innerWidth > 768) drawer(false); clearTimeout(rt); rt = setTimeout(render, 120); });
$('theme').setAttribute('aria-checked', isDark());
addEventListener('hashchange', () => { if (location.hash.slice(1) !== cur) go(location.hash.slice(1)); });
buildMap(); status();
go(location.hash.slice(1));
load();
setInterval(load, 10 * 60 * 1000);
