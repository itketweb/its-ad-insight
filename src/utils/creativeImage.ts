import type { AdGroupCreatives, AdRow, AdStatRow } from '../types/dashboard';

export const MEDIA_COLOR_VARS: Record<string, string> = {
  Google: '--c-g',
  Naver: '--c-n',
  Meta: '--c-m',
};

/**
 * 광고 계정에서 수집한 실제 이미지(소재 이미지 또는 광고그룹·캠페인의 이미지 확장소재)만 쓴다.
 * 없으면 빈 문자열 — 비슷해 보이는 사진으로 채우지 않는다 (실제 집행 소재로 오인될 수 있음).
 */
export function getCreativeImage(c: AdRow): string {
  return (c.image || '').trim();
}

/** 소재 성과 합계 (기준월) */
export type AdStat = Pick<AdStatRow, 'cost' | 'imp' | 'clk' | 'conv'>;

/** 소재 성과 조회 키 — 매체마다 소재 ID 체계가 달라 매체를 함께 쓴다 */
export const adStatKey = (media: string, adId: string) => `${media}\u0001${adId}`;

/** 소재의 모든 이미지 (대표 이미지가 맨 앞) */
export function getCreativeImages(c: AdRow): string[] {
  return c.images?.length ? c.images : c.image ? [c.image] : [];
}

/** 네이버 키워드 삽입 문법 {keyword:기본문구} 은 검색어가 없을 때 보이는 기본 문구로 보여 준다 */
export function displayAdTitle(title: string): string {
  return title.replace(/\{keyword:([^}]*)\}/gi, '$1');
}

/** 소재를 광고그룹별로 묶는다 — 들어온 순서(실적 큰 소재부터)를 그룹 안에서도 지킨다 */
export function groupAdsByAdgroup(ads: AdRow[]): AdGroupCreatives[] {
  const map = new Map<string, AdGroupCreatives>();
  ads.forEach((a) => {
    const key = [a.media, a.type, a.campaign, a.adgroup].join('\u0001');
    let g = map.get(key);
    if (!g) {
      g = { key, media: a.media, type: a.type, campaign: a.campaign, adgroup: a.adgroup, ads: [] };
      map.set(key, g);
    }
    g.ads.push(a);
  });
  return [...map.values()];
}

/**
 * 캠페인마다 하나씩 돌아가며 고른다. rank(캠페인 광고비)가 주어지면 큰 캠페인부터,
 * 광고비가 0원인 캠페인은 뒤로 미룬다 (주요 소재 = 실제로 돈이 쓰인 캠페인의 소재).
 */
export function selectRoundRobinAds<T extends { media: string; campaign: string }>(
  items: T[],
  limit = 12,
  rank?: (item: T) => number
): T[] {
  const byCamp: Record<string, T[]> = {};
  items.forEach((a) => {
    const k = adStatKey(a.media, a.campaign || '기타');
    if (!byCamp[k]) byCamp[k] = [];
    byCamp[k].push(a);
  });
  const campKeys = Object.keys(byCamp);
  if (rank) {
    const score = (k: string) => rank(byCamp[k][0]);
    campKeys.sort((a, b) => score(b) - score(a));
  }
  const result: T[] = [];
  let roundIdx = 0;
  while (result.length < limit && campKeys.some((k) => byCamp[k].length > 0)) {
    const k = campKeys[roundIdx % campKeys.length];
    if (byCamp[k].length > 0) {
      result.push(byCamp[k].shift()!);
    }
    roundIdx++;
  }
  return result;
}
