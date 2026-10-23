/**
 * its-ad-insight — Google Ads 수집 스크립트 (Google Ads 스크립트)
 *
 * Google Ads → 도구 → 대량 작업 → 스크립트 에 붙여넣고 "1시간마다"로 예약한다.
 * 개발자 토큰·관리자(MCC) 계정이 필요 없다. 이 광고 계정의 데이터를 같은 구글 계정의 시트에 쓴다.
 *  - g_campaign_monthly : 캠페인 × 월 비용·노출·클릭·전환 (전년 1월부터, 실적 최대 MAX 버전)
 *  - g_adgroup_monthly  : 광고그룹 × 월 (카테고리 매칭용, P-Max 처럼 그룹이 없는 캠페인은 제외됨)
 *  - g_keywords         : 사용 중 키워드의 현재 입찰가·품질점수 + 월별 성과 (전년 1월부터)
 *  - g_ads              : 사용 중 광고 소재 (제목·설명·연결 URL·이미지)
 *  - g_ad_stats         : 소재 × 월 비용·노출·클릭·전환 (전년 1월부터)
 *  - g_meta             : 마지막 수집 시각
 */
const CFG = {
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit',   // its-ad-insight 데이터 시트 주소
  FROM_YEAR: new Date().getFullYear() - 1, // 전년 1월부터 (전년 비교용)
};

function main() {
  const ss = SpreadsheetApp.openByUrl(CFG.SHEET_URL);
  const tz = AdsApp.currentAccount().getTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const range = `segments.date BETWEEN '${CFG.FROM_YEAR}-01-01' AND '${today}'`;
  const M = 'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions';

  const camp = [['month', 'type', 'campaign', 'campaign_id', 'cost', 'impressions', 'clicks', 'conversions']];
  each_(`SELECT segments.month, campaign.id, campaign.name, campaign.advertising_channel_type, ${M}
         FROM campaign WHERE ${range} AND metrics.cost_micros > 0`, (r) => {
    camp.push([r.segments.month.slice(0, 7), type_(r.campaign.advertisingChannelType), String(r.campaign.name || '').trim(), String(r.campaign.id), ...met_(r)]);
  });
  put_(ss, 'g_campaign_monthly', camp);

  const grp = [['month', 'type', 'campaign', 'campaign_id', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions']];
  each_(`SELECT segments.month, campaign.id, campaign.name, campaign.advertising_channel_type, ad_group.id, ad_group.name, ${M}
         FROM ad_group WHERE ${range} AND metrics.cost_micros > 0`, (r) => {
    grp.push([r.segments.month.slice(0, 7), type_(r.campaign.advertisingChannelType), String(r.campaign.name || '').trim(), String(r.campaign.id), String(r.adGroup.name || '').trim(), String(r.adGroup.id), ...met_(r)]);
  });
  put_(ss, 'g_adgroup_monthly', grp);

  // 키워드는 월별 성과 — 지금은 꺼진 키워드도 그 달에 노출됐으면 그 달 행으로 남는다
  const kw = [['month', 'type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions']];
  each_(`SELECT segments.month, campaign.name, campaign.advertising_channel_type, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
                ad_group_criterion.effective_cpc_bid_micros, ad_group_criterion.quality_info.quality_score, ${M}
         FROM keyword_view
         WHERE ${range} AND metrics.impressions > 0`, (r) => {
    const c = r.adGroupCriterion;
    kw.push([r.segments.month.slice(0, 7), type_(r.campaign.advertisingChannelType), String(r.campaign.name || '').trim(), String(r.adGroup.name || '').trim(), String(c.keyword.text || '').trim(), c.keyword.matchType,
      Math.round(Number(c.effectiveCpcBidMicros || 0) / 1e6), (c.qualityInfo && c.qualityInfo.qualityScore) || '', ...met_(r)]);
  });
  put_(ss, 'g_keywords', kw);

  // 이미지 소재 주소: 자산 이름 → 이미지 URL
  const img = {};
  each_(`SELECT asset.resource_name, asset.image_asset.full_size.url FROM asset WHERE asset.type = 'IMAGE'`, (r) => {
    const f = r.asset.imageAsset && r.asset.imageAsset.fullSize;
    if (f && f.url) img[r.asset.resourceName] = f.url;
  });

  // 검색광고(SA) 이미지 확장소재 매핑: 광고그룹·캠페인 단위 AD_IMAGE 에셋
  // 한 광고그룹·캠페인에 이미지가 여러 장 걸릴 수 있어 목록으로 모은다
  const grpImg = {}, campImg = {};
  const addImg = (map, id, res) => {
    if (img[res]) (map[id] = map[id] || []).push(img[res]);
  };
  try {
    each_(`SELECT ad_group.id, asset.resource_name FROM ad_group_asset WHERE asset_field_type = 'AD_IMAGE' AND status = 'ENABLED'`, (r) => {
      addImg(grpImg, String(r.adGroup.id), r.asset.resourceName);
    });
  } catch (_) {}
  try {
    each_(`SELECT campaign.id, asset.resource_name FROM campaign_asset WHERE asset_field_type = 'AD_IMAGE' AND status = 'ENABLED'`, (r) => {
      addImg(campImg, String(r.campaign.id), r.asset.resourceName);
    });
  } catch (_) {}

  // image: 대표 이미지 1장 (이전 화면 호환) · images: 모든 이미지를 줄바꿈으로 이은 목록 (최대 10장)
  // title: 대표 제목 (이전 화면 호환) · titles·descs: 반응형 광고의 제목·설명 전체를 줄바꿈으로 이은 목록
  const ads = [['type', 'campaign', 'ad_group', 'ad_id', 'ad_type', 'title', 'url', 'image', 'images', 'titles', 'descs']];
  const texts = (list) => [...new Set((list || []).map((t) => String((t && t.text) || '').trim()).filter(Boolean))];
  each_(`SELECT campaign.id, campaign.name, campaign.advertising_channel_type, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.ad.name,
                ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
                ad_group_ad.ad.responsive_display_ad.headlines, ad_group_ad.ad.responsive_display_ad.long_headline, ad_group_ad.ad.responsive_display_ad.descriptions,
                ad_group_ad.ad.responsive_display_ad.marketing_images, ad_group_ad.ad.image_ad.image_url
         FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'`, (r) => {
    const a = r.adGroupAd.ad, rsa = a.responsiveSearchAd || {}, rda = a.responsiveDisplayAd || {};
    const titles = texts([].concat(rsa.headlines || [], rda.headlines || [], rda.longHeadline ? [rda.longHeadline] : [])).slice(0, 15);
    const descs = texts([].concat(rsa.descriptions || [], rda.descriptions || [])).slice(0, 5);
    const mi = rda.marketingImages || [];
    const own = (a.imageAd && a.imageAd.imageUrl ? [a.imageAd.imageUrl] : []).concat(mi.map((m) => img[m.asset]).filter(Boolean));
    const list = [...new Set([own, grpImg[String(r.adGroup.id)], campImg[String(r.campaign.id)]].find((l) => l && l.length) || [])].slice(0, 10);
    ads.push([type_(r.campaign.advertisingChannelType), String(r.campaign.name || '').trim(), String(r.adGroup.name || '').trim(), String(a.id), a.type,
      String(titles[0] || a.name || '').trim(), (a.finalUrls || [])[0] || '', list[0] || '', list.join('\n'), titles.join('\n'), descs.join('\n')]);
  });
  put_(ss, 'g_ads', ads);

  // 소재 × 월 성과 (전년 1월부터, 노출이 있던 달만)
  const adStat = {};
  each_(`SELECT segments.month, ad_group_ad.ad.id, ${M} FROM ad_group_ad WHERE ${range} AND metrics.impressions > 0`, (r) => {
    const k = r.segments.month.slice(0, 7) + '\u0001' + String(r.adGroupAd.ad.id);
    const cur = adStat[k] || (adStat[k] = [r.segments.month.slice(0, 7), String(r.adGroupAd.ad.id), 0, 0, 0, 0]);
    met_(r).forEach((v, i) => (cur[i + 2] += v));
  });
  put_(ss, 'g_ad_stats', [['month', 'ad_id', 'cost', 'impressions', 'clicks', 'conversions']]
    .concat(Object.values(adStat).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));

  put_(ss, 'g_meta', [['key', 'value'], ['updated', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')],
    ['account', AdsApp.currentAccount().getName()], ['customer_id', AdsApp.currentAccount().getCustomerId()]]);
}

/** 검색 캠페인은 SA, 나머지(디스플레이·P-Max·디맨드젠·동영상)는 DA 로 본다. */
function type_(t) { return t === 'SEARCH' ? 'SA' : 'DA'; }
function met_(r) {
  const m = r.metrics;
  return [Math.round(Number(m.costMicros || 0) / 1e6), Number(m.impressions || 0), Number(m.clicks || 0), Math.round(Number(m.conversions || 0) * 100) / 100];
}
function each_(q, fn) { const it = AdsApp.search(q); while (it.hasNext()) fn(it.next()); }
/** 시트를 통째로 다시 쓴다. 1열(월 등)과 *_meta 의 2열(타임스탬프)은 날짜로 바뀌지 않게 글자 형식으로 둔다. */
function put_(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  const textCols = /_meta$/.test(name) && rows[0] && rows[0].length >= 2 ? 2 : 1;
  sh.getRange(1, 1, Math.max(rows.length, 1), textCols).setNumberFormat('@');
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
