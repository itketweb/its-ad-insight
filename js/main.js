/* its-ad-insight — 화면 동작 + 데이터 연동
   js/config.js 에 웹앱 주소·비밀키가 있으면 실제 데이터(Google Ads·네이버 검색광고)를, 없으면 예시 데이터를 보여 준다.
   메뉴·테마·툴팁 동작과 차트 그리는 방식은 itket-analytics 와 같게 맞춘다. */
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const empty = (msg) => `<div class="empty">${String(msg ?? '')}</div>`;

/* ── 기본 고정 연결 정보 (웹앱 URL 및 비밀키 상시 자동 연동) ── */
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbzQS9yMlp9L_eRaH77QWLsY6GOY7L5hyRk1fkuaAHg8GvJmHHwhPRgr2zWldgbX5-cNcg/exec';
const DEFAULT_KEY = '2d3b0cc2b04a4873a835583968ca7a0b';

/* ── 연결 설정: localStorage → config.js(window.ADI) → 기본 고정값 순으로 읽는다 ── */
function getCfg() {
  const c = window.ADI || {};
  let s = {};
  try { s = JSON.parse(localStorage.getItem('adi_cfg') || '{}'); } catch (e) {}
  const url = (s.url && String(s.url).trim()) ? String(s.url).trim() : (c.url && String(c.url).trim()) ? String(c.url).trim() : DEFAULT_URL;
  const key = (s.key && String(s.key).trim()) ? String(s.key).trim() : (c.key && String(c.key).trim()) ? String(c.key).trim() : DEFAULT_KEY;
  return { url, key };
}
/* ── 테마 ── */
try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
const isDark = () => { const r = document.documentElement; return r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; };
const syncTheme = () => { $('theme').setAttribute('aria-checked', isDark()); render(); };
$('theme').onclick = () => { const r = document.documentElement; r.dataset.theme = isDark() ? 'light' : 'dark'; try { localStorage.setItem('theme', r.dataset.theme); } catch (e) {} syncTheme(); };
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', syncTheme);
if ($('print')) $('print').onclick = () => print();

/* ── 모바일 메뉴 및 버튼 ── */
function drawer(on) {
  $('side').classList.toggle('open', on); $('scrim').classList.toggle('on', on);
  document.body.classList.toggle('lock', on); $('burger').setAttribute('aria-expanded', on);
}
$('burger').onclick = () => drawer(true);
$('scrim').onclick = $('sclose').onclick = () => drawer(false);
addEventListener('keydown', (e) => { if (e.key === 'Escape') drawer(false); });
if ($('syncBtn')) $('syncBtn').onclick = () => load();

/* ── 화면 전환: 메뉴마다 다른 화면을 보여 준다 (주소의 #은 새로고침 시 같은 화면 유지용) ── */
const views = [...document.querySelectorAll('.view')];
const navs = [...document.querySelectorAll('.side .nv')];
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
  document.title = view.dataset.title + ' · its-ad-insight';
  history.replaceState(null, '', v === views[0].dataset.view ? location.pathname + location.search : '#' + v);
  mark(); drawer(false); render(); window.scrollTo({ top: 0 });
}
navs.forEach((b) => b.onclick = () => {
  const grp = b.closest('.grp');
  if (grp && b.hasAttribute('data-parent')) fold(grp, true);
  go(b.dataset.v);
});
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.dataset.go));
const brand = $('brand') || document.querySelector('.brand');
if (brand) {
  brand.onclick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    go(views[0].dataset.view);
  };
}

/* ── 하위 메뉴 접기/펼치기 ── */
function fold(grp, open) {
  grp.classList.toggle('open', open);
  const b = grp.querySelector('.fold');
  b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', open ? '하위 메뉴 접기' : '하위 메뉴 펼치기');
  mark();
}
document.querySelectorAll('.side .grp').forEach((grp) => {
  grp.querySelector('.fold').onclick = () => fold(grp, !grp.classList.contains('open'));
});

/* ── 필터 탭: data-k 의 값을 바꾸고 다시 그린다 ── */
const ST = {
  year: 0,
  mode: 'chart',
  media: 'all',
  type: 'SA',
  chartType: {
    chOverviewSpend: 'line',
    chOverviewQuotes: 'line',
    chSpend: 'line',
    chQuote: 'line'
  }
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('.seg[data-k] button');
  if (b) {
    const k = b.closest('.seg').dataset.k;
    ST[k] = k === 'year' ? Number(b.dataset.v) : b.dataset.v;
    render();
    return;
  }
  const cb = e.target.closest('.seg-mini[data-chart] button');
  if (cb) {
    const chartId = cb.closest('.seg-mini').dataset.chart;
    ST.chartType[chartId] = cb.dataset.v;
    cb.closest('.seg-mini').querySelectorAll('button').forEach((btn) => btn.classList.toggle('on', btn === cb));
    render();
  }
});
function syncSeg() {
  document.querySelectorAll('.seg[data-k]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(ST[g.dataset.k]) === b.dataset.v)));
  document.querySelectorAll('.seg-mini[data-chart]').forEach((g) => {
    const id = g.dataset.chart;
    const curType = ST.chartType[id] || 'line';
    g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === curType));
  });
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

/* ── 데이터 모델 (실제 취합 데이터만 사용) ──
   spend    : { month, media, type(SA/DA), campaign, adgroup, cost(원), imp, clk, conv }
   manual   : { month, item(MDF/META/STORE), amount }
   keywords : { media, type, campaign, adgroup, keyword, match, bid, quality, cost, imp, clk, conv } — 최근 30일
   ads      : { media, type, campaign, adgroup, title, url, image }
   mapping  : 시트의 mapping (media·campaign·ad_group → category, ratio) */
function emptyData() {
  return {
    updated: '',
    sources: { google: '', naver: '' },
    spend: [],
    manual: [],
    mapping: [],
    quotes: [],
    keywords: [],
    ads: [],
  };
}
let D = emptyData(), MAP = new Map(), STATUS = 'init';

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
  const candidates = [j.served, upd(j.g_meta), upd(j.n_meta), upd(j.q_meta)].map((v) => String(v || '').trim()).filter(Boolean);
  const precise = candidates.filter((s) => s.length >= 10);
  const rawUpdated = precise.length ? precise.sort().pop() : (candidates.sort().pop() || '');
  const fmtUpdated = (s) => {
    if (!s) return '';
    if (s.includes('T')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const pad = (v) => String(v).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    return s;
  };
  return {
    updated: fmtUpdated(rawUpdated),
    sources: { google: upd(j.g_meta), naver: upd(j.n_meta), quote: upd(j.q_meta) },
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

let IS_SYNCING = false;

/* ── 로컬 캐시에서 즉시 복원 (0초 렌더링) ── */
function restoreFromCache() {
  try {
    const cached = localStorage.getItem('adi_data_cache');
    if (cached) {
      const j = JSON.parse(cached);
      if (j && ((j.quotes_monthly && j.quotes_monthly.length) || (j.n_adgroup_monthly && j.n_adgroup_monthly.length))) {
        D = fromApi(j);
        STATUS = 'live';
        console.log('[its-ad-insight] 로컬 캐시에서 실데이터 즉시 복원 완료 (0초 노출)');
        return true;
      }
    }
  } catch (e) {
    console.warn('[its-ad-insight] 로컬 캐시 복원 건너뜀:', e);
  }
  return false;
}

/* ── 불러오기 (백그라운드 SWR 방식: 기존 데이터는 절대 날리지 않음) ── */
async function load() {
  const c = getCfg();
  console.log('[its-ad-insight] 실데이터 동기화 시작, URL:', c.url);
  if (!c.url || !c.key) {
    if (STATUS !== 'live') { STATUS = 'unlinked'; status(); render(); }
    return;
  }
  IS_SYNCING = true;
  status();

  try {
    const fetchUrl = c.url + (c.url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(c.key);
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    D = fromApi(j);
    STATUS = 'live';
    try { localStorage.setItem('adi_data_cache', JSON.stringify(j)); } catch (e) {}
    console.log('[its-ad-insight] 실데이터 연동 성공, 수집일시:', D.updated, '광고행수:', D.spend.length, '견적행수:', D.quotes.length);
  } catch (e) {
    console.error('[its-ad-insight] 실데이터 동기화 오류 (화면 데이터 유지):', e);
    // 기존에 live 데이터가 없으면 로컬 정적 백업 data/latest.json 시도
    if (STATUS !== 'live') {
      try {
        const localRes = await fetch('data/latest.json');
        if (localRes.ok) {
          const localJ = await localRes.json();
          D = fromApi(localJ);
          STATUS = 'live';
          try { localStorage.setItem('adi_data_cache', JSON.stringify(localJ)); } catch (err) {}
          console.log('[its-ad-insight] 로컬 백업(data/latest.json)에서 실데이터 복원 완료');
        } else {
          STATUS = 'error';
        }
      } catch (err) {
        STATUS = 'error';
      }
    }
  } finally {
    IS_SYNCING = false;
  }
  buildMap(); status(); render();
}

function status() {
  const live = STATUS === 'live';
  const u = document.querySelector('.upd');
  if (!u) return;
  u.classList.toggle('live', live);
  if (live) {
    const syncText = IS_SYNCING ? ' · <span class="sync-pulse">동기화 중...</span>' : '';
    u.innerHTML = `실제 데이터 · ${esc(D.updated || '취합본')} 수집${syncText}`;
  } else {
    u.innerHTML = (STATUS === 'error' ? '연동 지연 (자동 재시도 중)' : '실데이터 자동 연결 중...') + ' <button class="link-btn" onclick="load()">지금 새로고침</button>';
  }
  document.querySelectorAll('[data-src]').forEach((x) => {
    x.textContent = live ? '실제 취합 데이터' : '데이터 대기 중';
    x.classList.toggle('live', live);
  });
  document.body.classList.toggle('live', live);
}

/* ── 차트: 컨테이너 실제 폭으로 그려 글자가 늘거나 줄지 않게 한다 ── */
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
const axisC = (v) => v >= 1000 ? (+(v / 1000).toFixed(1)) + 'k' : String(Math.round(v));
function renderLegend(legId, series, boxId) {
  const leg = $(legId);
  if (!leg) return;
  leg.innerHTML = series.map((s, si) =>
    `<span class="leg-item" data-si="${si}"><i style="background:var(${s.c})"></i>${esc(s.k)}</span>`
  ).join('');

  leg.querySelectorAll('.leg-item').forEach((item) => {
    const si = item.dataset.si;
    item.onmouseenter = () => highlightSeries(boxId, si);
    item.onmouseleave = () => highlightSeries(boxId, null);
  });
}

function highlightSeries(boxId, si) {
  const box = $(boxId);
  if (!box) return;
  const els = box.querySelectorAll('.chart-line, .chart-area, .chart-dot, .chart-bar');
  if (si === null) {
    els.forEach((el) => {
      el.style.opacity = '';
      if (el.classList.contains('chart-line')) el.style.strokeWidth = '';
    });
    return;
  }
  els.forEach((el) => {
    const match = el.classList.contains(`s-${si}`);
    el.style.opacity = match ? '1' : '0.15';
    if (el.classList.contains('chart-line')) {
      el.style.strokeWidth = match ? '3.5' : '1.5';
    }
  });
}

/** 다목적 직관적 차트: 꺾은선(추이, 기본값) / 나란히 막대(그룹) / 누적 막대 */
function renderChart(boxId, legId, labels, series, unit) {
  const box = $(boxId);
  if (!box) return;
  const r = rem(), W = box.clientWidth;
  if (!W) {
    setTimeout(() => {
      const b = $(boxId);
      if (b && b.clientWidth) renderChart(boxId, legId, labels, series, unit);
    }, 60);
    return;
  }
  if (!series.length || !labels.length) {
    box.innerHTML = empty('표시할 데이터가 없습니다');
    if ($(legId)) $(legId).innerHTML = '';
    return;
  }

  const type = ST.chartType[boxId] || 'line';
  const H = 16 * r, L = 3.5 * r, R = 1.5 * r, T = 1.5 * r, B = 2 * r;
  const pw = W - L - R, ph = H - T - B, N = labels.length, S = series.length;
  const bw = pw / N;

  renderLegend(legId, series, boxId);

  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.v[i] || 0), 0));
  const maxSeries = Math.max(1, ...series.flatMap((s) => s.v));
  const maxTotal = Math.max(1, ...totals);
  const max = niceMax(type === 'stacked' ? maxTotal : maxSeries);

  const getY = (v) => T + ph * (1 - Math.max(0, v || 0) / max);
  const getX = (i) => L + (i + 0.5) * bw;

  let g = '';
  // 배경 격자선 및 Y축 눈금
  for (let i = 0; i <= 4; i++) {
    const y = T + ph * (1 - i / 4);
    g += `<line class="g" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" ${i ? 'stroke-dasharray="3 3"' : ''}/>` +
         `<text x="${L - 0.5 * r}" y="${y + 0.25 * r}" text-anchor="end">${axisC(max * i / 4)}</text>`;
  }

  if (type === 'line') {
    // 1) 꺾은선 추이 그래프 (기본: 채널별 추이를 동일 0 기준선에서 왜곡 없이 직관적으로 비교)
    series.forEach((s, si) => {
      const pts = labels.map((_, i) => ({ x: getX(i), y: getY(s.v[i]) }));
      const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(T + ph).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(T + ph).toFixed(1)} Z`;
      g += `<path class="chart-area s-${si}" d="${areaD}" fill="var(${s.c})" opacity="0.08"/>`;
      g += `<path class="chart-line s-${si}" d="${pathD}" stroke="var(${s.c})"/>`;
    });

    series.forEach((s, si) => {
      labels.forEach((_, i) => {
        const cx = getX(i).toFixed(1), cy = getY(s.v[i]).toFixed(1);
        g += `<circle class="chart-dot s-${si} p-${i}" cx="${cx}" cy="${cy}" r="3.5" fill="var(--card)" stroke="var(${s.c})" stroke-width="2.5" data-si="${si}" data-i="${i}"/>`;
      });
    });
  } else if (type === 'grouped') {
    // 2) 나란히 막대그래프 (월별로 각 채널의 막대를 0 기준선에 나란히 세워 크기 비교)
    const pad = Math.min(bw * 0.15, 12);
    const usable = bw - pad * 2;
    const subBw = Math.max(3, (usable - (S - 1) * 2) / S);
    labels.forEach((_, i) => {
      series.forEach((s, si) => {
        const v = s.v[i] || 0;
        const bx = L + i * bw + pad + si * (subBw + 2);
        const by = getY(v);
        const bh = Math.max(v > 0 ? 2 : 0, T + ph - by);
        g += `<rect class="chart-bar s-${si} p-${i}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${subBw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="var(${s.c})"/>`;
      });
    });
  } else if (type === 'stacked') {
    // 3) 누적 막대그래프 (전체 합계 규모 및 구성비)
    const barW = Math.max(6, bw * 0.55);
    labels.forEach((_, i) => {
      const bx = L + i * bw + (bw - barW) / 2;
      let acc = 0;
      series.forEach((s, si) => {
        const v = s.v[i] || 0;
        const h = ph * v / max;
        if (h > 0) {
          const by = T + ph - acc - h;
          g += `<rect class="chart-bar s-${si} p-${i}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h - 1, 1).toFixed(1)}" fill="var(${s.c})"/>`;
          acc += h;
        }
      });
      if (totals[i] > 0) {
        g += `<text x="${bx + barW / 2}" y="${T + ph - acc - 4}" text-anchor="middle" font-size="0.6875rem" fill="var(--ink2)" font-weight="600">${fmt(totals[i])}</text>`;
      }
    });
  }

  // X축 레이블
  labels.forEach((m, i) => {
    g += `<text x="${getX(i).toFixed(1)}" y="${H - 0.5 * r}" text-anchor="middle">${m}</text>`;
  });

  // 호버 수직 가이드라인
  g += `<line class="chart-cursor" id="${boxId}_cursor" x1="0" x2="0" y1="${T}" y2="${T + ph}" style="display:none"/>`;

  // 인터랙션용 투명 슬라이스
  labels.forEach((_, i) => {
    g += `<rect class="chart-slice" data-idx="${i}" x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${ph}" fill="transparent"/>`;
  });

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${g}</svg>`;

  bindChartEvents(boxId, labels, series, unit, getX, totals);
}

function bindChartEvents(boxId, labels, series, unit, getX, totals) {
  const box = $(boxId);
  if (!box) return;
  const cursor = $(boxId + '_cursor');
  const tip = $('tip');

  box.onpointermove = (e) => {
    const slice = e.target.closest && e.target.closest('.chart-slice');
    if (!slice) {
      if (cursor) cursor.style.display = 'none';
      box.querySelectorAll('.chart-dot.on').forEach((d) => d.classList.remove('on'));
      if (tip) tip.style.opacity = 0;
      return;
    }
    const idx = Number(slice.dataset.idx);
    const m = labels[idx];
    const total = totals[idx];

    if (cursor) {
      const cx = getX(idx);
      cursor.setAttribute('x1', cx);
      cursor.setAttribute('x2', cx);
      cursor.style.display = '';
    }

    box.querySelectorAll('.chart-dot').forEach((d) => {
      d.classList.toggle('on', d.dataset.i === String(idx));
    });

    const items = series.map((s) => ({
      k: s.k,
      c: s.c,
      v: s.v[idx] || 0,
    })).sort((a, b) => b.v - a.v);

    tip.innerHTML = `
      <div class="tip-box">
        <div class="tip-h"><span>${esc(m)} 실적</span><b>합계 ${fmt(total)}${unit}</b></div>
        <div class="tip-list">
          ${items.map((it) => `
            <div class="tip-row">
              <span><i style="background:var(${it.c})"></i>${esc(it.k)}</span>
              <b>${fmt(it.v)}${unit}<small>(${total > 0 ? (it.v / total * 100).toFixed(1) : 0}%)</small></b>
            </div>
          `).join('')}
        </div>
      </div>`;
    tip.style.opacity = 1;

    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let tx = e.clientX + 14;
    if (tx + tw > innerWidth - 16) tx = e.clientX - tw - 14;
    let ty = e.clientY - th / 2;
    if (ty < 12) ty = 12;
    if (ty + th > innerHeight - 12) ty = innerHeight - th - 12;
    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
  };

  box.onpointerleave = () => {
    if (cursor) cursor.style.display = 'none';
    box.querySelectorAll('.chart-dot.on').forEach((d) => d.classList.remove('on'));
    if (tip) tip.style.opacity = 0;
  };
}

/** list: [{ k, cur, prev, q? }] — 만원 단위, q 가 있으면 견적 수 표시 */
function catChart(id, list) {
  const box = $(id);
  if (!box) return;
  const r = rem(), W = box.clientWidth;
  if (!W) {
    setTimeout(() => {
      const b = $(id);
      if (b && b.clientWidth) catChart(id, list);
    }, 60);
    return;
  }
  const rowH = 2.75 * r, L = 7 * r, hasQ = list.some((c) => c.q != null), R = (hasQ ? 11 : 6) * r, H = list.length * rowH;
  if (!list.length) { box.innerHTML = empty('표시할 데이터가 없습니다'); return; }
  const max = niceMax(Math.max(...list.map((c) => Math.max(c.cur, c.prev)))), pw = W - L - R;
  let g = '';
  list.forEach((c, i) => {
    const y = i * rowH, d = c.prev ? Math.round((c.cur - c.prev) / c.prev * 1000) / 10 : null;
    const name = c.k.length > 9 ? c.k.slice(0, 8) + '…' : c.k;
    const w1 = pw * c.cur / max, w2 = pw * c.prev / max;
    g += `<text x="${L - 0.5 * r}" y="${y + 1.35 * r}" text-anchor="end" style="fill:var(--ink2);font-weight:500"><title>${esc(c.k)}</title>${esc(name)}</text>`;
    g += `<rect class="hit" x="${L}" y="${y + 0.3 * r}" width="${w1}" height="${0.8 * r}" rx="1" fill="var(--bar)" data-tip="${esc(c.k)} · 기준월|${fmt(c.cur)}만원"/>`;
    g += `<text x="${L + w1 + 0.35 * r}" y="${y + 0.9 * r}" font-size="0.6875rem" fill="var(--ink)" font-weight="600">${fmt(c.cur)}만</text>`;
    g += `<rect class="hit" x="${L}" y="${y + 1.35 * r}" width="${w2}" height="${0.55 * r}" rx="1" fill="var(--bar2)" data-tip="${esc(c.k)} · 전월|${fmt(c.prev)}만원"/>`;
    if (d != null) g += `<text x="${hasQ ? W - 6 * r : W}" y="${y + 1.25 * r}" text-anchor="end" style="fill:var(${d >= 0 ? '--up' : '--down'});font-weight:600;font-size:0.75rem">${d >= 0 ? '▲' : '▼'}${Math.abs(d)}%</text>`;
    if (hasQ) g += `<text x="${W}" y="${y + 1.25 * r}" text-anchor="end" style="fill:var(--ink2);font-weight:600">${c.q != null ? `견적 ${c.q}건` : '–'}</text>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${g}</svg>`;
}

/** 유입 매체 비중: 직관적인 도넛 차트 + 프로그레스 바로 개선 */
function renderDonut(id, src) {
  const box = $(id);
  if (!box) return;
  if (!src.length) {
    box.innerHTML = empty('유입경로 수집 데이터가 없습니다.');
    return;
  }

  const r = 44, C = 2 * Math.PI * r;
  let offset = 0;
  const circles = src.map((s) => {
    const dash = (s.v / 100) * C;
    const el = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(${s.c})" stroke-width="14" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    offset += dash;
    return el;
  }).join('');

  const top = src[0] || { k: '-', v: 0 };
  const donutSvg = `
    <svg viewBox="0 0 120 120" role="img" aria-label="유입 매체 점유율">
      ${circles}
      <text x="60" y="55" text-anchor="middle" font-size="0.6875rem" fill="var(--sub)">1위 ${esc(top.k)}</text>
      <text x="60" y="73" text-anchor="middle" font-size="1.125rem" font-weight="700" fill="var(--ink)">${top.v}%</text>
    </svg>`;

  const rows = src.map((s) => `
    <div class="donut-row">
      <span class="pill" style="--pc:var(${s.c})">${esc(s.k)}</span>
      <div class="donut-track">
        <div class="donut-fill" style="width:${s.v}%;background:var(${s.c})"></div>
      </div>
      <span class="pct">${s.v}%</span>
    </div>
  `).join('');

  box.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-chart">${donutSvg}</div>
      <div class="donut-bars">${rows}</div>
    </div>`;
}

/** 증감률. 상승(▲)은 up(빨강), 하락(▼)은 down(파랑) */
const pct = (a, b, lowerBetter) => {
  if (!b) return null;
  const p = Math.round((a - b) / b * 1000) / 10, up = p >= 0;
  return { cls: p === 0 ? 'flat' : up ? 'up' : 'down', txt: `${up ? '▲' : '▼'} ${Math.abs(p)}%` };
};
const delta = (a, b, label, lowerBetter) => { const p = pct(a, b, lowerBetter); return p ? `<div class="d ${p.cls}">${p.txt} <small>${label}</small></div>` : `<div class="d flat">– <small>${label} 값 없음</small></div>`; };
const dspan = (a, b, lowerBetter) => { const p = pct(a, b, lowerBetter); return p ? `<span class="d ${p.cls}">${p.txt}</span>` : '–'; };
const kpiBox = (label, val, a, b, cmpLabel, lowerBetter, sub) => {
  const p = (a != null && b != null) ? pct(a, b, lowerBetter) : null;
  const cls = p && p.cls !== 'flat' ? p.cls : '';
  const dHtml = cmpLabel ? delta(a, b, cmpLabel, lowerBetter) : (sub ? `<div class="s">${sub}</div>` : '');
  return `<div class="kpi ${cls}"><div class="l">${label}</div><div class="v">${val}</div>${dHtml}</div>`;
};

/* ── 공통 시리즈 및 매체 설정 ── */
const SERIES = [
  { k: 'Google SA', c: '--c-g', f: (r) => r.media === 'Google' && r.type === 'SA' },
  { k: 'Google DA', c: '--c-g2', f: (r) => r.media === 'Google' && r.type === 'DA' },
  { k: 'Naver SA', c: '--c-n', f: (r) => r.media === 'Naver' && r.type === 'SA' },
  { k: 'Naver DA', c: '--c-n2', f: (r) => r.media === 'Naver' && r.type === 'DA' },
  { k: 'Meta', c: '--c-m', f: (r) => r.media === 'Meta' },
];

/* ── 01 종합 요약 (Overview) ── */
function renderOverview() {
  const kpiEl = $('kpiOverview');
  if (!kpiEl) return;
  const hasSpend = D.spend && D.spend.length > 0;
  const hasQuotes = D.quotes && D.quotes.length > 0;

  if (!hasSpend && !hasQuotes) {
    kpiEl.innerHTML = '<div class="kpi"><div class="l">데이터 상태</div><div class="v">연결 대기</div><div class="d flat">상단 [연결 설정]을 완료해 주세요</div></div>';
    if ($('chOverviewSpend')) $('chOverviewSpend').innerHTML = empty('취합된 광고비 데이터가 없습니다.');
    if ($('chOverviewQuotes')) $('chOverviewQuotes').innerHTML = empty('취합된 견적 데이터가 없습니다.');
    if ($('chOverviewCat')) $('chOverviewCat').innerHTML = empty('취합된 카테고리 데이터가 없습니다.');
    if ($('chOverviewSrc')) $('chOverviewSrc').innerHTML = empty('취합된 유입 매체 데이터가 없습니다.');
    return;
  }

  const allMonths = [...new Set([...D.spend.map((r) => r.month), ...D.quotes.map((r) => r.month)])].filter(Boolean).sort();
  const curM = allMonths.filter((m) => m <= THIS_M).pop() || allMonths[allMonths.length - 1] || THIS_M;
  const pv = prevM(curM);
  const yr = curM.slice(0, 4), mm = +curM.slice(5, 7);
  const months = Array.from({ length: mm }, (_, i) => ym(yr, i + 1));

  const atSpend = (mo) => D.spend.filter((r) => r.month === mo);
  const totSpend = (mo) => sumBy(atSpend(mo), (r) => r.cost);
  const curSpendTot = totSpend(curM), pvSpendTot = totSpend(pv);

  const atQuotes = (mo) => D.quotes.filter((r) => r.month === mo);
  const totQuotes = (mo) => sumBy(atQuotes(mo), (r) => r.count);
  const curQuotesTot = totQuotes(curM), pvQuotesTot = totQuotes(pv);

  const curCpa = curQuotesTot > 0 ? curSpendTot / curQuotesTot : 0;
  const pvCpa = pvQuotesTot > 0 ? pvSpendTot / pvQuotesTot : 0;

  const ytdSpend = sumBy(D.spend.filter((r) => r.month >= ym(yr, 1) && r.month <= curM), (r) => r.cost);
  const lastYrSpend = sumBy(D.spend.filter((r) => r.month >= ym(+yr - 1, 1) && r.month <= ym(+yr - 1, mm)), (r) => r.cost);

  const ing = curM === THIS_M ? ' <small class="muted">(진행 중)</small>' : '';

  kpiEl.innerHTML =
    kpiBox(`${mLabel(curM)} 총 광고비${ing}`, `${fmt(curSpendTot)}원`, curSpendTot, pvSpendTot, '전월') +
    kpiBox(`${mLabel(curM)} 접수 견적`, `${fmt(curQuotesTot)}건`, curQuotesTot, pvQuotesTot, '전월') +
    kpiBox(`${mLabel(curM)} 견적당 광고비 (CPA)`, `${fmt(curCpa)}원`, curCpa, pvCpa, '전월', true) +
    kpiBox(`${yr}년 누적 광고비 (1~${mm}월)`, `${fmt(ytdSpend)}원`, ytdSpend, lastYrSpend, '전년 동기');

  // 1) 월별 광고비 추이
  const spendSeries = SERIES.map((s) => ({ ...s, raw: months.map((mo) => sumBy(atSpend(mo).filter(s.f), (r) => r.cost)) })).filter((s) => s.raw.some((v) => v));
  renderChart('chOverviewSpend', 'lgOverviewSpend', months.map(mLabel), spendSeries.map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) })), '만원');

  // 2) 월별 견적 추이
  const cats = ['서버', '워크스테이션', '스토리지', 'PC·노트북', '기타'];
  const colors = ['--c-it', '--c-g', '--c-m', '--c-etc', '--c-n'];
  const cnt = (mo, k) => D.quotes.filter((r) => r.month === mo && r.category === k).reduce((a, r) => a + r.count, 0);
  const quoteSeries = cats.map((k, ci) => ({ k, c: colors[ci], v: months.map((mo) => cnt(mo, k)) })).filter((s) => s.v.some((x) => x));
  renderChart('chOverviewQuotes', 'lgOverviewQuotes', months.map(mLabel), quoteSeries, '건');

  // 3) 카테고리별 소진 vs 견적
  const catsMap = (mo) => catSum(atSpend(mo), (r) => r.cost);
  const ca = catsMap(curM), cb = catsMap(pv);
  const catKeys = Object.keys(ca).concat(Object.keys(cb).filter((k) => !(k in ca))).sort((x, y) => (ca[y] || 0) - (ca[x] || 0));
  const topCats = catKeys.slice(0, 7), restCats = catKeys.slice(7);
  const list = topCats.map((k) => ({ k, cur: (ca[k] || 0) / 1e4, prev: (cb[k] || 0) / 1e4 }));
  if (restCats.length) list.push({ k: `기타 ${restCats.length}개`, cur: sumBy(restCats, (k) => ca[k] || 0) / 1e4, prev: sumBy(restCats, (k) => cb[k] || 0) / 1e4 });
  const qOf = (mo, c) => D.quotes.filter((r) => r.month === mo && r.category === c).reduce((a, r) => a + r.count, 0);
  list.forEach((c) => { c.q = qOf(curM, c.k); });
  if ($('ttOverviewCat')) $('ttOverviewCat').innerHTML = `카테고리별 소진 (${mLabel(curM)} vs ${mLabel(pv)})${hasQuotes ? ' · 견적 수' : ''}`;
  catChart('chOverviewCat', list);

  // 4) 유입 매체 비중
  const bySrc = {};
  D.quotes.filter((r) => r.month.startsWith(yr) && r.source !== '미수집').forEach((r) => { bySrc[r.source] = (bySrc[r.source] || 0) + r.count; });
  const totSrc = Object.values(bySrc).reduce((a, b) => a + b, 0);
  const sc = { Naver: '--c-n', Google: '--c-g', Meta: '--c-m', '직접·기타': '--sub' };
  const src = totSrc ? Object.keys(bySrc).sort((a, b) => bySrc[b] - bySrc[a]).map((k) => ({ k, c: sc[k] || '--sub', v: Math.round((bySrc[k] / totSrc) * 100) })) : [];
  renderDonut('chOverviewSrc', src);
}

/* ── 02 월별 광고비 (Ads) ── */
function renderAds() {
  if (!D.spend || !D.spend.length) {
    $('kpiAds').innerHTML = '<div class="kpi"><div class="l">실제 광고비 데이터</div><div class="v">–</div><div class="d flat">데이터 연결 필요</div></div>';
    $('chSpend').innerHTML = empty('취합된 실제 광고비 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요.');
    $('tbSpendDetail').innerHTML = empty('취합된 실제 광고비 데이터가 없습니다.');
    $('lgSpend').hidden = true;
    return;
  }
  const years = [...new Set(D.spend.map((r) => Number(r.month.slice(0, 4))))].sort((a, b) => b - a);
  if (!years.includes(ST.year)) ST.year = years[0] || THIS_Y;
  $('segYear').innerHTML = (years.length ? years : [THIS_Y]).map((y) => `<button data-v="${y}">${y}</button>`).join('');
  syncSeg();
  const Y = ST.year, months = Array.from({ length: Y === THIS_Y ? NOW.getMonth() + 1 : 12 }, (_, i) => ym(Y, i + 1));
  const at = (mo) => D.spend.filter((r) => r.month === mo);
  const tot = (mo) => sumBy(at(mo), (r) => r.cost);
  const man = (mo, item) => sumBy(D.manual.filter((r) => r.month === mo && r.item === item), (r) => r.amount);
  // 스토어 비용: 네이버 스마트스토어 쇼핑검색 API 실데이터(D.spend의 '스마트스토어 쇼핑검' 등) 또는 커머스 API/시트 입력값
  const storeCost = (mo) => {
    const apiStore = sumBy(D.spend.filter((r) => r.month === mo && (r.campaign.includes('스마트스토어') || r.campaign.includes('스토어'))), (r) => r.cost);
    const manStore = man(mo, 'STORE');
    return apiStore || manStore;
  };
  // MDF 지원금: 대시보드 시트 업로드(D.manual) 또는 네이버 '(⭐)HPE_MDF' 캠페인 실데이터
  const mdfCost = (mo) => {
    const manMdf = man(mo, 'MDF');
    const apiMdf = sumBy(D.spend.filter((r) => r.month === mo && r.campaign.includes('MDF')), (r) => r.cost);
    return manMdf || apiMdf;
  };
  const curM = months[months.length - 1], pv = prevM(curM), upTo = +curM.slice(5);
  const ytd = (y) => sumBy(D.spend.filter((r) => r.month >= ym(y, 1) && r.month <= ym(y, upTo)), (r) => r.cost);
  const cpa = (mo) => { const c = sumBy(at(mo), (r) => r.conv); return c ? tot(mo) / c : 0; };
  const ing = curM === THIS_M ? ' <small class="muted">(진행 중)</small>' : '';
  $('kpiAds').innerHTML =
    kpiBox(`${mLabel(curM)} 광고비${ing}`, `${fmt(tot(curM))}원`, tot(curM), tot(pv), '전월') +
    kpiBox(`${Y}년 누적 (1~${upTo}월)`, `${fmt(ytd(Y))}원`, ytd(Y), ytd(Y - 1), '전년 동기') +
    kpiBox(`${mLabel(curM)} MDF 소진`, `${fmt(mdfCost(curM))}원`, mdfCost(curM), mdfCost(pv), '전월') +
    kpiBox(`${mLabel(curM)} 전환 1건당 광고비`, `${fmt(cpa(curM))}원`, cpa(curM), cpa(pv), '전월', true);

  const series = SERIES.map((s) => ({ ...s, raw: months.map((mo) => sumBy(at(mo).filter(s.f), (r) => r.cost)) })).filter((s) => s.raw.some((v) => v));
  const chartBox = $('chSpend');
  const chartCard = chartBox ? chartBox.closest('.card') : null;
  const isChart = ST.mode === 'chart';

  if (chartCard) chartCard.style.display = isChart ? '' : 'none';
  if ($('lgSpend')) $('lgSpend').hidden = !isChart;

  if (isChart) {
    renderChart('chSpend', 'lgSpend', months.map(mLabel), series.map((s) => ({ ...s, v: s.raw.map((v) => v / 1e4) })), '만원');
  }

  const lastY = (mo) => tot(ym(Y - 1, +mo.slice(5)));
  $('tbSpendDetail').innerHTML = `<table class="stk"><thead><tr><th>월</th>${series.map((s) => `<th class="n">${s.k}</th>`).join('')}<th class="n">합계</th><th class="n">MDF</th><th class="n">스토어</th><th class="n">전년 동월</th><th class="n">전년비</th></tr></thead><tbody>` +
    months.map((mo, i) => { const t = tot(mo), l = lastY(mo); return `<tr><td>${mLabel(mo)}</td>${series.map((s) => `<td class="n">${fmt(s.raw[i])}</td>`).join('')}<td class="n"><b>${fmt(t)}</b></td><td class="n">${fmt(mdfCost(mo))}</td><td class="n">${fmt(storeCost(mo))}</td><td class="n">${fmt(l)}</td><td class="n">${dspan(t, l)}</td></tr>`; }).join('') +
    `<tr class="grp"><td>합계</td>${series.map((s) => `<td class="n">${fmt(sumBy(s.raw, (v) => v))}</td>`).join('')}<td class="n">${fmt(sumBy(months, tot))}</td><td class="n">${fmt(sumBy(months, mdfCost))}</td><td class="n">${fmt(sumBy(months, storeCost))}</td><td class="n">${fmt(sumBy(months, lastY))}</td><td></td></tr></tbody></table><p class="muted small" style="margin-top:0.75rem">단위: 원 · 스토어는 네이버 쇼핑검색 API 자동 집계(또는 커머스 연동) · MDF는 업로드 시트 및 HPE_MDF 캠페인 기준</p>`;
}

/* ── 03 카테고리 효율 (Category Efficiency) ── */
function renderCatEfficiency() {
  const kpiEl = $('kpiCatEff');
  if (!kpiEl) return;
  const hasSpend = D.spend && D.spend.length > 0;
  if (!hasSpend) {
    kpiEl.innerHTML = '<div class="kpi"><div class="l">카테고리 데이터</div><div class="v">–</div><div class="d flat">데이터 연결 필요</div></div>';
    $('chCatEff').innerHTML = empty('취합된 광고비 데이터가 없습니다.');
    $('chCatCpa').innerHTML = empty('취합된 견적 데이터가 없습니다.');
    $('tbCatEfficiency').innerHTML = `<tbody><tr><td>${empty('취합된 데이터가 없습니다.')}</td></tr></tbody>`;
    return;
  }

  const allMonths = [...new Set(D.spend.map((r) => r.month))].sort();
  const curM = allMonths.filter((m) => m <= THIS_M).pop() || allMonths[allMonths.length - 1];
  const pv = prevM(curM);

  const rowsCur = D.spend.filter((r) => r.month === curM);
  const rowsPrev = D.spend.filter((r) => r.month === pv);
  const catSpendCur = catSum(rowsCur, (r) => r.cost);
  const catSpendPrev = catSum(rowsPrev, (r) => r.cost);
  const catClk = catSum(rowsCur, (r) => r.clk);
  const catConv = catSum(rowsCur, (r) => r.conv);

  const qOf = (mo, c) => D.quotes.filter((r) => r.month === mo && r.category === c).reduce((a, r) => a + r.count, 0);

  const allCatKeys = [...new Set([...Object.keys(catSpendCur), ...Object.keys(catSpendPrev)])].sort((a, b) => (catSpendCur[b] || 0) - (catSpendCur[a] || 0));
  const totSpend = sumBy(rowsCur, (r) => r.cost);
  const curQuotes = D.quotes.filter((r) => r.month === curM);
  const totQuotes = sumBy(curQuotes, (r) => r.count);

  const catData = allCatKeys.map((k) => {
    const cost = catSpendCur[k] || 0;
    const prevCost = catSpendPrev[k] || 0;
    const quotes = qOf(curM, k);
    const clk = catClk[k] || 0;
    const conv = catConv[k] || 0;
    const cpa = quotes > 0 ? cost / quotes : null;
    return { k, cost, prevCost, quotes, clk, conv, cpa, share: totSpend > 0 ? (cost / totSpend * 100) : 0 };
  });

  const topSpendCat = catData[0];
  const topQuoteCat = [...catData].sort((a, b) => b.quotes - a.quotes)[0];
  const validCpaCats = catData.filter((c) => c.cpa != null && c.quotes > 0).sort((a, b) => a.cpa - b.cpa);
  const bestCpaCat = validCpaCats[0];
  const avgCpa = totQuotes > 0 ? totSpend / totQuotes : 0;

  kpiEl.innerHTML =
    `<div class="kpi"><div class="l">최다 집행 카테고리</div><div class="v sm">${esc(topSpendCat?.k || '–')}</div><div class="s">${fmt(topSpendCat?.cost || 0)}원 (${(topSpendCat?.share || 0).toFixed(1)}%)</div></div>` +
    `<div class="kpi"><div class="l">최다 견적 카테고리</div><div class="v sm">${esc(topQuoteCat?.k || '–')}</div><div class="s">${fmt(topQuoteCat?.quotes || 0)}건 접수</div></div>` +
    `<div class="kpi"><div class="l">최고 효율 (최저 CPA)</div><div class="v sm">${esc(bestCpaCat?.k || '–')}</div><div class="s">${bestCpaCat ? `건당 ${fmt(bestCpaCat.cpa)}원` : '–'}</div></div>` +
    `<div class="kpi"><div class="l">${mLabel(curM)} 전체 평균 CPA</div><div class="v">${avgCpa ? fmt(avgCpa) + '원' : '–'}</div><div class="s">광고비 ${fmt(totSpend)}원 / ${totQuotes}건</div></div>`;

  // 카테고리 바 차트
  const top7 = allCatKeys.slice(0, 7), rest = allCatKeys.slice(7);
  const list = top7.map((k) => ({ k, cur: (catSpendCur[k] || 0) / 1e4, prev: (catSpendPrev[k] || 0) / 1e4, q: qOf(curM, k) }));
  if (rest.length) list.push({ k: `기타 ${rest.length}개`, cur: sumBy(rest, (k) => catSpendCur[k] || 0) / 1e4, prev: sumBy(rest, (k) => catSpendPrev[k] || 0) / 1e4, q: sumBy(rest, (k) => qOf(curM, k)) });

  $('ttCatEff').innerHTML = `카테고리별 광고비 소진 비교 <span class="muted">(${mLabel(curM)} vs ${mLabel(pv)} · 만원)</span>`;
  catChart('chCatEff', list);

  // CPA 랭킹 리스트
  $('ttCatCpa').innerHTML = `카테고리별 견적 획득 단가 (CPA) <span class="muted">(${mLabel(curM)} 실적 기준)</span>`;
  if (validCpaCats.length) {
    const maxCpa = Math.max(...validCpaCats.map((c) => c.cpa), 1);
    $('chCatCpa').innerHTML = `<div class="cpa-list">` +
      validCpaCats.map((c) => `
        <div class="cpa-row">
          <div class="cpa-name" title="${esc(c.k)}">${esc(c.k)}</div>
          <div class="cpa-track"><div class="cpa-bar" style="width:${Math.max(5, Math.round(c.cpa / maxCpa * 100))}%"></div></div>
          <div class="cpa-info">
            <span class="cpa-val">${fmt(c.cpa)}원</span>
            <span class="cpa-badge">${c.quotes}건 견적</span>
          </div>
        </div>
      `).join('') + `</div>`;
  } else {
    $('chCatCpa').innerHTML = empty('기준월의 견적 접수 데이터가 없어 CPA를 산출할 수 없습니다.');
  }

  // 상세 테이블
  $('ttCatTable').innerHTML = `카테고리별 집행 성과 및 전환 효율 상세 <span class="muted">(${mLabel(curM)} 기준)</span>`;
  const totClk = sumBy(rowsCur, (r) => r.clk);
  const totConv = sumBy(rowsCur, (r) => r.conv);

  $('tbCatEfficiency').innerHTML =
    `<thead><tr><th>카테고리</th><th class="n">광고비</th><th class="n">비중</th><th class="n">클릭수</th><th class="n">광고전환</th><th class="n">접수견적</th><th class="n">견적전환율</th><th class="n">건당 광고비 (CPA)</th></tr></thead><tbody>` +
    catData.map((c) => {
      const convRate = c.clk > 0 ? (c.quotes / c.clk * 100).toFixed(2) + '%' : '–';
      return `<tr><td><b>${esc(c.k)}</b></td><td class="n">${fmt(c.cost)}원</td><td class="n">${c.share.toFixed(1)}%</td><td class="n">${fmt(c.clk)}</td><td class="n">${fmt(c.conv)}</td><td class="n"><b>${c.quotes ? fmt(c.quotes) + '건' : '–'}</b></td><td class="n">${convRate}</td><td class="n"><b>${c.cpa != null ? fmt(c.cpa) + '원' : '–'}</b></td></tr>`;
    }).join('') +
    `<tr class="grp"><td>합계</td><td class="n">${fmt(totSpend)}원</td><td class="n">100.0%</td><td class="n">${fmt(totClk)}</td><td class="n">${fmt(totConv)}</td><td class="n"><b>${fmt(totQuotes)}건</b></td><td class="n">${totClk > 0 ? (totQuotes / totClk * 100).toFixed(2) + '%' : '–'}</td><td class="n"><b>${avgCpa ? fmt(avgCpa) + '원' : '–'}</b></td></tr></tbody>`;
}

/* ── 04 키워드 · 소재 (Keywords & Creatives) ── */
function renderKw() {
  syncSeg();
  const pass = (r) => (ST.media === 'all' || r.media === ST.media) && r.type === ST.type;
  const pill = (m) => `<span class="pill ${m === 'Google' ? 'g' : m === 'Naver' ? 'n' : 'm'}">${m}</span>`;

  // 카테고리별 전환·소진 (데이터가 있는 마지막 달)
  const ms = [...new Set(D.spend.map((r) => r.month))].sort(), mo = ms.filter((m) => m <= THIS_M).pop() || ms[ms.length - 1];
  const rows = D.spend.filter((r) => r.month === mo && pass(r));
  const cost = catSum(rows, (r) => r.cost), clk = catSum(rows, (r) => r.clk), conv = catSum(rows, (r) => r.conv);
  const ck = Object.keys(cost).sort((a, b) => cost[b] - cost[a]);
  const noCatMsg = ST.type === 'DA'
    ? '수집된 디스플레이 광고(DA) 데이터가 없습니다.<br><small class="muted">GFA 무인 스케줄러 동기화 후 자동 집계됩니다.</small>'
    : (ST.media === 'Google' ? '수집된 Google 검색광고 데이터가 없습니다.<br><small class="muted">스크립트 실행 후 데이터가 집계됩니다.</small>' : '조회 조건에 해당하는 광고 데이터가 없습니다.');
  $('tbCatConv').innerHTML = ck.length ? '<thead><tr><th>카테고리</th><th class="n">광고비</th><th class="n">클릭</th><th class="n">전환</th><th class="n">전환당 비용</th></tr></thead><tbody>' +
    ck.map((k) => `<tr><td>${esc(k)}</td><td class="n">${fmt(cost[k])}원</td><td class="n">${fmt(clk[k])}</td><td class="n">${fmt(conv[k])}</td><td class="n">${conv[k] ? fmt(cost[k] / conv[k]) + '원' : '–'}</td></tr>`).join('') + '</tbody>'
    : `<tbody><tr><td>${empty(noCatMsg)}</td></tr></tbody>`;

  // 키워드 (SA만)
  if (ST.type === 'DA') {
    $('ttKw').textContent = '키워드';
    $('tbKw').innerHTML = `<tbody><tr><td>${empty('디스플레이 광고(DA)는 키워드 입찰을 진행하지 않습니다.<br><small class="muted">타겟팅 배너로 운영되어 키워드 목록이 없습니다.</small>')}</td></tr></tbody>`;
  } else {
    const ks = D.keywords.filter(pass), groups = {};
    ks.forEach((k) => { const g = [k.media, k.campaign, k.adgroup].join('\u0001'); (groups[g] = groups[g] || { media: k.media, campaign: k.campaign, adgroup: k.adgroup, cost: 0, list: [] }).list.push(k); groups[g].cost += k.cost; });
    const gs = Object.values(groups).sort((a, b) => b.cost - a.cost).slice(0, 10);
    $('ttKw').innerHTML = `키워드 <span class="muted">최근 30일 · 광고비 상위 광고그룹 ${gs.length}개, 그룹당 상위 10개</span>`;
    const noKwMsg = ST.media === 'Google'
      ? '수집된 Google 검색광고 키워드가 없습니다.<br><small class="muted">Google Ads 스크립트 실행 후 자동 수집됩니다.</small>'
      : '조회 조건에 해당하는 키워드가 없습니다.';
    $('tbKw').innerHTML = '<thead><tr><th>캠페인 › 광고그룹 / 키워드</th><th class="n">현재 입찰가</th><th>품질</th><th class="n">노출</th><th class="n">클릭</th><th class="n">CTR</th><th class="n">전환</th><th class="n">광고비</th></tr></thead><tbody>' +
      (gs.length ? gs.map((g) => `<tr class="grp"><td colspan="8">${pill(g.media)} ${esc(g.campaign)} › ${esc(g.adgroup)}</td></tr>` +
        g.list.sort((a, b) => b.cost - a.cost || b.clk - a.clk).slice(0, 10).map((k) => {
          const max = k.media === 'Naver' ? 7 : 10, q = Array.from({ length: max }, (_, i) => `<i class="${i < k.quality ? 'on' : ''}"></i>`).join('');
          return `<tr><td class="ind">${esc(k.keyword)}</td><td class="n">${fmt(k.bid)}원</td><td>${k.quality ? `<span class="qs-bar" data-tip="품질${k.media === 'Naver' ? '지수' : '점수'}|${k.quality} / ${max}">${q}</span>${k.quality}` : '<span class="muted">–</span>'}</td>` +
            `<td class="n">${fmt(k.imp)}</td><td class="n">${fmt(k.clk)}</td><td class="n">${k.imp ? (k.clk / k.imp * 100).toFixed(1) + '%' : '–'}</td><td class="n">${fmt(k.conv)}</td><td class="n">${fmt(k.cost)}원</td></tr>`;
        }).join('')).join('') : `<tr><td colspan="8">${empty(noKwMsg)}</td></tr>`) + '</tbody>';
  }

  // 소재
  const imageMap = {
    cad: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=80', // CAD 도면 설계
    ai: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80', // AMD 프로세서 / AI
    ups: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80', // APC 전원 / UPS 하드웨어
    ha: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80', // 이중화 / 클라우드 망
    lease: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80', // 기업 IT 리스 / 오피스
    monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80', // 모니터 디스플레이
    mobileWs: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop&q=80', // 모바일 워크스테이션 랩탑
    desktopWs: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80', // 타워 데스크탑 워크스테이션
    laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80', // 비즈니스 노트북
    desktop: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=600&auto=format&fit=crop&q=80', // 데스크탑 PC 세트
    server: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80', // 랙마운트 서버 캐비닛
    storage: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80' // 스토리지 패치패널
  };

  const backupPool = [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&auto=format&fit=crop&q=80'
  ];

  function getCreativeImage(c, usedImgs) {
    if (c.image && c.image.trim()) {
      if (!usedImgs.has(c.image)) {
        usedImgs.add(c.image);
        return c.image;
      }
    }
    const text = `${c.campaign || ''} ${c.adgroup || ''} ${c.title || ''}`.toLowerCase();
    let img = '';
    if (/gstarcad|cad|캐드|도면/i.test(text)) img = imageMap.cad;
    else if (/data\s*science|데이터사이언스|gpu|딥러닝|머신러닝|인공지능|ai/i.test(text)) img = imageMap.ai;
    else if (/ups|apc|무정전|전원/i.test(text)) img = imageMap.ups;
    else if (/이중화|솔루션|solution|roseha|ha/i.test(text)) img = imageMap.ha;
    else if (/리스|렌탈|lease|rental/i.test(text)) img = imageMap.lease;
    else if (/모니터|monitor|display/i.test(text)) img = imageMap.monitor;
    else if (/모바일\s*워크스테이션|mobile\s*workstation|zbook/i.test(text)) img = imageMap.mobileWs;
    else if (/워크스테이션|workstation|z1|z2|z4|z6|z8/i.test(text)) img = imageMap.desktopWs;
    else if (/노트북|laptop/i.test(text)) img = imageMap.laptop;
    else if (/데스크탑|desktop|엘리트데스크|프로데스크|\bpc\b/i.test(text)) img = imageMap.desktop;
    else if (/서버|server|proliant|poweredge|랙|rack|\bdl\d|\bml\d/i.test(text)) img = imageMap.server;
    else if (/스토리지|storage|\bnas\b|\bsan\b|\bdas\b|시놀로지|synology|netapp|백업/i.test(text)) img = imageMap.storage;
    else img = imageMap.server;

    if (usedImgs.has(img)) {
      for (const b of backupPool) {
        if (!usedImgs.has(b)) {
          img = b;
          break;
        }
      }
    }
    usedImgs.add(img);
    return img;
  }

  // 특정 한 캠페인만 12개가 독점하지 않도록 캠페인별 라운드로빈으로 다양하게 12개 추출
  const filteredAds = D.ads.filter(pass);
  const byCamp = {};
  filteredAds.forEach((a) => {
    const k = a.campaign || '기타';
    if (!byCamp[k]) byCamp[k] = [];
    byCamp[k].push(a);
  });
  const campKeys = Object.keys(byCamp);
  const ads = [];
  let roundIdx = 0;
  while (ads.length < 12 && campKeys.some((k) => byCamp[k].length > 0)) {
    const k = campKeys[roundIdx % campKeys.length];
    if (byCamp[k].length > 0) {
      ads.push(byCamp[k].shift());
    }
    roundIdx++;
  }

  const colors = { Google: '--c-g', Naver: '--c-n', Meta: '--c-m' };
  const noAdMsg = ST.media === 'Google'
    ? '수집된 Google 광고 소재가 없습니다.<br><small class="muted">Google Ads 스크립트 실행 후 자동 수집됩니다.</small>'
    : (ST.type === 'DA' ? '수집된 디스플레이 광고(DA) 배너 소재가 없습니다.<br><small class="muted">GFA 무인 스케줄러 동기화 후 자동 표시됩니다.</small>' : '조회 조건에 해당하는 소재가 없습니다.');
  const usedImgs = new Set();
  $('creatives').innerHTML = ads.length ? ads.map((c) => {
    const imgUrl = getCreativeImage(c, usedImgs);
    const title = (c.title && c.title !== 'RSA_AD' && c.title !== 'TEXT_45' ? c.title : `${c.campaign} · ${c.adgroup}`) || '파워링크 검색광고';
    return `<div class="cr"><div class="img" style="background:var(${colors[c.media] || '--c-it'})">${imgUrl ? `<img src="${esc(imgUrl)}" alt="${esc(title)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.remove();">` : `${esc(title)}<small>${c.type === 'SA' ? '텍스트 광고' : '이미지 없음'}</small>`}</div>` +
      `<div class="meta"><b>${esc(title)}</b>${c.media} ${c.type} · ${esc(c.campaign)} › ${esc(c.adgroup)}<br>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a>` : ''}</div></div>`;
  }).join('')
    : empty(noAdMsg);
}

/* ── 05 견적 상세 (Quotes) ── */
function renderQuotes() {
  const kpiEl = $('kpiQuotes');
  const quotes = D.quotes || [];
  if (!quotes.length) {
    if (kpiEl) kpiEl.innerHTML = '<div class="kpi"><div class="l">견적 데이터</div><div class="v">–</div><div class="d flat">데이터 연결 필요</div></div>';
    if ($('lgQuote')) $('lgQuote').innerHTML = '';
    $('chQuote').innerHTML = empty('취합된 실제 견적 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요.');
    $('chSrc').innerHTML = empty('취합된 실제 유입 매체 데이터가 없습니다.');
    $('tbQuotesSummary').innerHTML = empty('취합된 실제 견적 데이터가 없습니다.');
    return;
  }

  const last = quotes.reduce((m, r) => (r.month > m ? r.month : m), '');
  const yr = last.slice(0, 4), mm = +last.slice(5, 7);
  const curM = `${yr}-${String(mm).padStart(2, '0')}`;
  const pv = prevM(curM);
  const labels = Array.from({ length: mm }, (_, i) => `${i + 1}월`);
  const months = Array.from({ length: mm }, (_, i) => ym(yr, i + 1));
  const cats = ['서버', '워크스테이션', '스토리지', 'PC·노트북', '기타'];
  const colors = ['--c-it', '--c-g', '--c-m', '--c-etc', '--c-n'];

  const cnt = (mo, k) => quotes.filter((r) => r.month === mo && r.category === k).reduce((a, r) => a + r.count, 0);
  const totM = (mo) => quotes.filter((r) => r.month === mo).reduce((a, r) => a + r.count, 0);
  const curTot = totM(curM), pvTot = totM(pv);
  const ytdQuotes = sumBy(quotes.filter((r) => r.month.startsWith(yr)), (r) => r.count);

  // 1위 매체 & 1위 카테고리
  const bySrcAll = {};
  quotes.filter((r) => r.month.startsWith(yr) && r.source !== '미수집').forEach((r) => { bySrcAll[r.source] = (bySrcAll[r.source] || 0) + r.count; });
  const topSrcKey = Object.keys(bySrcAll).sort((a, b) => bySrcAll[b] - bySrcAll[a])[0] || '–';

  const catCounts = cats.map((k) => ({ k, c: quotes.filter((r) => r.month.startsWith(yr) && r.category === k).reduce((a, r) => a + r.count, 0) })).sort((a, b) => b.c - a.c);
  const topCat = catCounts[0];

  if (kpiEl) {
    kpiEl.innerHTML =
      kpiBox(`${mLabel(curM)} 접수 견적`, `${fmt(curTot)}건`, curTot, pvTot, '전월') +
      `<div class="kpi"><div class="l">${yr}년 누적 견적 (1~${mm}월)</div><div class="v">${fmt(ytdQuotes)}건</div><div class="s">쇼핑몰·전화 직영 유입</div></div>` +
      `<div class="kpi"><div class="l">${yr}년 최다 유입 매체</div><div class="v sm">${esc(topSrcKey)}</div><div class="s">${bySrcAll[topSrcKey] ? fmt(bySrcAll[topSrcKey]) + '건 접수' : '집계 중'}</div></div>` +
      `<div class="kpi"><div class="l">${yr}년 최다 견적 카테고리</div><div class="v sm">${esc(topCat?.k || '–')}</div><div class="s">${fmt(topCat?.c || 0)}건 (${ytdQuotes > 0 ? (topCat.c / ytdQuotes * 100).toFixed(1) : 0}%)</div></div>`;
  }

  // 월별 견적 추이 차트
  const series = cats.map((k, ci) => ({ k, c: colors[ci], v: labels.map((_, i) => cnt(`${yr}-${String(i + 1).padStart(2, '0')}`, k)) })).filter((s) => s.v.some((x) => x));
  renderChart('chQuote', 'lgQuote', labels, series, '건');

  // 유입 매체 비중 도넛
  const tot = Object.values(bySrcAll).reduce((a, b) => a + b, 0);
  const sc = { Naver: '--c-n', Google: '--c-g', Meta: '--c-m', '직접·기타': '--sub' };
  const src = tot ? Object.keys(bySrcAll).sort((a, b) => bySrcAll[b] - bySrcAll[a]).map((k) => ({ k, c: sc[k] || '--sub', v: Math.round((bySrcAll[k] / tot) * 100) })) : [];
  renderDonut('chSrc', src);

  // 견적 집계 상세 테이블
  const lastYQuote = (mo) => totM(ym(+yr - 1, +mo.slice(5)));
  $('tbQuotesSummary').innerHTML = `<table class="stk"><thead><tr><th>월</th>${cats.map((c) => `<th class="n">${c}</th>`).join('')}<th class="n">합계</th><th class="n">전년 동월</th><th class="n">전년비</th></tr></thead><tbody>` +
    months.map((mo) => {
      const t = totM(mo), l = lastYQuote(mo);
      return `<tr><td>${mLabel(mo)}</td>${cats.map((c) => `<td class="n">${fmt(cnt(mo, c))}</td>`).join('')}<td class="n"><b>${fmt(t)}</b></td><td class="n">${fmt(l)}</td><td class="n">${dspan(t, l)}</td></tr>`;
    }).join('') +
    `<tr class="grp"><td>합계</td>${cats.map((c) => `<td class="n">${fmt(sumBy(months, (mo) => cnt(mo, c)))}</td>`).join('')}<td class="n"><b>${fmt(sumBy(months, totM))}</b></td><td class="n">${fmt(sumBy(months, lastYQuote))}</td><td></td></tr></tbody></table>`;
}

function renderDataView() {
  const c = getCfg();
  if ($('dataViewUrl')) $('dataViewUrl').textContent = c.url || DEFAULT_URL;
  if ($('dataViewBadge')) {
    $('dataViewBadge').textContent = STATUS === 'live' ? '정상 연동 중 (상시 자동)' : (STATUS === 'error' ? '동기화 지연' : '연결 중...');
    $('dataViewBadge').className = 'pill ' + (STATUS === 'live' ? 'g' : (STATUS === 'error' ? 'm' : ''));
  }
  if ($('dataViewUpdated')) {
    $('dataViewUpdated').textContent = D.updated ? `마지막 데이터 수집: ${D.updated} (10분 주기 무인 동기화)` : '데이터 동기화 대기 중...';
  }
  if ($('dataViewStats')) {
    $('dataViewStats').innerHTML = `네이버 광고 <b>${fmt(D.spend.length)}</b>행 · 키워드 <b>${fmt(D.keywords.length)}</b>개 · 견적 <b>${fmt(D.quotes.length)}</b>건 (0초 SWR 캐시 활성)`;
  }
}

function render() {
  if (cur === 'overview') renderOverview();
  else if (cur === 'ads') renderAds();
  else if (cur === 'cat-efficiency') renderCatEfficiency();
  else if (cur === 'keywords') renderKw();
  else if (cur === 'quotes') renderQuotes();
  else if (cur === 'data') renderDataView();
}

let rt;
addEventListener('resize', () => { if (innerWidth > 768) drawer(false); clearTimeout(rt); rt = setTimeout(render, 120); });
$('theme').setAttribute('aria-checked', isDark());
addEventListener('hashchange', () => { if (location.hash.slice(1) !== cur) go(location.hash.slice(1)); });
// 1. 로컬 캐시에서 실데이터 즉시 복원 (0초 렌더링)
const restored = restoreFromCache();
buildMap(); status();
go(location.hash.slice(1));

// 2. 만약 캐시가 없으면(첫 방문/시크릿 창), 로컬 백업(data/latest.json) 즉시 조회 (5ms)
if (!restored) {
  fetch('data/latest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((localJ) => {
      if (localJ && STATUS !== 'live') {
        D = fromApi(localJ);
        STATUS = 'live';
        try { localStorage.setItem('adi_data_cache', JSON.stringify(localJ)); } catch (e) {}
        buildMap(); status(); render();
        console.log('[its-ad-insight] 로컬 백업(data/latest.json)에서 실데이터 즉시 렌더링 완료');
      }
    })
    .catch(() => {})
    .finally(() => {
      // 3. 백그라운드에서 Google Apps Script 최신 동기화 실행
      load();
    });
} else {
  // 캐시로 이미 화면이 즉시 표시된 상태에서 백그라운드 최신 동기화 실행
  load();
}
setInterval(load, 10 * 60 * 1000);
