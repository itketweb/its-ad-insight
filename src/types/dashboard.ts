export type ViewId = 'overview' | 'ads' | 'cat-efficiency' | 'keywords' | 'quotes' | 'data';

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
  date: string;
  category: string;
  source: string;
  status: string;
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
  campaign: string;
  adgroup: string;
  title: string;
  url: string;
  image: string;
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
  date?: unknown;
  category?: unknown;
  source?: unknown;
  status?: unknown;
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
}

declare global {
  interface Window {
    ADI?: {
      url?: string;
      key?: string;
    };
  }
}
