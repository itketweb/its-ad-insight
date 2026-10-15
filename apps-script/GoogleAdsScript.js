/**
 * its-ad-insight — Google Ads 수집 스크립트 (Google Ads 스크립트)
 *
 * Google Ads → 도구 → 대량 작업 → 스크립트 에 붙여넣고 "1시간마다"로 예약한다.
 * 개발자 토큰·관리자(MCC) 계정이 필요 없다. 이 광고 계정의 데이터를 같은 구글 계정의 시트에 쓴다.
 *  - g_campaign_monthly : 캠페인 × 월 비용·노출·클릭·전환 (전년 1월부터, 실적 최대 MAX 버전)
 *  - g_adgroup_monthly  : 광고그룹 × 월 (카테고리 매칭용, P-Max 처럼 그룹이 없는 캠페인은 제외됨)
 *  - g_keywords         : 사용 중 키워드의 현재 입찰가·품질점수 + 최근 30일 성과
 *  - g_ads              : 사용 중 광고 소재 (제목·연결 URL·이미지)
 *  - g_meta             : 마지막 수집 시각
 */
const CFG = {
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/여기에_시트_ID/edit',   // its-ad-insight 데이터 시트 주소
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
    camp.push([r.segments.month.slice(0, 7), type_(r.campaign.advertisingChannelType), r.campaign.name, String(r.campaign.id), ...met_(r)]);
  });
  put_(ss, 'g_campaign_monthly', camp);

  const grp = [['month', 'type', 'campaign', 'campaign_id', 'ad_group', 'ad_group_id', 'cost', 'impressions', 'clicks', 'conversions']];
  each_(`SELECT segments.month, campaign.id, campaign.name, campaign.advertising_channel_type, ad_group.id, ad_group.name, ${M}
         FROM ad_group WHERE ${range} AND metrics.cost_micros > 0`, (r) => {
    grp.push([r.segments.month.slice(0, 7), type_(r.campaign.advertisingChannelType), r.campaign.name, String(r.campaign.id), r.adGroup.name, String(r.adGroup.id), ...met_(r)]);
  });
  put_(ss, 'g_adgroup_monthly', grp);

  const kw = [['type', 'campaign', 'ad_group', 'keyword', 'match', 'bid', 'quality', 'cost', 'impressions', 'clicks', 'conversions']];
  each_(`SELECT campaign.name, campaign.advertising_channel_type, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
                ad_group_criterion.effective_cpc_bid_micros, ad_group_criterion.quality_info.quality_score, ${M}
         FROM keyword_view
         WHERE segments.date DURING LAST_30_DAYS AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND ad_group_criterion.status = 'ENABLED'`, (r) => {
    const c = r.adGroupCriterion;
    kw.push([type_(r.campaign.advertisingChannelType), r.campaign.name, r.adGroup.name, c.keyword.text, c.keyword.matchType,
      Math.round(Number(c.effectiveCpcBidMicros || 0) / 1e6), (c.qualityInfo && c.qualityInfo.qualityScore) || '', ...met_(r)]);
  });
  put_(ss, 'g_keywords', kw);

  // 이미지 소재 주소: 자산 이름 → 이미지 URL
  const img = {};
  each_(`SELECT asset.resource_name, asset.image_asset.full_size.url FROM asset WHERE asset.type = 'IMAGE'`, (r) => {
    const f = r.asset.imageAsset && r.asset.imageAsset.fullSize;
    if (f && f.url) img[r.asset.resourceName] = f.url;
  });
  const ads = [['type', 'campaign', 'ad_group', 'ad_id', 'ad_type', 'title', 'url', 'image']];
  each_(`SELECT campaign.name, campaign.advertising_channel_type, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.ad.name,
                ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_display_ad.headlines,
                ad_group_ad.ad.responsive_display_ad.marketing_images, ad_group_ad.ad.image_ad.image_url
         FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'`, (r) => {
    const a = r.adGroupAd.ad;
    const heads = (a.responsiveSearchAd && a.responsiveSearchAd.headlines) || (a.responsiveDisplayAd && a.responsiveDisplayAd.headlines) || [];
    const mi = (a.responsiveDisplayAd && a.responsiveDisplayAd.marketingImages) || [];
    const image = (a.imageAd && a.imageAd.imageUrl) || (mi.length && img[mi[0].asset]) || '';
    ads.push([type_(r.campaign.advertisingChannelType), r.campaign.name, r.adGroup.name, String(a.id), a.type,
      (heads[0] && heads[0].text) || a.name || '', (a.finalUrls || [])[0] || '', image]);
  });
  put_(ss, 'g_ads', ads);

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
/** 시트를 통째로 다시 쓴다. 1열(월 등)은 날짜로 바뀌지 않게 글자 형식으로 둔다. */
function put_(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, Math.max(rows.length, 1), 1).setNumberFormat('@');
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
