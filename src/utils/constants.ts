import type { ViewId } from '../types/dashboard';

export interface CatHierarchyNode {
  cat1: string;
  cat2: string[];
}

export const CATEGORY_HIERARCHY: CatHierarchyNode[] = [
  { cat1: '3Dconnexion', cat2: [] },
  { cat1: 'Dell 서버', cat2: [] },
  { cat1: 'HPE 서버', cat2: [] },
  { cat1: 'Lenovo 서버', cat2: [] },
  { cat1: '서버공통(주변장비)', cat2: [] },
  { cat1: 'GPU/AI 서버', cat2: [] },
  { cat1: 'LG전자', cat2: ['사이니지', '전자칠판'] },
  { cat1: '노트북', cat2: ['HP 노트북', 'Lenovo 노트북'] },
  { cat1: 'MS서피스', cat2: [] },
  { cat1: '데스크탑', cat2: [] },
  { cat1: '모니터', cat2: [] },
  { cat1: '데스크탑 워크스테이션', cat2: [] },
  { cat1: 'AI Station', cat2: [] },
  { cat1: '모바일 워크스테이션', cat2: [] },
  { cat1: 'UPS', cat2: [] },
  { cat1: 'SAN 스토리지', cat2: ['화웨이', 'NetAPP', 'MSA'] },
  { cat1: 'NAS 스토리지', cat2: ['시놀로지'] },
  { cat1: '네트워크/방화벽', cat2: ['화웨이', 'FortiGate', 'PaloAlto'] },
  { cat1: '이중화 솔루션', cat2: [] },
  { cat1: '백업 솔루션', cat2: [] },
  { cat1: '가상화 솔루션', cat2: [] },
  { cat1: '화상회의솔루션', cat2: ['Poly'] },
  { cat1: '소프트웨어', cat2: ['보안 소프트웨어', '기타 소프트웨어'] },
  { cat1: 'GstarCAD', cat2: [] },
  { cat1: '유지보수/기술문의', cat2: [] },
  { cat1: '리스/렌탈/데모', cat2: [] },
  { cat1: '기타', cat2: [] },
];

/** 분류표의 모든 카테고리 — 1차 다음에 그 2차("1차 > 2차")를 둔다 (어드민 수동 지정 목록 등) */
export const ALL_CATEGORIES: string[] = CATEGORY_HIERARCHY.flatMap((n) => [n.cat1, ...n.cat2.map((c2) => `${n.cat1} > ${c2}`)]);

export const VALID_VIEWS: ViewId[] = [
  'overview',
  'ads',
  'cat-efficiency',
  'keywords',
  'quotes',
  'data',
  'admin',
];

export const VIEW_TITLES: Record<ViewId, string> = {
  overview: '종합 요약',
  ads: '월별 광고비',
  'cat-efficiency': '카테고리 효율',
  keywords: '키워드 · 소재',
  quotes: '견적 상세',
  data: '데이터 연결',
  admin: '어드민 관리',
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
