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
  try { collectNaver(); console.log('✓ 네이버 검색광고 동기화 완료'); } catch (e) { console.error('collectNaver: ' + e.message); }
  try { if (PROPS.getProperty('QUOTE_SHEET_ID')) { collectQuotes(); console.log('✓ 견적 데이터 동기화 완료'); } } catch (e) { console.error('collectQuotes: ' + e.message); }
  try { collectGoogleAdsEmail(); console.log('✓ 구글 광고 이메일 리포트 파싱 완료'); } catch (e) { console.error('collectGoogleAdsEmail: ' + e.message); }
  try { collectGfaEmail(); console.log('✓ 네이버 GFA 리포트 파싱 완료'); } catch (e) { console.error('collectGfaEmail: ' + e.message); }
  try { collectCommerce(); console.log('✓ 네이버 커머스 동기화 완료'); } catch (e) { console.error('collectCommerce: ' + e.message); }
  console.log('=== [its-ad-insight] 전체 매체 통합 동기화 완료 (' + Math.round((Date.now() - t0) / 1000) + '초 소요) ===');
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
    .forEach((g) => groups.push({ id: g.nccAdgroupId, name: String(g.name || '').trim(), bid: g.bidAmt, campaign: String(c.name || '').trim(), ctype: c.campaignTp, campaignId: c.nccCampaignId })));
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
      .forEach((k) => {
        const rel = Number(k.adRelevanceScore) || 0;
        const exp = Number(k.expectedClickScore) || 0;
        const rawQi = k.nccQi && k.nccQi.qiGrade;
        // 파워링크(WEB_SITE) 기존 nccQi.qiGrade는 2026-07-29부로 고정 기본값(4)만 반환하므로 신규 최적화 지표 우선 사용
        const qi = rel && exp ? Math.round((rel + exp) / 2) : (rel || exp || (g.ctype !== 'WEB_SITE' && rawQi ? rawQi : ''));
        kws.push({ id: k.nccKeywordId, g, keyword: String(k.keyword || '').trim(), bid: k.useGroupBidAmt ? g.bid : k.bidAmt, qi, rel: rel || '', exp: exp || '' });
      });
    api_('GET', '/ncc/ads', { nccAdgroupId: g.id }).filter((a) => !a.userLock).forEach((a) => {
      const ad = a.ad || {};
      const imgUrl = extractAdImage_(ad) || finalExtImg || '';
      const title = ad.headline || (a.assets && a.assets[0] && a.assets[0].assetData && a.assets[0].assetData.text) || a.name || '';
      ads.push(['SA', g.campaign, g.name, a.nccAdId, a.type, title, (ad.pc && ad.pc.final) || (ad.mobile && ad.mobile.final) || '', imgUrl]);
    });
  }
  const ks = Object.fromEntries(stats_(kws.map((k) => k.id), since, until).map((s) => [s.id, s]));
  put_(ss, 'n_keywords', [['type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions', 'ad_relevance', 'expected_click']]
    .concat(kws.map((k) => { const s = ks[k.id] || {}; return ['SA', k.g.campaign, k.g.name, k.keyword, '', k.bid || 0, k.qi, s.salesAmt || 0, s.impCnt || 0, s.clkCnt || 0, s.ccnt || 0, k.rel, k.exp]; })));
  put_(ss, 'n_ads', ads);
  put_(ss, 'n_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')], ['customer_id', PROPS.getProperty('NAVER_CUSTOMER_ID')]]);
  syncMapping_(ss);
}

/** 캠페인·광고그룹명 → 표준 카테고리(서버·워크스테이션·스토리지·PC·노트북·기타) 자동 분류 */
function standardCategoryOf_(campaign, adgroup) {
  const c = String(campaign || '').trim();
  const g = String(adgroup || '').trim();
  const s = (c + ' ' + g).toLowerCase();
  if (/스토리지|storage|\bnas\b|\bsan\b|\bdas\b|\bmsa\b|netapp|시놀로지|synology|qnap|백업/.test(s)) return '스토리지';
  if (/워크스테이션|workstation|z\s*by\s*hp|zbyhp|zbook|\bz[12468]\b|z\s*central|zgx|data\s*science|\bgpu\b|ai\s*컴퓨터|딥러닝|머신러닝|타워형|미니\s*워크|모바일\s*워크/.test(s)) return '워크스테이션';
  if (/서버|server|hpe|dell|델\b|lenovo|랙|rack|poweredge|proliant|\bdl\d|\bml\d|아이티시스템/.test(s) && !/노트북/.test(s)) return '서버';
  if (/노트북|laptop|데스크탑|데스크톱|desktop|\bpc\b|모니터|서피스|surface|엘리트북|엘리트보드|프로북|폴리오|드래곤플라이|파빌리온|옴니북|엘리트데스크|프로데스크|콤팩트|컴팩트|비즈니스|렌탈|올인원/.test(s)) return 'PC·노트북';
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
    const cat = String(r.category || '').trim() || standardCategoryOf_(camp, grp);
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
          while (parsed.length && !String(parsed[0][0] || '').startsWith('캠페인')) parsed.shift();
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

function saveGoogleKeywordRows_(ss, rows) {
  const head = ['type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions'];
  const toAdd = rows.map((r) => [r.type || 'SA', r.campaign, r.ad_group, r.keyword, r.match || '', Number(r.bid) || 0, r.quality || '', Number(r.cost) || 0, Number(r.impressions) || 0, Number(r.clicks) || 0, Number(r.conversions) || 0]);
  put_(ss, 'g_keywords', [head].concat(toAdd));
  syncMapping_(ss);
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

  // quotes_raw: 원본 시트의 개별 행 데이터 (이름·이메일·연락처 제외)
  const iStatus = h.indexOf('주문상태');
  const rawHead = ['date', 'category', 'source', 'status'];
  const rawRows = [rawHead];
  v.forEach((r) => {
    const d = r[iDate];
    const dateStr = d instanceof Date ? Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd') : String(d || '');
    if (!dateStr || !quoteMonth_(r[iDate])) return;
    rawRows.push([
      dateStr,
      quoteCategory_(r[iSub]),
      iSrc < 0 ? '미수집' : quoteSource_(r[iSrc]),
      iStatus < 0 ? '' : String(r[iStatus] || ''),
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
  if (has(/노트북|laptop|데스크탑|데스크톱|desktop|\bpc\b|모니터|올인원/)) return 'PC·노트북';
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
    if (/organic|자연|검색$/.test(tl))                   return '네이버(검색)';
    if (/cpc|파워링크|검색광고|\bsa\b|paid/.test(tl))    return '네이버(광고)';
    return '네이버(광고)'; // 구분 불가 → 광고 기본값
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

