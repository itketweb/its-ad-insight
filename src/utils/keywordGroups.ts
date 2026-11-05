import type { CampaignKeywordBucket, KeywordGroup, KeywordRow } from '../types/dashboard';

const sumClk = (list: KeywordRow[]) => list.reduce((a, k) => a + k.clk, 0);

/** 키워드 행을 광고그룹별로 묶는다 (광고비 큰 순, 같으면 클릭 많은 순) */
export function groupKeywordRows(rows: KeywordRow[]): KeywordGroup[] {
  const groups: Record<string, KeywordGroup> = {};
  rows.forEach((k) => {
    const key = [k.media, k.campaign, k.adgroup].join('\u0001');
    if (!groups[key]) {
      groups[key] = { media: k.media, campaign: k.campaign, adgroup: k.adgroup, cost: 0, list: [] };
    }
    groups[key].list.push(k);
    groups[key].cost += k.cost;
  });
  return Object.values(groups).sort((a, b) => b.cost - a.cost || sumClk(b.list) - sumClk(a.list));
}

/** 광고그룹을 캠페인 이름 단위로 묶는다 (같은 이름은 Google·Naver 합산), 광고비 큰 순 */
export function campaignBuckets(groups: KeywordGroup[]): CampaignKeywordBucket[] {
  const map: Record<string, CampaignKeywordBucket> = {};
  groups.forEach((g) => {
    const key = g.campaign.trim();
    if (!map[key]) map[key] = { medias: [], campaign: key, cost: 0, groups: [] };
    if (!map[key].medias.includes(g.media)) {
      map[key].medias.push(g.media);
      map[key].medias.sort();
    }
    map[key].groups.push(g);
    map[key].cost += g.cost;
  });
  return Object.values(map).sort((a, b) => b.cost - a.cost);
}
