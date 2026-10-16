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

export interface KeywordRow {
  media: string;
  type: string;
  campaign: string;
  adgroup: string;
  keyword: string;
  match?: string;
  bid: number;
  quality: number;
  cost: number;
  imp: number;
  clk: number;
  conv: number;
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

export interface DonutItem {
  k: string;
  c: string;
  v: number;
}

declare global {
  interface Window {
    ADI?: {
      url?: string;
      key?: string;
    };
  }
}
