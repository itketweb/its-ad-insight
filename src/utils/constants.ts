import type { ViewId } from '../types/dashboard';

export const VALID_VIEWS: ViewId[] = [
  'overview',
  'ads',
  'cat-efficiency',
  'keywords',
  'quotes',
  'data',
];

export const VIEW_TITLES: Record<ViewId, string> = {
  overview: '종합 요약',
  ads: '월별 광고비',
  'cat-efficiency': '카테고리 효율',
  keywords: '키워드 · 소재',
  quotes: '견적 상세',
  data: '데이터 연결',
};

export const EXTERNAL_LINKS = {
  googleAds: 'https://ads.google.com',
  naverSearchAd: 'https://searchad.naver.com',
  naverSmartStore: 'https://sell.smartstore.naver.com',
  metaAds: 'https://adsmanager.facebook.com',
  itketEstimateList: 'https://itket.com/d/dbk_estimate_list.php',
  masterSheet:
    'https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit',
  quotesRawSheet:
    'https://docs.google.com/spreadsheets/d/18tMYBQLuIhkmX_x_c8MK-aNXlGvOgz1TWauvqo8Dmjg/edit?gid=0#gid=0',
} as const;
