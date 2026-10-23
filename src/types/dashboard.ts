export type ViewId = 'overview' | 'ads' | 'cat-efficiency' | 'keywords' | 'quotes' | 'data' | 'admin';

export type ChartType = 'line' | 'grouped' | 'donut';

export type SyncStatus = 'init' | 'live' | 'error' | 'unlinked';

export interface SpendRow {
  month: string;
  media: string;
  type: string;
  campaign: string;
  adgroup: string;
  cost: number;
  imp: number;
  clk: number;
  conv: number;
}

export interface ManualRow {
  month: string;
  item: string;
  amount: number;
}

export interface MappingRow {
  media?: string;
  campaign?: string;
  ad_group?: string;
  category?: string;
  ratio?: number | string;
}

export interface QuoteRow {
  month: string;
  category: string;
  source: string;
  count: number;
}

export interface QuoteRawRow {
  id?: string;
  sno?: string | number;
  subject?: string;
  name?: string;
  company?: string;
  email?: string;
  date: string;
  category: string;
  source: string;
  /** 시트 원문 유입경로의 꼬리표 (예: "네이버(광고) - ROSEHA" → "ROSEHA"). 없으면 빈 값 */
  sourceDetail: string;
}

export interface KeywordRow {
  month: string;
  media: string;
  type: string;
  campaign: string;
  adgroup: string;
  keyword: string;
  match?: string;
  bid: number;
  quality: number;
  adRelevance?: number;
  expectedClick?: number;
  cost: number;
  imp: number;
  clk: number;
  conv: number;
}

export interface KeywordGroup {
  media: string;
  campaign: string;
  adgroup: string;
  cost: number;
  list: KeywordRow[];
}

export interface CampaignKeywordBucket {
  /** 같은 캠페인명이 Google·Naver 양쪽에 있으면 한 탭으로 합치므로 매체가 여럿일 수 있다 */
  medias: string[];
  campaign: string;
  cost: number;
  groups: KeywordGroup[];
}

export interface AdRow {
  media: string;
  type: string;
  /** 매체의 소재 ID — 소재 성과(AdStatRow)와 잇는 키 */
  adId: string;
  /** 매체의 소재 종류 코드 (RSA_AD·TEXT_45 등) */
  adType: string;
  campaign: string;
  adgroup: string;
  /** 대표 제목 (titles[0]) */
  title: string;
  /** 반응형 소재의 제목 전체 (대표 제목 포함) */
  titles: string[];
  /** 설명 전체 */
  descs: string[];
  url: string;
  /** 대표 이미지 (images[0]) */
  image: string;
  /** 소재에 걸린 이미지 전체 — 확장소재·반응형 광고는 여러 장일 수 있다 */
  images: string[];
}

/** 같은 광고그룹의 소재 묶음 — 그룹 안 소재마다 제목·설명·링크가 다를 수 있다 */
export interface AdGroupCreatives {
  key: string;
  media: string;
  type: string;
  campaign: string;
  adgroup: string;
  /** 기준월 실적이 큰 소재부터 */
  ads: AdRow[];
}

/** 소재 × 월 성과 */
export interface AdStatRow {
  month: string;
  media: string;
  adId: string;
  cost: number;
  imp: number;
  clk: number;
  conv: number;
}

export interface DashboardData {
  updated: string;
  sources: {
    google: string;
    naver: string;
    quote?: string;
  };
  spend: SpendRow[];
  manual: ManualRow[];
  mapping: MappingRow[];
  quotes: QuoteRow[];
  quotesRaw: QuoteRawRow[];
  keywords: KeywordRow[];
  ads: AdRow[];
  adStats: AdStatRow[];
}

export interface CategoryWeight {
  c: string;
  w: number;
}

export type CategoryMap = Map<string, CategoryWeight[]>;

export interface SeriesItem {
  k: string;
  c: string;
  v: number[];
  raw?: number[];
}

export interface CategoryBarItem {
  k: string;
  cur: number;
  prev: number;
  q?: number;
}

export interface SourceShareItem {
  k: string;
  c: string;
  v: number;
  count?: number;
}

export interface RawSpendApiRow {
  month?: unknown;
  type?: string;
  campaign?: unknown;
  ad_group?: unknown;
  cost?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  conversions?: unknown;
}

export interface RawManualApiRow {
  month?: unknown;
  item?: unknown;
  amount?: unknown;
}

export interface RawKeywordApiRow {
  month?: unknown;
  type?: unknown;
  campaign?: unknown;
  ad_group?: unknown;
  keyword?: unknown;
  match?: string;
  bid?: unknown;
  quality?: unknown;
  ad_relevance?: unknown;
  expected_click?: unknown;
  cost?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  conversions?: unknown;
}

export interface RawAdApiRow {
  type?: unknown;
  campaign?: unknown;
  ad_group?: unknown;
  title?: unknown;
  ad_type?: unknown;
  url?: unknown;
  image?: unknown;
  /** 이미지 주소를 줄바꿈으로 이은 문자열 (수집 스크립트가 images 열을 쓰기 전 데이터에는 없다) */
  images?: unknown;
  ad_id?: unknown;
  /** 제목·설명을 줄바꿈으로 이은 문자열 (titles·descs 열이 생기기 전 데이터에는 없다) */
  titles?: unknown;
  descs?: unknown;
}

export interface RawAdStatApiRow {
  month?: unknown;
  ad_id?: unknown;
  cost?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  conversions?: unknown;
}

export interface RawMetaApiRow {
  key?: string;
  value?: string;
}

export interface RawQuoteMonthlyApiRow {
  month?: unknown;
  category?: unknown;
  source?: unknown;
  count?: unknown;
}

export interface RawQuoteRawApiRow {
  id?: unknown;
  sno?: unknown;
  subject?: unknown;
  name?: unknown;
  company?: unknown;
  email?: unknown;
  date?: unknown;
  category?: unknown;
  source?: unknown;
  /** 시트 원문 유입경로 */
  source_raw?: unknown;
}

export interface RawApiPayload {
  error?: string;
  served?: string;
  g_meta?: RawMetaApiRow[];
  n_meta?: RawMetaApiRow[];
  q_meta?: RawMetaApiRow[];
  g_adgroup_monthly?: RawSpendApiRow[];
  g_campaign_monthly?: RawSpendApiRow[];
  n_adgroup_monthly?: RawSpendApiRow[];
  manual?: RawManualApiRow[];
  mapping?: MappingRow[];
  quotes_monthly?: RawQuoteMonthlyApiRow[];
  quotes_raw?: RawQuoteRawApiRow[];
  g_keywords?: RawKeywordApiRow[];
  n_keywords?: RawKeywordApiRow[];
  g_ads?: RawAdApiRow[];
  n_ads?: RawAdApiRow[];
  g_ad_stats?: RawAdStatApiRow[];
  n_ad_stats?: RawAdStatApiRow[];
}

declare global {
  interface Window {
    ADI?: {
      url?: string;
      key?: string;
    };
  }
}
