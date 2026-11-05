import type { AdRow, CategoryMap, DashboardData, KeywordRow, QuoteRawRow, SpendRow } from '../types/dashboard';
import { mergeKeywordMonths, periodStartsOf } from './allPeriod';
import { adStatKey, type AdStat } from './creativeImage';
import { catsOf } from './format';

export type SearchTab = 'groups' | 'keywords' | 'ads' | 'quotes';

export interface SearchAd {
  ad: AdRow;
  stat?: AdStat;
}

export interface SearchResult {
  /** 이름·카테고리·매체가 일치한 광고그룹, 광고비 큰 순 */
  groups: SpendRow[];
  /** 글자가 일치한 키워드 (달별 실적 합침), 광고비 큰 순 */
  keywords: KeywordRow[];
  /** 제목·설명 또는 소속 광고그룹이 일치한 소재, 광고비 큰 순 */
  ads: SearchAd[];
  /** 일치한 견적, 최신 순 */
  quotes: QuoteRawRow[];
  /** 합계의 원본 행 — 일치한 광고그룹 실적과, 그 밖의 광고그룹에서 일치한 키워드 실적 */
  spendRows: SpendRow[];
  cost: number;
  imp: number;
  clk: number;
  conv: number;
  /** 광고그룹은 일치하지 않고 키워드만 일치한 광고그룹 수 */
  keywordOnlyGroups: number;
  /** 아이티켓 사이트 견적 수 — CPA 는 이 값 기준이다 */
  itketQuotes: number;
  /** 추정 CPA — 광고비와 견적이 모두 있는 달만 계산한다 */
  cpa: number;
  /** 매체·유입 경로로 찾은 결과라 CPA 를 계산하지 않았다 (견적의 유입 추적이 광고비보다 늦게 시작해 기간이 맞지 않는다) */
  cpaHidden: boolean;
}

/** 매체 코드의 한글 이름 — "네이버" 로 찾아도 Naver 광고가 나오게 한다 */
const MEDIA_KO: Record<string, string> = { Google: '구글', Naver: '네이버', Meta: '메타' };

const compact = (s?: string | number): string => String(s ?? '').toLowerCase().replace(/\s+/g, '');

/** 검색어를 띄어쓰기로 나눈다. 비교할 때 양쪽 공백을 무시하므로 "HP 서버" 는 "HP서버" 도 찾는다 */
export const searchTokens = (query: string): string[] =>
  query.toLowerCase().split(/\s+/).filter(Boolean);

const matches = (tokens: string[], fields: (string | number | undefined)[]): boolean => {
  const text = fields.map(compact).join('\u0001');
  return tokens.every((t) => text.includes(t));
};

const groupKey = (r: { media: string; type: string; campaign: string; adgroup: string }): string =>
  [r.media, r.type, r.campaign.trim(), r.adgroup.trim()].join('\u0001');

/** 견적이 들어온 사이트 이름 — 아이티켓 원장은 비어 있고, 전화문의는 문의 유형으로 찾는다 */
const siteNameOf = (r: QuoteRawRow): string => (!r.site ? '아이티켓' : r.site === 'phone' ? '' : r.site);

const sumInto = (a: SpendRow, b: SpendRow): void => {
  a.cost += b.cost;
  a.imp += b.imp;
  a.clk += b.clk;
  a.conv += b.conv;
};

/** 이름이 일치하는 견적을 찾을 행 — 어드민 원본이 내려오면 그쪽(제목·고객 정보 있음), 아니면 통계용 행을 쓴다 */
const quoteRowsOf = (data: DashboardData): QuoteRawRow[] => {
  const adminRows = [...(data.quotesSites || []), ...(data.quotesPhone || [])];
  return [...data.quotesRaw, ...(adminRows.length ? adminRows : data.quotesExtra || [])];
};

/**
 * 검색어에 맞는 광고·견적을 모아 요약한다. months 가 null 이면 전체 기간이다.
 * 광고비는 일치한 광고그룹과, 그 밖의 광고그룹에서 일치한 키워드만 더해 같은 금액을 두 번 세지 않는다.
 * 카테고리로만 일치한 광고그룹은 분류표의 비율만큼만 더해 카테고리 효율 화면의 금액과 맞춘다.
 */
export function searchDashboard(
  data: DashboardData,
  categoryMap: CategoryMap,
  query: string,
  months: string[] | null
): SearchResult {
  // SA·DA 는 글자 포함으로 찾으면 "samsung" 같은 이름까지 걸리므로 광고 구분으로만 본다
  const allTokens = searchTokens(query);
  const typeTokens = allTokens.filter((t) => t === 'sa' || t === 'da');
  const tokens = allTokens.filter((t) => t !== 'sa' && t !== 'da');
  const typeOk = (type: string) => typeTokens.length === 0 || typeTokens.some((t) => t === type.toLowerCase());
  const textHit = (type: string, fields: (string | undefined)[]) =>
    tokens.length > 0 && typeOk(type) && matches(tokens, fields);
  const set = months && new Set(months);
  const inPeriod = (month: string) => !set || set.has(month);

  // 광고그룹
  let channelSearch = false;
  const weights = new Map<string, number>();
  /** 광고그룹이 검색어에 해당하는 비율 — 이름·매체·SA/DA 가 맞으면 1, 카테고리만 맞으면 그 카테고리의 비율, 아니면 0 */
  const groupWeight = (r: { media: string; type: string; campaign: string; adgroup: string }): number => {
    const k = groupKey(r);
    const known = weights.get(k);
    if (known !== undefined) return known;
    const names = [r.media, MEDIA_KO[r.media], r.campaign, r.adgroup];
    const cats = catsOf(categoryMap, { ...r, month: '', cost: 0, imp: 0, clk: 0, conv: 0 });
    let weight = 0;
    if (!typeOk(r.type)) weight = 0;
    else if (matches(tokens, names)) weight = 1;
    else if (matches(tokens, [...names, ...cats.map(({ c }) => c)])) {
      const catWeight = cats.filter(({ c }) => matches(tokens, [c])).reduce((a, { w }) => a + w, 0);
      // catWeight=0: 토큰이 이름·카테고리에 나뉘어 맞는 경우 → 비율 미정이므로 전체(1)
      // catWeight<0.2: 카테고리 연결 비율이 낮아 관련성이 약한 그룹 → 제외
      weight = catWeight === 0 ? 1 : catWeight >= 0.2 ? catWeight : 0;
    }
    // 이름·카테고리로는 안 맞고 매체 덕분에 맞았다
    if (weight && !matches(tokens, [r.campaign, r.adgroup, ...cats.map(({ c }) => c)])) channelSearch = true;
    weights.set(k, weight);
    return weight;
  };
  const groupMap = new Map<string, SpendRow>();
  const spendRows: SpendRow[] = [];
  data.spend.forEach((r) => {
    if (!inPeriod(r.month)) return;
    const w = groupWeight(r);
    if (!w) return;
    const row = w === 1 ? r : { ...r, cost: r.cost * w, imp: r.imp * w, clk: r.clk * w, conv: r.conv * w };
    spendRows.push(row);
    const k = groupKey(r);
    const cur = groupMap.get(k);
    if (cur) sumInto(cur, row);
    else groupMap.set(k, { ...row });
  });
  const groups = [...groupMap.values()].sort((a, b) => b.cost - a.cost);

  // 키워드 — 글자가 맞거나 일치한 광고그룹에 속한 것. 합계에는 일치하지 않은 광고그룹의 것만 더한다 (광고그룹 실적에 이미 들어 있다)
  const keywordHits = data.keywords.filter(
    (k) => inPeriod(k.month) && (groupWeight(k) > 0 || textHit(k.type, [k.keyword]))
  );
  const keywordOnly = new Set<string>();
  keywordHits.forEach((k) => {
    if (groupWeight(k)) return;
    keywordOnly.add(groupKey(k));
    spendRows.push({
      month: k.month,
      media: k.media,
      type: k.type,
      campaign: k.campaign,
      adgroup: k.adgroup,
      cost: k.cost,
      imp: k.imp,
      clk: k.clk,
      conv: k.conv,
    });
  });
  const keywords = mergeKeywordMonths(keywordHits).sort((a, b) => b.cost - a.cost || b.clk - a.clk);

  // 소재
  const stats = new Map<string, AdStat>();
  (data.adStats || []).forEach((s) => {
    if (!inPeriod(s.month)) return;
    const k = adStatKey(s.media, s.adId);
    const cur = stats.get(k);
    if (cur) {
      cur.cost += s.cost;
      cur.imp += s.imp;
      cur.clk += s.clk;
      cur.conv += s.conv;
    } else {
      stats.set(k, { cost: s.cost, imp: s.imp, clk: s.clk, conv: s.conv });
    }
  });
  const ads = data.ads
    .filter((a) => groupWeight(a) > 0 || textHit(a.type, [a.title, ...(a.titles || []), ...(a.descs || [])]))
    .map((ad) => ({ ad, stat: stats.get(adStatKey(ad.media, ad.adId)) }))
    .sort((a, b) => (b.stat?.cost || 0) - (a.stat?.cost || 0));

  // 견적 — 고객 정보는 로그인한 관리자에게만 내려오므로 없으면 찾지 못한다
  const quotes = quoteRowsOf(data)
    .filter((r) => {
      if (!tokens.length || !r.date || !inPeriod(r.date.slice(0, 7))) return false;
      const plain = [r.subject, r.category, r.sourceDetail, r.salesRep, r.sno, r.company, r.name, r.email, r.phone, r.receiver];
      if (matches(tokens, plain)) return true;
      const channel = matches(tokens, [...plain, r.source, r.inquiryType, siteNameOf(r)]);
      if (channel) channelSearch = true;
      return channel;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const sum = (f: (r: SpendRow) => number) => spendRows.reduce((a, r) => a + f(r), 0);
  const isItket = (r: QuoteRawRow) => !r.site && !r.inquiryType;
  const cpaFrom = periodStartsOf(data).cpaFrom;
  const cpaCost = spendRows.filter((r) => r.month >= cpaFrom).reduce((a, r) => a + r.cost, 0);
  const cpaQuotes = quotes.filter((r) => isItket(r) && r.date.slice(0, 7) >= cpaFrom).length;

  return {
    groups,
    keywords,
    ads,
    quotes,
    spendRows,
    cost: sum((r) => r.cost),
    imp: sum((r) => r.imp),
    clk: sum((r) => r.clk),
    conv: sum((r) => r.conv),
    keywordOnlyGroups: keywordOnly.size,
    itketQuotes: quotes.filter(isItket).length,
    cpa: !channelSearch && cpaQuotes > 0 ? cpaCost / cpaQuotes : 0,
    cpaHidden: channelSearch,
  };
}
