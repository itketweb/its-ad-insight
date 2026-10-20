import type { AdRow } from '../types/dashboard';

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

/** 네이버 키워드 삽입 문법 {keyword:기본문구} 은 검색어가 없을 때 보이는 기본 문구로 보여 준다 */
export function displayAdTitle(title: string): string {
  return title.replace(/\{keyword:([^}]*)\}/gi, '$1');
}

/**
 * 캠페인마다 한 소재씩 돌아가며 고른다. rank(캠페인 광고비)가 주어지면 큰 캠페인부터,
 * 광고비가 0원인 캠페인은 뒤로 미룬다 (주요 소재 = 실제로 돈이 쓰인 캠페인의 소재).
 */
export function selectRoundRobinAds(
  ads: AdRow[],
  limit = 12,
  rank?: (ad: AdRow) => number
): AdRow[] {
  const byCamp: Record<string, AdRow[]> = {};
  ads.forEach((a) => {
    const k = `${a.media}\u0001${a.campaign || '기타'}`;
    if (!byCamp[k]) byCamp[k] = [];
    byCamp[k].push(a);
  });
  const campKeys = Object.keys(byCamp);
  if (rank) {
    const score = (k: string) => rank(byCamp[k][0]);
    campKeys.sort((a, b) => score(b) - score(a));
  }
  const result: AdRow[] = [];
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
