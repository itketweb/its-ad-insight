/**
 * its-ad-insight — 네이버 검색광고 수집 + 대시보드용 웹앱 (Google Apps Script, 데이터 시트에 연결)
 *
 * script.google.com 에서 새 프로젝트(데이터 시트와 같은 구글 계정)에 붙여넣는다. 시트는 SHEET_ID 로 연다.
 *  - setup        : 처음 한 번. 관리용 시트(mapping·manual)와 웹앱 비밀키를 만들고, 1시간마다 collectNaver 를 예약한다.
 *  - collectNaver : 네이버 검색광고 API → n_adgroup_monthly · n_keywords · n_ads (당월·전월은 매번, 과거 월은 비어 있을 때만)
 *  - doGet        : ?key=비밀키 로 부르면 시트 전체를 JSON 으로 내려준다 (대시보드가 읽음). 키가 틀리면 아무것도 주지 않는다.
 * 네이버 키는 코드에 쓰지 않는다 — 프로젝트 설정 → 스크립트 속성에 NAVER_API_KEY · NAVER_SECRET · NAVER_CUSTOMER_ID 로 넣는다.
 * Google Ads 데이터(g_*)는 Google Ads 스크립트(GoogleAdsScript.js)가 같은 시트에 쓴다.
 */
const CFG = {
  SHEET_ID: '1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg', // its-ad-insight 데이터 시트 (주소의 /d/ 와 /edit 사이)
  FROM_YEAR: new Date().getFullYear() - 1,   // 전년 1월부터
  BASE: 'https://api.searchad.naver.com',
  CHUNK: 50,                                 // /stats 한 번에 묻는 ID 수
  BUDGET_MS: 4.5 * 60 * 1000,                // 한 번 실행에 쓸 최대 시간(6분 제한 대비)
  SHEETS: ['g_campaign_monthly', 'g_adgroup_monthly', 'g_keywords', 'g_ads', 'g_meta',
    'n_adgroup_monthly', 'n_keywords', 'n_ads', 'n_meta', 'quotes_monthly', 'quotes_raw', 'q_meta', 'mapping', 'manual'],
};
const PROPS = PropertiesService.getScriptProperties();
const STAT_FIELDS = '["impCnt","clkCnt","salesAmt","ccnt"]';

/* ── 처음 한 번 ── */
function setup() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  if (!ss.getSheetByName('mapping')) put_(ss, 'mapping', [['media', 'campaign', 'ad_group', 'category', 'ratio']]);
  if (!ss.getSheetByName('manual')) put_(ss, 'manual', [['month', 'item', 'amount', 'memo'], ['2026-01', 'MDF', 0, '예시 — MDF / META / STORE 중 하나']]);
  if (!ss.getSheetByName('quotes_raw')) put_(ss, 'quotes_raw', [['date', 'site', 'subject', 'category', 'source', 'created_at']]);
  if (!PROPS.getProperty('API_TOKEN')) PROPS.setProperty('API_TOKEN', Utilities.getUuid().replace(/-/g, ''));
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'collectNaver').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectNaver').timeBased().everyHours(1).create();
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'collectGfaEmail').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectGfaEmail').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'collectCommerce').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectCommerce').timeBased().everyDays(1).atHour(6).create();
  if (PROPS.getProperty('QUOTE_SHEET_ID')) {
    ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'collectQuotes').forEach((t) => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('collectQuotes').timeBased().everyHours(1).create();
  }
  console.log('웹앱 비밀키(대시보드 js/config.js 의 key): ' + PROPS.getProperty('API_TOKEN'));
}

/* ── 네이버 검색광고 수집 ── */
function collectNaver() {
  ['NAVER_API_KEY', 'NAVER_SECRET', 'NAVER_CUSTOMER_ID'].forEach((k) => { if (!PROPS.getProperty(k)) throw new Error('스크립트 속성에 ' + k + ' 가 없습니다'); });
  const t0 = Date.now(), ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const camps = api_('GET', '/ncc/campaigns');
  // 캠페인 단위 확장소재 이미지 캐싱 (파워링크 캠페인 공통 이미지 확장소재)
  const campExtImgs = {};
  camps.forEach((c) => {
    try {
      const exts = api_('GET', '/ncc/ad-extensions', { ownerId: c.nccCampaignId });
      for (const ex of (exts || [])) {
        if (ex.userLock) continue;
        const u = extractExtImage_(ex);
        if (u) { campExtImgs[c.nccCampaignId] = u; break; }
      }
    } catch (_) {}
  });

  const groups = [];
  camps.forEach((c) => api_('GET', '/ncc/adgroups', { nccCampaignId: c.nccCampaignId })
    .forEach((g) => groups.push({ id: g.nccAdgroupId, name: g.name, bid: g.bidAmt, campaign: c.name, ctype: c.campaignTp, campaignId: c.nccCampaignId })));
  const gById = Object.fromEntries(groups.map((g) => [g.id, g]));

  // 월별: 당월·전월은 매번 다시, 그 이전은 시트에 없는 달만 채운다
  const head = ['month', 'type', 'campaign', 'campaign_tp', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions'];
  const old = read_(ss, 'n_adgroup_monthly');
  const thisM = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const fresh = [thisM, addMonth_(thisM, -1)];
  const have = new Set(old.map((r) => r.month));
  const want = [];
  for (let m = CFG.FROM_YEAR + '-01'; m <= thisM; m = addMonth_(m, 1)) if (fresh.includes(m) || !have.has(m)) want.push(m);
  const keep = old.filter((r) => !want.includes(r.month)).map((r) => head.map((h) => r[h]));
  const rows = [];
  for (const m of want) {
    if (Date.now() - t0 > CFG.BUDGET_MS) break; // 남은 달은 다음 실행에서
    stats_(groups.map((g) => g.id), m + '-01', lastDay_(m)).forEach((s) => {
      const g = gById[s.id];
      if (g && (s.salesAmt || s.impCnt)) rows.push([m, 'SA', g.campaign, g.ctype, g.name, g.id, s.salesAmt || 0, s.impCnt || 0, s.clkCnt || 0, s.ccnt || 0]);
    });
  }
  put_(ss, 'n_adgroup_monthly', [head].concat(keep.concat(rows).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));

  // 키워드·소재: 사용 중인 것의 현재 상태 + 최근 30일 성과
  const until = Utilities.formatDate(new Date(Date.now() - 864e5), 'Asia/Seoul', 'yyyy-MM-dd');
  const since = Utilities.formatDate(new Date(Date.now() - 30 * 864e5), 'Asia/Seoul', 'yyyy-MM-dd');
  const kws = [], ads = [['type', 'campaign', 'ad_group', 'ad_id', 'ad_type', 'title', 'url', 'image']];
  for (const g of groups) {
    if (Date.now() - t0 > CFG.BUDGET_MS) break;
    // 확장소재 이미지 조회 (광고그룹 단위 우선, 없으면 캠페인 단위 상속)
    let grpExtImg = '';
    try {
      const exts = api_('GET', '/ncc/ad-extensions', { ownerId: g.id });
      for (const ex of (exts || [])) {
        if (ex.userLock) continue;
        const u = extractExtImage_(ex);
        if (u) { grpExtImg = u; break; }
      }
    } catch (_) {}
    const finalExtImg = grpExtImg || campExtImgs[g.campaignId] || '';

    api_('GET', '/ncc/keywords', { nccAdgroupId: g.id }).filter((k) => !k.userLock)
      .forEach((k) => kws.push({ id: k.nccKeywordId, g, keyword: k.keyword, bid: k.useGroupBidAmt ? g.bid : k.bidAmt, qi: (k.nccQi && k.nccQi.qiGrade) || '' }));
    api_('GET', '/ncc/ads', { nccAdgroupId: g.id }).filter((a) => !a.userLock).forEach((a) => {
      const ad = a.ad || {};
      const imgUrl = extractAdImage_(ad) || finalExtImg || '';
      const title = ad.headline || (a.assets && a.assets[0] && a.assets[0].assetData && a.assets[0].assetData.text) || a.name || '';
      ads.push(['SA', g.campaign, g.name, a.nccAdId, a.type, title, (ad.pc && ad.pc.final) || (ad.mobile && ad.mobile.final) || '', imgUrl]);
    });
  }
  const ks = Object.fromEntries(stats_(kws.map((k) => k.id), since, until).map((s) => [s.id, s]));
  put_(ss, 'n_keywords', [['type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions']]
    .concat(kws.map((k) => { const s = ks[k.id] || {}; return ['SA', k.g.campaign, k.g.name, k.keyword, '', k.bid || 0, k.qi, s.salesAmt || 0, s.impCnt || 0, s.clkCnt || 0, s.ccnt || 0]; })));
  put_(ss, 'n_ads', ads);
  put_(ss, 'n_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')], ['customer_id', PROPS.getProperty('NAVER_CUSTOMER_ID')]]);
  syncMapping_(ss);
}

/** 새로 생긴 캠페인·광고그룹을 mapping 시트에 빈 카테고리로 추가한다 (관리자가 채움). */
function syncMapping_(ss) {
  const sh = ss.getSheetByName('mapping');
  if (!sh) return;
  const key = (r) => [r.media, r.campaign, r.ad_group].join('\u0001');
  const have = new Set(read_(ss, 'mapping').map(key));
  const add = [];
  [['Google', 'g_adgroup_monthly'], ['Naver', 'n_adgroup_monthly']].forEach(([media, name]) => read_(ss, name).forEach((r) => {
    const k = key({ media, campaign: r.campaign, ad_group: r.ad_group });
    if (!have.has(k)) { have.add(k); add.push([media, r.campaign, r.ad_group, '', 100]); }
  }));
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 5).setValues(add);
}

/* ── 네이버 성과형 DA(GFA) 이메일 보고서 자동 수집 ──
 * 네이버 GFA 관리자에서 매일 새벽 발송되는 맞춤 보고서 CSV 이메일을 읽어 n_adgroup_monthly 에 type='DA' 로 적재한다.
 * 사용자가 엑셀을 내려받거나 업로드할 필요가 없다.
 * 스크립트 속성: GFA_EMAIL_QUERY (옵션, 기본값: 'subject:(성과형 OR GFA OR "디스플레이 광고") has:attachment filename:csv') */
function collectGfaEmail() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const q = PROPS.getProperty('GFA_EMAIL_QUERY') || 'subject:(성과형 OR GFA OR "디스플레이 광고") has:attachment filename:csv';
  const threads = GmailApp.search(q, 0, 10);
  if (!threads.length) {
    console.log('새로운 GFA 리포트 이메일이 없습니다 (검색 쿼리: ' + q + ')');
    return;
  }
  let label = GmailApp.getUserLabelByName('GFA_PROCESSED');
  if (!label) label = GmailApp.createLabel('GFA_PROCESSED');

  const rowsDA = [];
  threads.forEach((th) => {
    const labels = th.getLabels().map((l) => l.getName());
    if (labels.includes('GFA_PROCESSED')) return;

    th.getMessages().forEach((msg) => {
      msg.getAttachments().forEach((att) => {
        if (!att.getName().toLowerCase().endsWith('.csv')) return;
        let csvStr = '';
        try { csvStr = att.getDataAsString('UTF-8'); } catch (e) { csvStr = att.getDataAsString('EUC-KR'); }
        if (!csvStr) return;
        const parsed = Utilities.parseCsv(csvStr);
        if (parsed.length < 2) return;

        const h = parsed.shift().map((x) => String(x).trim().replace(/\s+/g, ''));
        const iDate = h.findIndex((c) => /일자|날짜|date|일시/i.test(c));
        const iCamp = h.findIndex((c) => /캠페인|campaign/i.test(c));
        const iGrp = h.findIndex((c) => /광고그룹|adgroup|그룹/i.test(c));
        const iCost = h.findIndex((c) => /비용|소진|cost|spend|금액/i.test(c));
        const iImp = h.findIndex((c) => /노출|imp/i.test(c));
        const iClk = h.findIndex((c) => /클릭|clk|click/i.test(c));
        const iConv = h.findIndex((c) => /전환|conv/i.test(c));

        parsed.forEach((r) => {
          const rawDate = iDate >= 0 ? r[iDate] : '';
          const m = quoteMonth_(rawDate) || Utilities.formatDate(msg.getDate(), 'Asia/Seoul', 'yyyy-MM');
          const camp = iCamp >= 0 && r[iCamp] ? String(r[iCamp]).trim() : 'GFA_캠페인';
          const grp = iGrp >= 0 && r[iGrp] ? String(r[iGrp]).trim() : 'GFA_그룹';
          const cost = iCost >= 0 ? Number(String(r[iCost]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const imp = iImp >= 0 ? Number(String(r[iImp]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const clk = iClk >= 0 ? Number(String(r[iClk]).replace(/[^0-9.-]/g, '')) || 0 : 0;
          const conv = iConv >= 0 ? Number(String(r[iConv]).replace(/[^0-9.-]/g, '')) || 0 : 0;

          if (cost > 0 || imp > 0 || clk > 0) {
            rowsDA.push({ month: m, type: 'DA', campaign: camp, campaign_tp: 'GFA', ad_group: grp, ad_group_id: '', cost, impressions: imp, clicks: clk, conversions: conv });
          }
        });
      });
    });
    th.addLabel(label);
  });

  if (!rowsDA.length) return;

  const head = ['month', 'type', 'campaign', 'campaign_tp', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions'];
  const old = read_(ss, 'n_adgroup_monthly');
  const newKeys = new Set(rowsDA.map((r) => [r.month, r.campaign, r.ad_group].join('\u0001')));
  const keep = old.filter((r) => r.type === 'SA' || !newKeys.has([r.month, r.campaign, r.ad_group].join('\u0001'))).map((r) => head.map((h) => r[h]));
  const toAdd = rowsDA.map((r) => head.map((h) => r[h]));

  put_(ss, 'n_adgroup_monthly', [head].concat(keep.concat(toAdd).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  syncMapping_(ss);
  console.log('GFA 리포트 이메일 자동 파싱 완료: ' + rowsDA.length + '행 반영');
}

/* ── 견적 집계 ──
 * 아이티켓 쇼핑몰이 견적 접수 때마다 구글 시트(견적요청 리스트)에 한 줄씩 쌓는다. 그 시트를 읽어 월·카테고리·유입경로별 건수만 만든다.
 * 스크립트 속성: QUOTE_SHEET_ID(견적 시트 ID, 필수), QUOTE_SHEET_TAB(탭 이름, 기본 '견적문의').
 * 이름·이메일·연락처는 읽지도 옮기지도 않는다 (제목·접수날짜·유입 경로 열만 사용). */
function collectQuotes() {
  const id = PROPS.getProperty('QUOTE_SHEET_ID');
  if (!id) throw new Error('스크립트 속성에 QUOTE_SHEET_ID 가 없습니다');
  const src = SpreadsheetApp.openById(id);
  const sh = src.getSheetByName(PROPS.getProperty('QUOTE_SHEET_TAB') || '견적문의') || src.getSheets()[0];
  const v = sh.getDataRange().getValues();
  const h = v.shift().map((x) => String(x).replace(/\s+/g, ''));
  const iSub = h.indexOf('제목'), iDate = h.indexOf('접수날짜'), iSrc = h.indexOf('유입경로');
  if (iSub < 0 || iDate < 0) throw new Error('견적 시트에 제목·접수날짜 열이 없습니다');
  const agg = {};
  v.forEach((r) => {
    const m = quoteMonth_(r[iDate]);
    if (!m) return;
    const k = [m, quoteCategory_(r[iSub]), iSrc < 0 ? '미수집' : quoteSource_(r[iSrc])].join('\u0001');
    agg[k] = (agg[k] || 0) + 1;
  });
  const rows = [['month', 'category', 'source', 'count']];
  Object.keys(agg).sort().forEach((k) => rows.push(k.split('\u0001').concat(agg[k])));
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  put_(ss, 'quotes_monthly', rows);
  put_(ss, 'q_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')], ['rows', v.length]]);
}
/** 접수날짜(날짜 또는 "2026-10-12 9:30:00" 글자) → "2026-10" */
function quoteMonth_(d) {
  if (d instanceof Date) return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM');
  const m = String(d || '').match(/^(\d{4})[-./](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}
/** 견적 제목 → 표준 카테고리. 위에서부터 먼저 맞는 규칙을 쓰고, 어디에도 없으면 '기타'. 규칙은 필요하면 여기서 고친다. */
function quoteCategory_(subject) {
  const t = String(subject || '').toLowerCase();
  const has = (re) => re.test(t);
  if (has(/스토리지|storage|\bnas\b|\bsan\b|백업|netapp|synology|qnap/)) return '스토리지';
  if (has(/서버|server|poweredge|proliant|\bdl\d|\bml\d|랙|rack/) && !has(/zbook/)) return '서버';
  if (has(/워크스테이션|workstation|z by hp|zbyhp|zbook|\bz[2-9]\b|딥러닝|머신러닝|gpu/)) return '워크스테이션';
  if (has(/노트북|laptop|데스크탑|데스크톱|desktop|\bpc\b|모니터|올인원/)) return 'PC·노트북';
  return '기타';
}
/** 유입 경로 열 → 매체. 비어 있으면(2026-10-12 이전) '미수집'. */
function quoteSource_(raw) {
  const t = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!t) return '미수집';
  if (/naver|네이버/.test(t)) return 'Naver';
  if (/google|구글|gclid/.test(t)) return 'Google';
  if (/meta|facebook|instagram|페이스북|인스타/.test(t)) return 'Meta';
  return '직접·기타';
}

/* ── 대시보드용 웹앱 ── */
function doGet(e) {
  const token = PROPS.getProperty('API_TOKEN');
  if (!token || !e || !e.parameter || e.parameter.key !== token) return json_({ error: 'unauthorized' });
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID), out = { served: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };
  CFG.SHEETS.forEach((n) => (out[n] = read_(ss, n)));
  return json_(out);
}

/* ── 견적 실시간 웹훅 수신 ──
 * 캐드코리아·ZbyHP·온코어 등 쇼핑몰에서 고객이 견적 제출 시 호출하여 구글 시트에 실시간 적재.
 * 엑셀 수동 다운로드/업로드가 필요 없다.
 * POST body (JSON): { key: "API_TOKEN", site: "cadkorea", date: "2026-10-15 14:00", subject: "...", source: "Naver" } */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw) return json_({ error: 'empty_body' });
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const token = PROPS.getProperty('API_TOKEN');
    if (!token || data.key !== token) return json_({ error: 'unauthorized' });

    const ss = SpreadsheetApp.openById(CFG.SHEET_ID);

    // [A] GFA 백그라운드 무인 스케줄러(Playwright) 데이터 수신
    if (data.action === 'syncGfa' && Array.isArray(data.rows)) {
      const head = ['month', 'type', 'campaign', 'campaign_tp', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions'];
      const old = read_(ss, 'n_adgroup_monthly');
      const newKeys = new Set(data.rows.map((r) => [r.month, r.campaign, r.ad_group].join('\u0001')));
      const keep = old.filter((r) => r.type === 'SA' || !newKeys.has([r.month, r.campaign, r.ad_group].join('\u0001'))).map((r) => head.map((h) => r[h]));
      const toAdd = data.rows.map((r) => [r.month, 'DA', r.campaign, 'GFA', r.ad_group, '', Number(r.cost) || 0, Number(r.impressions) || 0, Number(r.clicks) || 0, Number(r.conversions) || 0]);
      put_(ss, 'n_adgroup_monthly', [head].concat(keep.concat(toAdd).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
      syncMapping_(ss);
      return json_({ success: true, type: 'GFA', added: toAdd.length });
    }

    // [C] MDF / 수동 데이터 시트 업로드 수신
    if (data.action === 'uploadManual' && Array.isArray(data.rows)) {
      const head = ['month', 'item', 'amount', 'memo'];
      const old = read_(ss, 'manual');
      const targetItem = String(data.item || 'MDF').toUpperCase();
      const newMonths = new Set(data.rows.map((r) => String(r.month).slice(0, 7)));
      const keep = old.filter((r) => String(r.item).toUpperCase() !== targetItem || !newMonths.has(String(r.month).slice(0, 7))).map((r) => head.map((h) => r[h]));
      const toAdd = data.rows.map((r) => [String(r.month).slice(0, 7), targetItem, Number(r.amount) || 0, String(r.memo || '')]);
      put_(ss, 'manual', [head].concat(keep.concat(toAdd).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
      return json_({ success: true, item: targetItem, updated: toAdd.length });
    }

    // [D] 네이버 커머스(스마트스토어) API 즉시 동기화 호출
    if (data.action === 'syncCommerce') {
      const res = collectCommerce();
      return json_({ success: true, result: res });
    }

    // [B] 쇼핑몰 실시간 견적 접수 수신
    const dateStr = data.date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    const mo = quoteMonth_(dateStr);
    const site = String(data.site || '기타');
    const subj = String(data.subject || data.title || '');
    const cat = data.category || quoteCategory_(subj);
    const src = quoteSource_(data.source || data.referrer || '');

    // 1. quotes_raw (원장) 시트에 1행 누적
    let shRaw = ss.getSheetByName('quotes_raw');
    if (!shRaw) {
      shRaw = ss.insertSheet('quotes_raw');
      shRaw.appendRow(['date', 'site', 'subject', 'category', 'source', 'created_at']);
    }
    shRaw.appendRow([dateStr, site, subj, cat, src, Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')]);

    // 2. quotes_monthly 집계 시트 실시간 반영
    let shMo = ss.getSheetByName('quotes_monthly');
    if (shMo && shMo.getLastRow() >= 2) {
      const v = shMo.getDataRange().getValues();
      const h = v.shift();
      const iMo = h.indexOf('month'), iCat = h.indexOf('category'), iSrc = h.indexOf('source'), iCnt = h.indexOf('count');
      let found = false;
      for (let i = 0; i < v.length; i++) {
        if (v[i][iMo] === mo && v[i][iCat] === cat && v[i][iSrc] === src) {
          v[i][iCnt] = (Number(v[i][iCnt]) || 0) + 1;
          found = true;
          break;
        }
      }
      if (!found) v.push([mo, cat, src, 1]);
      put_(ss, 'quotes_monthly', [h].concat(v.sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
    } else {
      put_(ss, 'quotes_monthly', [['month', 'category', 'source', 'count'], [mo, cat, src, 1]]);
    }

    return json_({ success: true, month: mo, category: cat, source: src });
  } catch (err) {
    return json_({ error: err.message });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ── 네이버 커머스(스마트스토어) API 수집 ── */
function collectCommerce() {
  const clientId = PROPS.getProperty('COMMERCE_CLIENT_ID');
  const clientSecret = PROPS.getProperty('COMMERCE_CLIENT_SECRET');
  const tokenProp = PROPS.getProperty('COMMERCE_API_TOKEN');
  if (!tokenProp && (!clientId || !clientSecret)) {
    console.log('네이버 커머스 API 설정 누락 (COMMERCE_CLIENT_ID 또는 COMMERCE_API_TOKEN 필요)');
    return { skipped: true, reason: 'missing_credentials' };
  }

  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  let token = tokenProp;
  if (!token && clientId && clientSecret) {
    token = getCommerceToken_(clientId, clientSecret);
  }
  if (!token) return { error: 'failed_to_get_token' };

  const thisM = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const prevM = addMonth_(thisM, -1);
  const months = [prevM, thisM];
  const results = [];

  for (const m of months) {
    const startDate = `${m}-01`;
    const endDate = lastDay_(m);
    try {
      // 스마트스토어 정산/프로모션/수수료 내역 조회
      const res = UrlFetchApp.fetch(`https://api.commerce.naver.com/external/v1/settlement/daily?startDate=${startDate}&endDate=${endDate}`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      });
      let totalStoreCost = 0;
      if (res.getResponseCode() === 200) {
        const json = JSON.parse(res.getContentText());
        (json.data || []).forEach((row) => {
          totalStoreCost += Math.abs(Number(row.promotionAmount) || 0) + Math.abs(Number(row.commissionAmount) || 0);
        });
      }
      results.push({ month: m, amount: totalStoreCost });
    } catch (e) {
      console.warn(`[스마트스토어 API] ${m} 수집 오류:`, e);
    }
  }

  if (results.length) {
    const head = ['month', 'item', 'amount', 'memo'];
    const old = read_(ss, 'manual');
    const updatedMonths = new Set(results.map((r) => r.month));
    const keep = old.filter((r) => String(r.item).toUpperCase() !== 'STORE' || !updatedMonths.has(r.month)).map((r) => head.map((h) => r[h]));
    const toAdd = results.map((r) => [r.month, 'STORE', r.amount, '네이버 커머스 API 자동 수집']);
    put_(ss, 'manual', [head].concat(keep.concat(toAdd).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  }
  return { success: true, count: results.length };
}

/** 네이버 커머스 API 토큰 발급 도우미 */
function getCommerceToken_(clientId, clientSecret) {
  const ts = Date.now();
  const sign = Utilities.base64Encode(Utilities.computeHmacSha256Signature(clientId + '_' + ts, clientSecret));
  const res = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      client_id: clientId,
      timestamp: ts,
      client_secret_sign: sign,
      grant_type: 'client_credentials',
      type: 'SELF'
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    console.error('커머스 토큰 발급 실패:', res.getContentText());
    return '';
  }
  const data = JSON.parse(res.getContentText());
  return data.access_token || '';
}

/* ── 네이버 API ── */
function api_(method, path, query) {
  const ts = String(Date.now());
  const sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(ts + '.' + method + '.' + path, PROPS.getProperty('NAVER_SECRET')));
  // 배열은 ids=a&ids=b 처럼 같은 이름을 반복해 보낸다 (네이버 공식 예제 방식)
  const qs = query ? '?' + Object.keys(query).flatMap((k) => [].concat(query[k]).map((v) => k + '=' + encodeURIComponent(v))).join('&') : '';
  const res = UrlFetchApp.fetch(CFG.BASE + path + qs, {
    method, muteHttpExceptions: true,
    headers: { 'X-Timestamp': ts, 'X-API-KEY': PROPS.getProperty('NAVER_API_KEY'), 'X-Customer': PROPS.getProperty('NAVER_CUSTOMER_ID'), 'X-Signature': sig },
  });
  if (res.getResponseCode() >= 300) throw new Error('네이버 API ' + path + ' ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  Utilities.sleep(80);
  return JSON.parse(res.getContentText());
}
function stats_(ids, since, until) {
  const out = [];
  for (let i = 0; i < ids.length; i += CFG.CHUNK) {
    const r = api_('GET', '/stats', { ids: ids.slice(i, i + CFG.CHUNK), fields: STAT_FIELDS, timeRange: JSON.stringify({ since, until }) });
    (r.data || []).forEach((d) => out.push(d));
  }
  return out;
}

/* ── 시트·날짜 도우미 ── */
function read_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), h = v.shift();
  return v.filter((r) => r[0] !== '').map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] instanceof Date ? Utilities.formatDate(r[i], 'Asia/Seoul', 'yyyy-MM') : r[i]])));
}
/** 시트를 통째로 다시 쓴다. 1열(월 등)은 날짜로 바뀌지 않게 글자 형식으로 둔다. */
function put_(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, Math.max(rows.length, 1), 1).setNumberFormat('@');
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
function addMonth_(m, n) { const [y, mo] = m.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, mo - 1 + n, 1)), 'UTC', 'yyyy-MM'); }
function lastDay_(m) { const [y, mo] = m.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, mo, 0)), 'UTC', 'yyyy-MM-dd'); }

/** 네이버 확장소재(ad-extension) 응답 객체에서 이미지 URL 추출 */
function extractExtImage_(ext) {
  if (!ext || !ext.adExtension) return '';
  return findUrlInObj_(ext.adExtension);
}

/** 소재 객체 내 이미지 URL 추출 */
function extractAdImage_(ad) {
  if (!ad) return '';
  if (ad.image) return findUrlInObj_(ad.image);
  if (ad.images) return findUrlInObj_(ad.images);
  return '';
}

/** 객체나 배열 내에서 searchad-phinf.pstatic.net 등 이미지 URL을 안전하게 재귀 탐색 */
function findUrlInObj_(o) {
  if (!o) return '';
  if (typeof o === 'string') {
    if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(o) || o.includes('pstatic.net') || o.includes('searchad-phinf')) {
      return o;
    }
    return '';
  }
  if (Array.isArray(o)) {
    for (const item of o) {
      const u = findUrlInObj_(item);
      if (u) return u;
    }
    return '';
  }
  if (typeof o === 'object') {
    const keys = ['imageUrl', 'imgUrl', 'url', 'image', 'fullSizeUrl', 'thumbnailUrl', 'mediaUrl'];
    for (const k of keys) {
      if (o[k]) {
        const u = findUrlInObj_(o[k]);
        if (u) return u;
      }
    }
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'object') {
        const u = findUrlInObj_(o[k]);
        if (u) return u;
      }
    }
  }
  return '';
}

