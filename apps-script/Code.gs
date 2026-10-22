/**
 * its-ad-insight — 네이버 검색광고 수집 + 대시보드용 웹앱 (Google Apps Script, 데이터 시트에 연결)
 *
 * script.google.com 에서 새 프로젝트(데이터 시트와 같은 구글 계정)에 붙여넣는다. 시트는 SHEET_ID 로 연다.
 *  - setup        : 처음 한 번. 관리용 시트(mapping·manual)와 웹앱 비밀키를 만들고, 15분마다 syncAll 을 예약한다.
 *  - syncAll      : 15분마다. 네이버는 구조+키워드 성과(collectNaver) 하루 1번 + 광고그룹 광고비(collectNaverStats) 15분마다로 나눠 UrlFetch 한도를 지킨다.
 *  - collectNaver : 네이버 캠페인·광고그룹·키워드·소재 목록 → n_idx_groups · n_idx_keywords · n_ads, 이어서 성과까지
 *  - collectNaverStats : 색인의 ID 로 /stats 만 → n_adgroup_monthly (당월·전월은 매번, 과거 월은 비어 있는 달만). n_keywords 는 비어 있는 과거 달만 채운다
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
  KW_STATS_RESERVE_MS: 70 * 1000,            // 광고그룹 순회를 일찍 끝내 키워드 성과(/stats) 조회 시간을 남긴다
  BACKFILL_MONTHS: 5,                        // 성과 수집 한 번에 채우는 지난 달 수 (한 번에 몰려 한도를 넘지 않게)
  // UrlFetch 하루 2만 회는 이 구글 계정의 모든 스크립트(견적문의·상담접수 연동 등)가 함께 쓴다.
  // 네이버 API 는 하루 이 횟수까지만 부르고 멈춰, 고장으로 폭주해도 나머지 스크립트 몫을 남긴다. 스크립트 속성 NAVER_DAILY_CAP 로 바꿀 수 있다.
  NAVER_DAILY_CAP: 6000,
  RUN_LIMIT_MS: 5 * 60 * 1000,               // syncAll 전체가 이 시간을 넘기면 남은 수집은 다음 실행으로 (6분 강제 종료 방지)
  SHEETS: ['g_campaign_monthly', 'g_adgroup_monthly', 'g_keywords', 'g_ads', 'g_meta',
    'n_adgroup_monthly', 'n_keywords', 'n_ads', 'n_meta', 'quotes_monthly', 'quotes_raw', 'q_meta', 'mapping', 'manual', 'manual_categories'],
};
const PROPS = PropertiesService.getScriptProperties();
const STAT_FIELDS = '["impCnt","clkCnt","salesAmt","ccnt"]';

/* ── 처음 한 번 ── */
function setup() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  if (!ss.getSheetByName('mapping')) put_(ss, 'mapping', [['media', 'campaign', 'ad_group', 'category', 'ratio']]);
  if (!ss.getSheetByName('manual')) put_(ss, 'manual', [['month', 'item', 'amount', 'memo'], ['2026-01', 'MDF', 0, '예시 — MDF / META / STORE 중 하나']]);
  if (!ss.getSheetByName('quotes_raw')) put_(ss, 'quotes_raw', [['date', 'site', 'subject', 'category', 'source', 'created_at']]);
  if (!ss.getSheetByName('manual_categories')) put_(ss, 'manual_categories', [['sno', 'category', 'updated_at']]);
  if (!PROPS.getProperty('API_TOKEN')) PROPS.setProperty('API_TOKEN', Utilities.getUuid().replace(/-/g, ''));
  const allFuncs = ['collectNaver', 'collectGfaEmail', 'collectGoogleAdsEmail', 'collectCommerce', 'collectQuotes', 'syncAll'];
  ScriptApp.getProjectTriggers().filter((t) => allFuncs.includes(t.getHandlerFunction())).forEach((t) => ScriptApp.deleteTrigger(t));
  // 실시간 체감 극대화 및 안전 쿼터 운영: 15분 주기 통합 실행
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(15).create();
  console.log('웹앱 비밀키(대시보드 js/config.js 의 key): ' + PROPS.getProperty('API_TOKEN'));
}

/* ── 전 매체 통합 동기화 (네이버·구글·견적·GFA·커머스 동일 시각 수집) ── */
function syncAll() {
  const t0 = Date.now();
  console.log('=== [its-ad-insight] 전체 매체 통합 동기화 시작 ===');
  try { syncAllBody_(t0); } finally { saveApiCount_(); }
}
function syncAllBody_(t0) {
  // 네이버는 하루 UrlFetch 한도(2만 회)를 지키려고 둘로 나눈다.
  //  - 구조(캠페인·광고그룹·키워드·소재 목록): 하루 1번, 06시 이후 첫 실행 (약 500~700회)
  //    키워드 성과는 어제까지 집계라 하루 중에는 바뀌지 않으므로 구조 수집 때 함께 받는다 (약 100회)
  //  - 광고그룹 광고비(/stats 만, 오늘 포함): NAVER_EVERY_MIN(기본 15분)마다 (약 10회)
  const now = Date.now(), kst = (f) => Utilities.formatDate(new Date(), 'Asia/Seoul', f);
  const structDue = PROPS.getProperty('NAVER_STRUCT_DAY') !== kst('yyyy-MM-dd') && Number(kst('H')) >= 6
    && now - (Number(PROPS.getProperty('NAVER_STRUCT_TRY')) || 0) >= 2 * 3600 * 1000; // 실패하면 2시간 뒤 다시
  const statsEvery = Number(PROPS.getProperty('NAVER_EVERY_MIN')) || 15;
  const statsLast = Number(PROPS.getProperty('NAVER_LAST_RUN')) || 0;
  if (apiLeft_() <= 0) {
    console.warn('- 네이버 검색광고: 오늘 호출 상한(' + apiCap_() + '회)에 도달해 내일까지 쉽니다');
    notifyOnce_('cap', '네이버 API 하루 상한 ' + apiCap_() + '회에 도달해 오늘 네이버 수집을 멈췄습니다. 평소 하루 약 1,300회이므로 수집 코드가 폭주하고 있을 수 있습니다.');
  } else if (structDue) {
    PROPS.setProperty('NAVER_STRUCT_TRY', String(now));
    PROPS.setProperty('NAVER_LAST_RUN', String(now));
    try { collectNaver(); console.log('✓ 네이버 구조+성과 동기화 완료 (API ' + apiCalls_ + '회)'); } catch (e) { fail_('collectNaver', e); }
  } else if (now - statsLast >= statsEvery * 60 * 1000 - 60 * 1000) {
    PROPS.setProperty('NAVER_LAST_RUN', String(now)); // 실패해도 다음 주기까지 재시도하지 않아 한도를 지킨다
    try { collectNaverStats(); console.log('✓ 네이버 광고비 동기화 완료 (API ' + apiCalls_ + '회)'); } catch (e) { fail_('collectNaverStats', e); }
  } else {
    console.log('- 네이버 검색광고: ' + statsEvery + '분 주기 대기 중 (마지막 ' + Utilities.formatDate(new Date(statsLast), 'Asia/Seoul', 'HH:mm') + ')');
  }
  const rest = [
    ['견적 데이터', () => { if (PROPS.getProperty('QUOTE_SHEET_ID')) collectQuotes(); }, 'collectQuotes'],
    ['구글 광고 이메일 리포트', collectGoogleAdsEmail, 'collectGoogleAdsEmail'],
    ['네이버 GFA 리포트', collectGfaEmail, 'collectGfaEmail'],
    ['네이버 커머스', collectCommerce, 'collectCommerce'],
  ];
  for (const [label, fn, name] of rest) {
    if (Date.now() - t0 > CFG.RUN_LIMIT_MS) { console.warn('- ' + label + ': 실행 시간 ' + Math.round(CFG.RUN_LIMIT_MS / 60000) + '분을 넘겨 다음 실행으로 미룸'); continue; }
    try { fn(); console.log('✓ ' + label + ' 동기화 완료'); } catch (e) { fail_(name, e); }
  }
  console.log('=== [its-ad-insight] 전체 매체 통합 동기화 완료 (' + Math.round((Date.now() - t0) / 1000) + '초 소요) ===');
}

/* ── 네이버 검색광고: 구조 수집 (하루 1번) ──
 * 캠페인·광고그룹·키워드·소재 목록과 입찰가·품질지수를 읽어 n_idx_groups · n_idx_keywords · n_ads 에 쓰고, 이어서 성과도 받는다.
 * n_idx_* 는 성과 수집(collectNaverStats)이 API 를 다시 부르지 않고 ID 를 꺼내 쓰는 색인이다 (대시보드로는 내보내지 않는다). */
function collectNaver() {
  checkNaverKeys_();
  const t0 = Date.now(), ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const camps = api_('GET', '/ncc/campaigns');
  // 확장소재 이미지는 이미지 없는 소재가 나올 때만 조회한다 (광고그룹 단위 우선, 없으면 캠페인 단위 상속).
  const extImgCache = {};
  const extImg_ = (ownerId) => {
    if (!(ownerId in extImgCache)) {
      extImgCache[ownerId] = '';
      try {
        for (const ex of (api_('GET', '/ncc/ad-extensions', { ownerId }) || [])) {
          if (ex.userLock) continue;
          const u = extractExtImage_(ex);
          if (u) { extImgCache[ownerId] = u; break; }
        }
      } catch (_) {}
    }
    return extImgCache[ownerId];
  };

  const groups = [];
  camps.forEach((c) => api_('GET', '/ncc/adgroups', { nccCampaignId: c.nccCampaignId })
    .forEach((g) => groups.push({ id: g.nccAdgroupId, name: String(g.name || '').trim(), bid: g.bidAmt, campaign: String(c.name || '').trim(), ctype: c.campaignTp, campaignId: c.nccCampaignId, on: !c.userLock && !g.userLock })));
  put_(ss, 'n_idx_groups', [['id', 'name', 'bid', 'campaign', 'ctype', 'campaign_id', 'on']]
    .concat(groups.map((g) => [g.id, g.name, g.bid || 0, g.campaign, g.ctype, g.campaignId, g.on ? 1 : 0])));

  // 당월·전월 광고비가 큰 광고그룹부터 → 운영 중 그룹 → 꺼진 그룹 순으로 읽어, 시간이 모자라도 주요 캠페인은 빠지지 않게 한다.
  const thisM = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM'), fresh = [thisM, addMonth_(thisM, -1)];
  const recent = {};
  read_(ss, 'n_adgroup_monthly').filter((r) => fresh.includes(r.month)).forEach((r) => { recent[r.ad_group_id] = (recent[r.ad_group_id] || 0) + (Number(r.cost) || 0) + (Number(r.impressions) || 0) / 1e6; });
  const rank = (g) => (recent[g.id] ? 2e9 + recent[g.id] : g.on ? 1 : 0);
  const ordered = groups.slice().sort((a, b) => rank(b) - rank(a));
  const kHead = ['id', 'ad_group_id', 'campaign', 'ad_group', 'keyword', 'bid', 'quality', 'ad_relevance', 'expected_click'];
  const kIdx = [], ads = [['type', 'campaign', 'ad_group', 'ad_id', 'ad_type', 'title', 'url', 'image']];
  const adsOld = read_(ss, 'n_ads');
  const oldImg = Object.fromEntries(adsOld.filter((r) => r.image).map((r) => [String(r.ad_id), String(r.image)])); // 지난 실행에서 찾은 확장소재 이미지 재사용
  const visited = new Set();
  for (const g of ordered) {
    if (Date.now() - t0 > CFG.BUDGET_MS - CFG.KW_STATS_RESERVE_MS) break; // 못 읽은 그룹은 아래에서 지난 값을 남긴다
    visited.add(g.campaign + '\u0001' + g.name);
    api_('GET', '/ncc/keywords', { nccAdgroupId: g.id }).filter((k) => !k.userLock)
      .forEach((k) => {
        const rel = Number(k.adRelevanceScore) || 0;
        const exp = Number(k.expectedClickScore) || 0;
        const rawQi = k.nccQi && k.nccQi.qiGrade;
        // 파워링크(WEB_SITE) 기존 nccQi.qiGrade는 2026-07-29부로 고정 기본값(4)만 반환하므로 신규 최적화 지표 우선 사용
        const qi = rel && exp ? Math.round((rel + exp) / 2) : (rel || exp || (g.ctype !== 'WEB_SITE' && rawQi ? rawQi : ''));
        kIdx.push([k.nccKeywordId, g.id, g.campaign, g.name, String(k.keyword || '').trim(), (k.useGroupBidAmt ? g.bid : k.bidAmt) || 0, qi, rel || '', exp || '']);
      });
    api_('GET', '/ncc/ads', { nccAdgroupId: g.id }).filter((a) => !a.userLock).forEach((a) => {
      const ad = a.ad || {};
      const imgUrl = extractAdImage_(ad) || oldImg[a.nccAdId] || extImg_(g.id) || extImg_(g.campaignId) || '';
      const title = ad.headline || (a.assets && a.assets[0] && a.assets[0].assetData && a.assets[0].assetData.text) || a.name || '';
      ads.push(['SA', g.campaign, g.name, a.nccAdId, a.type, title, (ad.pc && ad.pc.final) || (ad.mobile && ad.mobile.final) || '', imgUrl]);
    });
  }
  // 이번에 못 읽은 광고그룹은 지난 실행 값을 그대로 둔다 (통째로 지우면 대시보드에서 캠페인이 사라진다)
  const unseen = (r) => !visited.has(String(r.campaign) + '\u0001' + String(r.ad_group));
  const kKeep = read_(ss, 'n_idx_keywords').filter(unseen).map((r) => kHead.map((h) => r[h]));
  put_(ss, 'n_idx_keywords', [kHead].concat(kIdx, kKeep));
  put_(ss, 'n_ads', ads.concat(adsOld.filter(unseen).map((r) => ads[0].map((h) => r[h]))));
  const skipped = groups.length - visited.size;
  if (skipped) console.warn('collectNaver: 시간 예산 초과로 광고그룹 ' + skipped + '개는 지난 값을 유지');
  PROPS.setProperty('NAVER_STRUCT_DAY', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'));
  PROPS.setProperty('NAVER_STRUCT_AT', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') + ' (' + visited.size + '/' + groups.length + ')');
  collectNaverStats_(ss, t0, true);
}

/* ── 네이버 검색광고: 성과 수집 (1시간마다) ──
 * 색인(n_idx_*)의 ID 로 /stats 만 불러 n_adgroup_monthly · n_keywords(월별)를 갱신한다.
 * 당월·전월은 매번 다시, 그 이전은 비어 있는 달을 한 번에 CFG.BACKFILL_MONTHS 개씩만 채운다.
 * withKeywords 가 아니면(15분 주기) 키워드는 당월·전월을 건너뛰고 비어 있는 과거 달만 채운다 — 다 채워지면 키워드 호출은 0회. */
function collectNaverStats() {
  checkNaverKeys_();
  collectNaverStats_(SpreadsheetApp.openById(CFG.SHEET_ID), Date.now(), false);
}
function collectNaverStats_(ss, t0, withKeywords) {
  const groups = read_(ss, 'n_idx_groups');
  if (!groups.length) throw new Error('n_idx_groups 가 비어 있습니다 — collectNaver 를 먼저 한 번 실행하세요');
  const gById = Object.fromEntries(groups.map((g) => [String(g.id), g]));
  const thisM = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM'), fresh = [thisM, addMonth_(thisM, -1)];
  const yday = Utilities.formatDate(new Date(Date.now() - 864e5), 'Asia/Seoul', 'yyyy-MM-dd');
  const back = (ms) => ms.sort().reverse().slice(0, CFG.BACKFILL_MONTHS);

  // 광고그룹 × 월
  const head = ['month', 'type', 'campaign', 'campaign_tp', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions'];
  const old = read_(ss, 'n_adgroup_monthly');
  const have = new Set(old.map((r) => r.month));
  const missing = [];
  for (let m = CFG.FROM_YEAR + '-01'; m < fresh[1]; m = addMonth_(m, 1)) if (!have.has(m)) missing.push(m);
  const rows = [], done = [];
  for (const m of fresh.concat(back(missing))) {
    if (Date.now() - t0 > CFG.BUDGET_MS) break; // 남은 달은 다음 실행에서
    stats_(groups.map((g) => String(g.id)), m + '-01', lastDay_(m)).forEach((s) => {
      const g = gById[s.id];
      if (g && (s.salesAmt || s.impCnt)) rows.push([m, 'SA', g.campaign, g.ctype, g.name, String(g.id), s.salesAmt || 0, s.impCnt || 0, s.clkCnt || 0, s.ccnt || 0]);
    });
    done.push(m);
  }
  // GFA(DA) 행은 다른 수집기가 쓰므로 그대로 둔다
  const keep = old.filter((r) => r.type !== 'SA' || !done.includes(r.month)).map((r) => head.map((h) => r[h]));
  put_(ss, 'n_adgroup_monthly', [head].concat(keep.concat(rows).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));

  // 키워드 × 월 (당월은 1일~어제). 월 열이 없는 예전 행은 버린다.
  const kws = read_(ss, 'n_idx_keywords');
  const kHead = ['month', 'type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions', 'ad_relevance', 'expected_click'];
  const kOld = read_(ss, 'n_keywords').filter((r) => /^\d{4}-\d{2}$/.test(String(r.month || '')));
  const kHave = new Set(kOld.map((r) => r.month));
  const spentMs = new Set(keep.concat(rows).filter((r) => r[1] === 'SA').map((r) => r[0]));
  const kRows = [], kDone = [];
  // 조회했는데 현재 키워드의 실적이 하나도 없던 지난 달은 기억해 두고 다시 묻지 않는다 (매시간 약 250회 낭비 방지).
  // 다시 확인하려면 스크립트 속성 NAVER_KW_EMPTY 를 지운다.
  const kEmpty = new Set(JSON.parse(PROPS.getProperty('NAVER_KW_EMPTY') || '[]'));
  const kBack = back([...spentMs].filter((m) => m < fresh[1] && !kHave.has(m) && !kEmpty.has(m)));
  for (const m of (withKeywords ? fresh : []).concat(kBack)) {
    if (Date.now() - t0 > CFG.BUDGET_MS) break;
    const since = m + '-01', until = lastDay_(m) < yday ? lastDay_(m) : yday;
    if (since > until) { kDone.push(m); continue; } // 매월 1일에는 당월 성과가 아직 없다
    const ks = Object.fromEntries(stats_(kws.map((k) => String(k.id)), since, until).map((s) => [s.id, s]));
    const before = kRows.length;
    kws.forEach((k) => {
      const s = ks[String(k.id)] || {};
      // 당월은 노출 0건 대기 키워드도 남기고, 지난달은 실적이 있는 키워드만 쌓는다
      if (m === thisM || s.salesAmt || s.impCnt) kRows.push([m, 'SA', k.campaign, k.ad_group, k.keyword, '', Number(k.bid) || 0, k.quality, s.salesAmt || 0, s.impCnt || 0, s.clkCnt || 0, s.ccnt || 0, k.ad_relevance, k.expected_click]);
    });
    if (m < fresh[1] && kRows.length === before) {
      kEmpty.add(m);
      console.warn('collectNaverStats: ' + m + ' 현재 키워드 실적 없음 — 다시 묻지 않음 (NAVER_KW_EMPTY)');
    }
    kDone.push(m);
  }
  PROPS.setProperty('NAVER_KW_EMPTY', JSON.stringify([...kEmpty].sort()));
  const kKeep = kOld.filter((r) => !kDone.includes(r.month)).map((r) => kHead.map((h) => r[h]));
  if (kDone.length) put_(ss, 'n_keywords', [kHead].concat(kKeep.concat(kRows).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  put_(ss, 'n_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')], ['customer_id', PROPS.getProperty('NAVER_CUSTOMER_ID')],
    ['structure', PROPS.getProperty('NAVER_STRUCT_AT') || ''], ['api_calls', apiCalls_]]);
  syncMapping_(ss);
}
/** 진단용 (편집기에서 직접 실행): 월마다 광고그룹 성과와 키워드 성과를 비교하고, 현재 키워드의 등록 시점을 로그로 남긴다.
 * 과거 달 키워드 성과가 비는 원인(키워드 재등록 / 조회 기간 제한)을 가린다. API 약 50회. */
function debugKeywordHistory() {
  checkNaverKeys_();
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const groups = read_(ss, 'n_idx_groups'), kws = read_(ss, 'n_idx_keywords');
  // 광고비가 가장 큰 광고그룹 5개와 그 키워드만 표본으로 쓴다
  const thisM = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const spend = {};
  read_(ss, 'n_adgroup_monthly').filter((r) => r.type === 'SA').forEach((r) => { spend[r.ad_group_id] = (spend[r.ad_group_id] || 0) + (Number(r.cost) || 0); });
  const topG = groups.map((g) => String(g.id)).sort((a, b) => (spend[b] || 0) - (spend[a] || 0)).slice(0, 5);
  const sampleK = kws.filter((k) => topG.includes(String(k.ad_group_id))).slice(0, 50).map((k) => String(k.id));
  console.log('표본: 광고그룹 ' + topG.length + '개, 키워드 ' + sampleK.length + '개');
  // 키워드 등록 시점 (표본 광고그룹의 현재 키워드)
  topG.forEach((gid) => {
    const list = api_('GET', '/ncc/keywords', { nccAdgroupId: gid }).filter((k) => !k.userLock);
    const reg = list.map((k) => String(k.regTm || '').slice(0, 10)).filter(Boolean).sort();
    console.log('광고그룹 ' + gid + ': 키워드 ' + list.length + '개, 등록일 ' + (reg[0] || '?') + ' ~ ' + (reg[reg.length - 1] || '?'));
  });
  // 월별 광고그룹 성과 vs 키워드 성과
  for (let m = addMonth_(thisM, -10); m <= thisM; m = addMonth_(m, 1)) {
    const until = lastDay_(m);
    const sum = (arr) => arr.reduce((a, s) => [a[0] + (s.impCnt || 0), a[1] + (s.salesAmt || 0)], [0, 0]);
    const g = sum(stats_(topG, m + '-01', until)), k = sum(stats_(sampleK, m + '-01', until));
    console.log(m + ' 광고그룹 노출 ' + g[0] + ' / 광고비 ' + g[1] + '  |  키워드 노출 ' + k[0] + ' / 광고비 ' + k[1]);
  }
}

function checkNaverKeys_() {
  ['NAVER_API_KEY', 'NAVER_SECRET', 'NAVER_CUSTOMER_ID'].forEach((k) => { if (!PROPS.getProperty(k)) throw new Error('스크립트 속성에 ' + k + ' 가 없습니다'); });
}

/* 캠페인·광고그룹 → 카테고리 분류표 (마케팅 담당자 "카테고리 분류_최종(ads)" 기준).
 * 웹앱 src/utils/format.ts 의 CAT_LOOKUP 과 같은 표 — 한쪽을 고치면 다른 쪽도 고친다.
 * 광고그룹이 '' 이면 그 캠페인 전체에 적용되고, 광고그룹 지정 항목이 먼저 맞는다. */
const CAT_LOOKUP_ = [
  // 광고그룹으로 2차 분기
  ['LG전자',        '사이니지',         'LG전자 > 사이니지'],
  ['LG전자',        '전자칠판',         'LG전자 > 전자칠판'],
  ['SAN 스토리지',  '화웨이',           'SAN 스토리지 > 화웨이'],
  ['SAN 스토리지',  'NetAPP',           'SAN 스토리지 > NetAPP'],
  ['SAN 스토리지',  'MSA',              'SAN 스토리지 > MSA'],
  ['네트워크/방화벽','화웨이',           '네트워크/방화벽 > 화웨이'],
  ['네트워크/방화벽','FortiGate',        '네트워크/방화벽 > FortiGate'],
  ['네트워크/방화벽','PaloAlto',         '네트워크/방화벽 > PaloAlto'],
  ['소프트웨어',    '보안 소프트웨어',   '소프트웨어 > 보안 소프트웨어'],
  ['소프트웨어',    '기타 소프트웨어',   '소프트웨어 > 기타 소프트웨어'],
  // 캠페인명 자체가 노트북 2차
  ['HP 노트북',     '',                 '노트북 > HP 노트북'],
  ['Lenovo 노트북', '',                 '노트북 > Lenovo 노트북'],
  // 캠페인명 = 1차 카테고리
  ['3Dconnexion',           '', '3Dconnexion'],
  ['Dell 서버',             '', 'Dell 서버'],
  ['HPE 서버',              '', 'HPE 서버'],
  ['Lenovo 서버',           '', 'Lenovo 서버'],
  ['서버공통(주변장비)',     '', '서버공통(주변장비)'],
  ['GPU/AI 서버',           '', 'GPU/AI 서버'],
  ['LG전자',                '', 'LG전자'],
  ['MS서피스',              '', 'MS서피스'],
  ['데스크탑',              '', '데스크탑'],
  ['모니터',                '', '모니터'],
  ['데스크탑 워크스테이션', '', '데스크탑 워크스테이션'],
  ['AI Station',            '', 'AI Station'],
  ['모바일 워크스테이션',   '', '모바일 워크스테이션'],
  ['UPS',                   '', 'UPS'],
  ['NAS 스토리지',          '', 'NAS 스토리지'],
  ['SAN 스토리지',          '', 'SAN 스토리지'],
  ['네트워크/방화벽',       '', '네트워크/방화벽'],
  ['이중화 솔루션',         '', '이중화 솔루션'],
  ['백업 솔루션',           '', '백업 솔루션'],
  ['가상화 솔루션',         '', '가상화 솔루션'],
  ['화상회의솔루션',        '', '화상회의솔루션'],
  ['소프트웨어',            '', '소프트웨어'],
  ['GstarCAD',              '', 'GstarCAD'],
  ['유지보수/기술문의',     '', '유지보수/기술문의'],
  ['리스/렌탈/데모',        '', '리스/렌탈/데모'],
  // 이름만으로 카테고리를 알 수 없는 예외 캠페인 (엑셀 37~59행). 광고그룹 지정 항목을 먼저 둔다.
  // 구글·네이버 공통 적용 — 자사 광고·중소기업패키지·GDN_자사몰_최신 은 카테고리 없음('기타')이라 적지 않는다
  ['GDN_방화벽',            '(2606) GDN_방화벽_화웨이',    '네트워크/방화벽 > 화웨이'],
  ['GDN_방화벽',            '(2606) GDN_방화벽_FortiGate', '네트워크/방화벽 > FortiGate'],
  ['GDN_방화벽',            '(2606) GDN_방화벽_PaloAlto',  '네트워크/방화벽 > PaloAlto'],
  ['GDN_SAN스토리지',       'GDN_화웨이 스토리지',         'SAN 스토리지 > 화웨이'],
  ['★HPE_MDF',             '', 'HPE 서버'],
  ['★HPE_MDF_0706~',       '', 'HPE 서버'],
  ['HP 데모',               '', '리스/렌탈/데모'],
  ['GDN_이중화솔루션',      '', '이중화 솔루션'],
  ['GDN_HP노트북',          '', '노트북 > HP 노트북'],
  ['GDN_유지보수',          '', '유지보수/기술문의'],
  ['GDN_HP모니터',          '', '모니터'],
  ['GDN_GPU',               '', 'GPU/AI 서버'],
  ['GDN_방화벽',            '', '네트워크/방화벽'],
  ['GDN_HPE 서버',          '', 'HPE 서버'],
  ['GDN_Dell 서버',         '', 'Dell 서버'],
  ['GDN_화웨이MDF',         '', 'SAN 스토리지 > 화웨이'],
  ['GDN_SAN스토리지',       '', 'SAN 스토리지'],
  ['GDN_GstarCAD',          '', 'GstarCAD'],
  ['GDN_HP데스크탑',        '', '데스크탑'],
  ['GDN_ZBook',             '', '모바일 워크스테이션'],
  ['GDN_3Dconnexion',       '', '3Dconnexion'],
  ['GDN_데스크탑 워크스테이션', '', '데스크탑 워크스테이션'],
];

/** 카테고리 개편 전 옛 7분류. mapping 시트에 이 값이 있으면 새 체계로 다시 계산한다 */
const LEGACY_CATS_ = ['서버', '워크스테이션', '스토리지', '노트북', 'PC', 'PC·노트북', '모니터', '기타'];

/** 캠페인·광고그룹명 → 카테고리(1차 또는 "1차 > 2차"). 표에 없으면 '기타' */
function standardCategoryOf_(campaign, adgroup) {
  const c = String(campaign || '').trim();
  const g = String(adgroup || '').trim();
  if (c.indexOf(' > ') >= 0) return c; // 캠페인명 자체가 카테고리 경로인 경우
  for (let i = 0; i < CAT_LOOKUP_.length; i++) {
    const row = CAT_LOOKUP_[i];
    if (c === row[0] && (row[1] === '' || g === row[1])) return row[2];
  }
  return '기타';
}

/** 새로 생긴 캠페인·광고그룹을 mapping 시트에 표준 카테고리로 추가하고, 기존 빈 카테고리도 자동으로 채운다. */
function syncMapping_(ss) {
  const sh = ss.getSheetByName('mapping');
  if (!sh) return;
  const key = (r) => [String(r.media || '').trim(), String(r.campaign || '').trim(), String(r.ad_group || '').trim()].join('\u0001');
  const existing = read_(ss, 'mapping');
  const byKey = new Map();
  existing.forEach((r) => {
    const camp = String(r.campaign || '').trim();
    const grp = String(r.ad_group || '').trim();
    const cur = String(r.category || '').trim();
    const cat = (cur && LEGACY_CATS_.indexOf(cur) < 0) ? cur : standardCategoryOf_(camp, grp);
    byKey.set(key(r), [String(r.media || '').trim(), camp, grp, cat, Number(r.ratio) || 100]);
  });
  [
    ['Google', 'g_adgroup_monthly'],
    ['Google', 'g_keywords'],
    ['Naver', 'n_adgroup_monthly'],
    ['Naver', 'n_keywords'],
  ].forEach(([media, name]) => read_(ss, name).forEach((r) => {
    const camp = String(r.campaign || '').trim();
    const grp = String(r.ad_group || '').trim();
    if (!camp) return;
    const k = key({ media, campaign: camp, ad_group: grp });
    if (!byKey.has(k)) {
      byKey.set(k, [media, camp, grp, standardCategoryOf_(camp, grp), 100]);
    }
  }));
  const rows = [['media', 'campaign', 'ad_group', 'category', 'ratio']].concat(Array.from(byKey.values()));
  put_(ss, 'mapping', rows);
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

/* ── 구글 광고(Google Ads) 이메일 보고서 자동 수집 ──
 * Google Ads 보고서 에디터에서 매일 아침 발송되는 CSV 이메일을 읽어 g_adgroup_monthly · g_campaign_monthly · g_keywords 에 적재한다.
 * 패스키·OAuth 스크립트 승인 팝업 없이 100% 무인 작동한다.
 * 스크립트 속성: GADS_EMAIL_QUERY (옵션, 기본값: 'subject:("its-ad-insight" OR "통합 로우 데이터 추출") has:attachment filename:csv') */
function collectGoogleAdsEmail() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const q = PROPS.getProperty('GADS_EMAIL_QUERY') || 'subject:("its-ad-insight" OR "통합 로우 데이터 추출" OR "월별실적") has:attachment filename:csv';
  const threads = GmailApp.search(q, 0, 10);
  if (!threads.length) {
    console.log('새로운 Google Ads 리포트 이메일이 없습니다 (검색 쿼리: ' + q + ')');
    return;
  }
  let label = GmailApp.getUserLabelByName('GADS_PROCESSED');
  if (!label) label = GmailApp.createLabel('GADS_PROCESSED');

  threads.forEach((th) => {
    const labels = th.getLabels().map((l) => l.getName());
    if (labels.includes('GADS_PROCESSED')) return;

    th.getMessages().forEach((msg) => {
      msg.getAttachments().forEach((att) => {
        const name = att.getName().toLowerCase();
        if (!name.endsWith('.csv')) return;
        let csvStr = '';
        try { csvStr = att.getDataAsString('UTF-8'); } catch (e) { csvStr = att.getDataAsString('EUC-KR'); }
        if (!csvStr) return;

        // [1] 월별 실적 보고서 파싱 (its-ad-insight_월별실적)
        if (name.includes('월별') || name.includes('monthly') || csvStr.includes('캠페인 유형,통화 코드,비용')) {
          const parsed = Utilities.parseCsv(csvStr);
          while (parsed.length && !String(parsed[0][0] || '').startsWith('월')) parsed.shift();
          if (parsed.length >= 2) {
            parsed.shift(); // remove header
            const rows = [];
            parsed.forEach((r) => {
              if (!r[0] || String(r[0]).startsWith('합계') || String(r[0]).startsWith('총계')) return;
              const mMatch = String(r[0]).match(/(\d{4})년\s*(\d{1,2})월/);
              const m = mMatch ? mMatch[1] + '-' + ('0' + mMatch[2]).slice(-2) : quoteMonth_(r[0]);
              if (!m) return;
              const camp = String(r[1] || '').trim();
              const grp = String(r[2] || '').trim();
              const rawType = String(r[3] || '');
              const type = rawType.includes('검색') ? 'SA' : 'DA';
              const cost = Number(String(r[5] || '').replace(/[^0-9.-]/g, '')) || 0;
              const imp = Number(String(r[6] || '').replace(/[^0-9.-]/g, '')) || 0;
              const clk = Number(String(r[7] || '').replace(/[^0-9.-]/g, '')) || 0;
              const conv = Number(String(r[8] || '').replace(/[^0-9.-]/g, '')) || 0;
              if (cost > 0 || imp > 0 || clk > 0) {
                rows.push({ month: m, type, campaign: camp, ad_group: grp, cost, impressions: imp, clicks: clk, conversions: conv });
              }
            });
            if (rows.length) saveGoogleMonthlyRows_(ss, rows);
          }
        }

        // [2] 키워드 실적 보고서 파싱 (통합 로우 데이터 추출)
        if (name.includes('통합') || name.includes('키워드') || csvStr.includes('검색 키워드,광고 최종 도착 URL')) {
          const parsed = Utilities.parseCsv(csvStr);
          // 머리말의 보고 기간("2026년 10월 1일 - 2026년 10월 19일")에서 마지막 날짜의 월을 쓴다. 없으면 메일 수신월.
          let kwMonth = Utilities.formatDate(msg.getDate(), 'Asia/Seoul', 'yyyy-MM');
          while (parsed.length && !String(parsed[0][0] || '').startsWith('캠페인')) {
            const ds = parsed.shift().join(' ').match(/(\d{4})\s*[년.\-/]\s*(\d{1,2})/g);
            if (ds) kwMonth = quoteMonth_(ds[ds.length - 1].replace(/\s*[년.\-/]\s*/, '-')) || kwMonth;
          }
          if (parsed.length >= 2) {
            parsed.shift(); // remove header
            const rows = [];
            parsed.forEach((r) => {
              if (!r[0] || String(r[0]).startsWith('합계') || String(r[0]).startsWith('총계')) return;
              const camp = String(r[0] || '').trim();
              const grp = String(r[1] || '').trim();
              const kw = String(r[2] || '').trim();
              const qs = String(r[4] || '').trim();
              const clk = Number(String(r[5] || '').replace(/[^0-9.-]/g, '')) || 0;
              const imp = Number(String(r[6] || '').replace(/[^0-9.-]/g, '')) || 0;
              const cost = Number(String(r[8] || '').replace(/[^0-9.-]/g, '')) || 0;
              const conv = Number(String(r[14] || '').replace(/[^0-9.-]/g, '')) || 0;
              if (kw) {
                rows.push({
                  month: kwMonth,
                  type: 'SA',
                  campaign: camp,
                  ad_group: grp,
                  keyword: kw,
                  match: '',
                  bid: 0,
                  quality: qs === '--' ? '' : qs,
                  cost,
                  impressions: imp,
                  clicks: clk,
                  conversions: conv,
                });
              }
            });
            if (rows.length) saveGoogleKeywordRows_(ss, rows);
          }
        }
      });
    });
    th.addLabel(label);
  });
}

function saveGoogleMonthlyRows_(ss, rows) {
  const head = ['month', 'type', 'campaign', 'campaign_id', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions'];
  const old = read_(ss, 'g_adgroup_monthly');
  const newKeys = new Set(rows.map((r) => [r.month, r.campaign, r.ad_group].join('\u0001')));
  const keep = old.filter((r) => !newKeys.has([r.month, r.campaign, r.ad_group].join('\u0001'))).map((r) => head.map((h) => r[h]));
  const toAdd = rows.map((r) => [r.month, r.type || 'SA', r.campaign, '', r.ad_group, '', Number(r.cost) || 0, Number(r.impressions) || 0, Number(r.clicks) || 0, Number(r.conversions) || 0]);
  put_(ss, 'g_adgroup_monthly', [head].concat(keep.concat(toAdd).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));

  // 캠페인 레벨 집계 (g_campaign_monthly)
  const campMap = new Map();
  keep.concat(toAdd).forEach((r) => {
    const k = [r[0], r[1], r[2]].join('\u0001');
    const cur = campMap.get(k) || [r[0], r[1], r[2], '', 0, 0, 0, 0];
    cur[4] += Number(r[6]) || 0;
    cur[5] += Number(r[7]) || 0;
    cur[6] += Number(r[8]) || 0;
    cur[7] += Number(r[9]) || 0;
    campMap.set(k, cur);
  });
  const campHead = ['month', 'type', 'campaign', 'campaign_id', 'cost', 'impressions', 'clicks', 'conversions'];
  const campRows = [campHead].concat(Array.from(campMap.values()).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  put_(ss, 'g_campaign_monthly', campRows);

  put_(ss, 'g_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')], ['account', 'HPI_아이티스정보통신'], ['sync_mode', 'scheduled_email']]);
  syncMapping_(ss);
}

/** 월별로 갈아 끼운다: 새로 받은 달의 행만 바꾸고 다른 달은 그대로 둔다. month 가 없으면 당월로 본다. */
function saveGoogleKeywordRows_(ss, rows) {
  const head = ['month', 'type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions'];
  const thisM = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const toAdd = rows.map((r) => [quoteMonth_(r.month) || thisM, r.type || 'SA', r.campaign, r.ad_group, r.keyword, r.match || '', Number(r.bid) || 0, r.quality || '', Number(r.cost) || 0, Number(r.impressions) || 0, Number(r.clicks) || 0, Number(r.conversions) || 0]);
  const newMs = new Set(toAdd.map((r) => r[0]));
  const keep = read_(ss, 'g_keywords').filter((r) => /^\d{4}-\d{2}$/.test(String(r.month || '')) && !newMs.has(r.month)).map((r) => head.map((h) => r[h]));
  put_(ss, 'g_keywords', [head].concat(keep.concat(toAdd).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  syncMapping_(ss);
}

/* ── 견적 집계 ──
 * 아이티켓 쇼핑몰이 견적 접수 때마다 구글 시트(견적요청 리스트)에 한 줄씩 쌓는다.
 * 월·카테고리·유입경로별 건수를 quotes_monthly 에 집계하고,
 * 번호·제목·작성자·회사명·연락처·이메일·접수날짜·주문상태·유입경로·표준카테고리를 quotes_raw 에 1:1 보존한다.
 * 스크립트 속성: QUOTE_SHEET_ID(견적 시트 ID, 필수), QUOTE_SHEET_TAB(탭 이름, 기본 '견적문의'). */
function collectQuotes() {
  const id = PROPS.getProperty('QUOTE_SHEET_ID');
  if (!id) throw new Error('스크립트 속성에 QUOTE_SHEET_ID 가 없습니다');
  const src = SpreadsheetApp.openById(id);
  const sh = src.getSheetByName(PROPS.getProperty('QUOTE_SHEET_TAB') || '견적문의') || src.getSheets()[0];
  const v = sh.getDataRange().getValues();
  const h = v.shift().map((x) => String(x).replace(/\s+/g, ''));

  // 여러 컬럼명 후보 중 처음 존재하는 열 인덱스를 반환한다
  const findCol_ = (...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };

  const iSub = findCol_('제목', '문의제목', '내용');
  const iDate = findCol_('접수날짜', '접수일', '작성일', '신청일', '주문일');
  const iSrc  = findCol_('유입경로', '유입채널', '방문경로', '채널');
  if (iSub < 0 || iDate < 0) throw new Error('견적 시트에 제목·접수날짜 열이 없습니다');
  const iSno     = findCol_('번호', 'No', 'NO', '순번', '주문번호', 'sno');

  // 어드민에서 수동 지정한 카테고리 오버라이드 로드 (sno → category)
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const overrideMap = {};
  const shOv = ss.getSheetByName('manual_categories');
  if (shOv && shOv.getLastRow() >= 2) {
    const ov = shOv.getDataRange().getValues();
    const oh = ov.shift();
    const oiSno = oh.indexOf('sno'), oiCat = oh.indexOf('category');
    if (oiSno >= 0 && oiCat >= 0) {
      ov.forEach((r) => { if (r[oiSno] && r[oiCat]) overrideMap[String(r[oiSno])] = String(r[oiCat]); });
    }
  }

  const agg = {};
  v.forEach((r) => {
    const m = quoteMonth_(r[iDate]);
    if (!m) return;
    const snoVal = iSno >= 0 ? String(r[iSno] || r[0] || '') : String(r[0] || '');
    const cat = overrideMap[snoVal] || quoteCategory_(r[iSub]);
    const k = [m, cat, iSrc < 0 ? '미수집' : quoteSource_(r[iSrc])].join('\u0001');
    agg[k] = (agg[k] || 0) + 1;
  });
  const rows = [['month', 'category', 'source', 'count']];
  Object.keys(agg).sort().forEach((k) => rows.push(k.split('\u0001').concat(agg[k])));
  put_(ss, 'quotes_monthly', rows);
  put_(ss, 'q_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')], ['rows', v.length]]);

  // quotes_raw: 원본 시트 보존 (관리자 전용 대시보드 연동)
  const iName    = findCol_('작성자', '이름', '신청자', '신청자명', '고객명', '주문자명', '주문자', '담당자');
  const iCompany = findCol_('회사명', '업체명', '회사', '기업명', '기관명');
  const iEmail   = findCol_('이메일', 'email', 'Email', 'EMAIL');

  const rawHead = ['sno', 'subject', 'name', 'company', 'email', 'date', 'source', 'category'];
  const rawRows = [rawHead];
  v.forEach((r) => {
    const d = r[iDate];
    const dateStr = d instanceof Date ? Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd') : String(d || '');
    if (!dateStr || !quoteMonth_(r[iDate])) return;
    const snoVal = iSno >= 0 ? String(r[iSno] || r[0] || '') : String(r[0] || '');
    rawRows.push([
      snoVal,
      iSub < 0 ? '' : String(r[iSub] || ''),
      iName < 0 ? '' : String(r[iName] || ''),
      iCompany < 0 ? '' : String(r[iCompany] || ''),
      iEmail < 0 ? '' : String(r[iEmail] || ''),
      dateStr,
      iSrc < 0 ? '미수집' : quoteSource_(r[iSrc]),
      overrideMap[snoVal] || quoteCategory_(r[iSub]),
    ]);
  });
  put_(ss, 'quotes_raw', rawRows);
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
  if (has(/모니터|monitor|사이니지|전자칠판/)) return '모니터';
  if (has(/노트북|laptop|엘리트북|프로북|파빌리온|서피스|surface/)) return '노트북';
  if (has(/데스크탑|데스크톱|desktop|\bpc\b|올인원|엘리트데스크|프로데스크|본체/)) return 'PC';
  return '기타';
}
/** 유입 경로 열 → 세분화 매체. 비어 있으면(수집 전) '미수집'. */
function quoteSource_(raw) {
  const t = String(raw == null ? '' : raw).trim();
  const tl = t.toLowerCase();
  if (!tl) return '미수집';

  // ── Naver ──
  if (/naver|네이버/.test(tl)) {
    if (/blog|블로그/.test(tl))                          return '네이버(블로그)';
    if (/cafe|카페/.test(tl))                            return '네이버(카페)';
    if (/shop|쇼핑/.test(tl))                            return '네이버(쇼핑)';
    if (/cpc|파워링크|검색광고|\bsa\b|paid|\(광고\)/.test(tl)) return '네이버(광고)';
    return '네이버(검색)'; // 일반 '네이버' 또는 키워드 유입 → 자연검색 기본값
  }

  // ── Google ──
  if (/google|구글|gclid/.test(tl)) {
    if (/display|da\b|gdn|배너/.test(tl))                return '구글(디스플레이)';
    if (/youtube|유튜브/.test(tl))                        return '구글(유튜브)';
    if (/cpc|광고|paid|ads|gclid/.test(tl))              return '구글(광고)';
    return '구글(검색)'; // 구분 불가 → 검색(자연) 기본값
  }

  // ── Meta ──
  if (/meta|facebook|instagram|페이스북|인스타/.test(tl)) return 'Meta';

  // ── 기타 ──
  if (/kakao|카카오/.test(tl))  return '카카오';
  if (/youtube|유튜브/.test(tl)) return '유튜브';
  if (/blog|블로그/.test(tl))   return '블로그·커뮤니티';
  if (/direct|직접/.test(tl))   return '직접';

  return '기타';
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

    // [A-2] 구글 광고 월별 실적 수신
    if (data.action === 'syncGoogleMonthly' && Array.isArray(data.rows)) {
      saveGoogleMonthlyRows_(ss, data.rows);
      return json_({ success: true, type: 'GoogleMonthly', added: data.rows.length });
    }

    // [A-3] 구글 광고 키워드 실적 수신
    if (data.action === 'syncGoogleKeywords' && Array.isArray(data.rows)) {
      saveGoogleKeywordRows_(ss, data.rows);
      return json_({ success: true, type: 'GoogleKeywords', added: data.rows.length });
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

    // [E] 전체 매체(네이버·구글·견적·GFA·커머스) 즉시 동기화 호출
    if (data.action === 'syncAll') {
      syncAll();
      return json_({ success: true, message: 'All channels synced simultaneously' });
    }

    // [F] 어드민 카테고리 수동 지정 저장 (sno 기준 upsert)
    // body: { key, action: 'saveManualCategories', overrides: [{sno, category}, ...] }
    if (data.action === 'saveManualCategories' && Array.isArray(data.overrides)) {
      const ss2 = SpreadsheetApp.openById(CFG.SHEET_ID);
      let shOv = ss2.getSheetByName('manual_categories');
      if (!shOv) {
        shOv = ss2.insertSheet('manual_categories');
        shOv.appendRow(['sno', 'category', 'updated_at']);
      }
      const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      const ov = shOv.getDataRange().getValues();
      const oh = ov[0];
      const oiSno = oh.indexOf('sno'), oiCat = oh.indexOf('category'), oiAt = oh.indexOf('updated_at');
      // sno → 1-indexed sheet row
      const rowIndex = {};
      for (let i = 1; i < ov.length; i++) rowIndex[String(ov[i][oiSno])] = i + 1;
      data.overrides.forEach(({ sno, category }) => {
        const s = String(sno);
        if (rowIndex[s]) {
          shOv.getRange(rowIndex[s], oiCat + 1).setValue(category);
          shOv.getRange(rowIndex[s], oiAt + 1).setValue(now);
        } else {
          shOv.appendRow([s, category, now]);
        }
      });
      return json_({ success: true, saved: data.overrides.length });
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
let apiCalls_ = 0; // 이번 실행의 네이버 API 호출 수 (한도 점검용)
let apiDay_ = null, apiBase_ = 0, apiSaved_ = 0; // 오늘(KST) 앞선 실행들이 쓴 호출 수 — 스크립트 속성 NAVER_CALLS_DAY · NAVER_CALLS
function apiCap_() { return Number(PROPS.getProperty('NAVER_DAILY_CAP')) || CFG.NAVER_DAILY_CAP; }
function apiLeft_() {
  if (apiDay_ === null) {
    apiDay_ = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    apiBase_ = PROPS.getProperty('NAVER_CALLS_DAY') === apiDay_ ? Number(PROPS.getProperty('NAVER_CALLS')) || 0 : 0;
  }
  return apiCap_() - apiBase_ - apiCalls_;
}
function saveApiCount_() {
  if (apiDay_ === null || apiCalls_ === apiSaved_) return;
  PROPS.setProperties({ NAVER_CALLS_DAY: apiDay_, NAVER_CALLS: String(apiBase_ + apiCalls_) });
  apiSaved_ = apiCalls_;
}
/** 수집 실패를 기록하고, 계정 UrlFetch 한도 소진이면 하루 한 번 메일로 알린다. */
function fail_(name, e) {
  console.error(name + ': ' + e.message + ' (API ' + apiCalls_ + '회)');
  if (/urlfetch|너무 많이 호출|too many times/i.test(e.message)) {
    notifyOnce_('quota', '구글 계정의 UrlFetch 하루 한도(2만 회)가 소진됐습니다. 같은 계정의 견적문의(팀즈)·상담접수 시트 연동도 멈춰 있을 수 있습니다.\n'
      + 'Apps Script → 내 실행 에서 오래 걸린 실행을 찾아 원인을 확인하세요. 한도는 하루 안에 다시 채워집니다.\n\n' + name + ': ' + e.message);
  }
}
/** 같은 종류(kind)의 알림은 하루(KST) 한 번만 보낸다. Gmail 수집 때문에 이미 있는 Gmail 권한으로 보낸다(새 권한 승인 불필요). */
function notifyOnce_(kind, msg) {
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), key = 'NOTIFY_' + kind.toUpperCase();
  if (PROPS.getProperty(key) === day) return;
  try {
    GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[its-ad-insight 수집기] ' + (kind === 'cap' ? '네이버 API 하루 상한 도달' : 'UrlFetch 하루 한도 소진'), msg);
    PROPS.setProperty(key, day);
  } catch (err) { console.error('알림 메일 실패: ' + err.message); }
}
function api_(method, path, query) {
  if (apiLeft_() <= 0) throw new Error('네이버 API 하루 상한(' + apiCap_() + '회)에 도달해 멈춤');
  apiCalls_++;
  if (apiCalls_ % 50 === 0) saveApiCount_(); // 6분 강제 종료돼도 센 수가 크게 사라지지 않게
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
function formatCellDate_(d, colKey) {
  if (!(d instanceof Date)) return d;
  if (colKey === 'month') return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM');
  if (colKey === 'date') return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
  const full = Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return full.endsWith(' 00:00') ? full.slice(0, 10) : full;
}
function read_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), h = v.shift();
  return v.filter((r) => r[0] !== '').map((r) => Object.fromEntries(h.map((k, i) => [k, formatCellDate_(r[i], k)])));
}
/** 시트를 통째로 다시 쓴다. 1열(월 등)과 *_meta 의 2열(타임스탬프)은 날짜로 바뀌지 않게 글자 형식으로 둔다. */
function put_(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  const textCols = /_meta$/.test(name) && rows[0] && rows[0].length >= 2 ? 2 : 1;
  sh.getRange(1, 1, Math.max(rows.length, 1), textCols).setNumberFormat('@');
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
function addMonth_(m, n) { const [y, mo] = m.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, mo - 1 + n, 1)), 'UTC', 'yyyy-MM'); }
function lastDay_(m) { const [y, mo] = m.split('-').map(Number); return Utilities.formatDate(new Date(Date.UTC(y, mo, 0)), 'UTC', 'yyyy-MM-dd'); }

// 네이버 검색광고 이미지는 imagePath 로 경로만 내려올 수 있어 이 주소를 앞에 붙인다
const NAVER_IMG_HOST = 'https://searchad-phinf.pstatic.net';
// 소재 이미지로 쓸 확장소재 종류 — 파워링크 이미지·이미지형 서브링크만 (블로그 리뷰·플레이스 사진 등은 소재 이미지가 아니다)
const EXT_IMAGE_TYPES = ['POWER_LINK_IMAGE', 'IMAGE_SUB_LINKS'];

/** API 명세상 ad·adExtension 은 JSON 문자열일 수 있다 — 문자열이면 풀어서 돌려준다 */
function parseJson_(v) {
  if (typeof v !== 'string' || !/^\s*[{[]/.test(v)) return v;
  try { return JSON.parse(v); } catch (_) { return v; }
}

/** 네이버 확장소재(ad-extension) 중 이미지형에서만 이미지 URL 추출 */
function extractExtImage_(ext) {
  if (!ext || !EXT_IMAGE_TYPES.includes(ext.type) || ext.status === 'DELETED' || ext.inspectStatus === 'DENIED') return '';
  return findUrlInObj_(parseJson_(ext.adExtension));
}

/** 소재 객체 내 이미지 URL 추출 */
function extractAdImage_(ad) {
  ad = parseJson_(ad);
  if (!ad || typeof ad !== 'object') return '';
  return findUrlInObj_(ad.image) || findUrlInObj_(ad.images) || imageUrlOf_(ad.imagePath);
}

/** 이미지 주소 문자열만 인정한다: http(s) 이미지 주소, 또는 네이버 이미지 경로(/...)는 NAVER_IMG_HOST 를 붙인다 */
function imageUrlOf_(v, isPath) {
  if (typeof v !== 'string' || !v.trim()) return '';
  const s = v.trim();
  if (/^https?:\/\//i.test(s)) return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(s) || /(^|\.)pstatic\.net\//i.test(s.replace(/^https?:\/\//i, '')) ? s : '';
  if (isPath !== false && /^\/[^\s/][^\s]*$/.test(s)) return NAVER_IMG_HOST + s;
  return '';
}

/** 객체나 배열 내에서 이미지 URL을 재귀 탐색 (imagePath 등 경로 키는 네이버 이미지 서버 주소로 바꾼다) */
function findUrlInObj_(o) {
  if (!o) return '';
  if (typeof o === 'string') return imageUrlOf_(o, false);
  if (Array.isArray(o)) {
    for (const item of o) {
      const u = findUrlInObj_(item);
      if (u) return u;
    }
    return '';
  }
  if (typeof o === 'object') {
    for (const k of ['imagePath', 'imgPath', 'thumbnailPath']) {
      const u = imageUrlOf_(o[k]);
      if (u) return u;
    }
    for (const k of ['imageUrl', 'imgUrl', 'image', 'fullSizeUrl', 'thumbnailUrl', 'mediaUrl', 'url']) {
      const u = typeof o[k] === 'string' ? imageUrlOf_(o[k], false) : findUrlInObj_(o[k]);
      if (u) return u;
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

/**
 * 점검용 (편집기에서 직접 실행): 광고그룹·캠페인에 걸린 확장소재의 종류와 원본 adExtension 을 로그로 찍고,
 * 이미지 추출 결과를 함께 보여 준다. API 호출은 캠페인 수 + 광고그룹 최대 20개 정도.
 */
function debugNaverAdExtensions() {
  checkNaverKeys_();
  const owners = api_('GET', '/ncc/campaigns').map((c) => ({ id: c.nccCampaignId, name: '캠페인 ' + c.name }));
  read_(SpreadsheetApp.openById(CFG.SHEET_ID), 'n_idx_groups').slice(0, 20).forEach((g) => owners.push({ id: String(g.id), name: '그룹 ' + g.campaign + ' › ' + g.name }));
  const byType = {};
  owners.forEach((o) => {
    (api_('GET', '/ncc/ad-extensions', { ownerId: o.id }) || []).forEach((ex) => {
      byType[ex.type] = (byType[ex.type] || 0) + 1;
      if (EXT_IMAGE_TYPES.includes(ex.type) || /IMAGE/.test(ex.type)) {
        console.log(o.name + ' | ' + ex.type + ' | 상태 ' + ex.status + '/' + ex.inspectStatus + ' | adExtension 형식 ' + typeof ex.adExtension
          + '\n  원본: ' + String(typeof ex.adExtension === 'string' ? ex.adExtension : JSON.stringify(ex.adExtension)).slice(0, 600)
          + '\n  추출: ' + (extractExtImage_(ex) || '(없음)'));
      }
    });
  });
  console.log('확장소재 종류별 개수: ' + JSON.stringify(byType));
  saveApiCount_();
}

