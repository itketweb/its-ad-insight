import type {
  CategoryBarItem,
  CategoryMap,
  CategoryWeight,
  SourceShareItem,
  MappingRow,
  QuoteRawRow,
  QuoteRow,
  SpendRow,
} from '../types/dashboard';

export const fmt = (n: number): string => Math.round(n).toLocaleString('ko-KR');

export const rem = (): number =>
  parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export const measureSvgText = (() => {
  let ctx: CanvasRenderingContext2D | null = null;
  return (text: string, r: number): number => {
    if (!ctx) {
      const c = document.createElement('canvas');
      ctx = c.getContext('2d');
    }
    if (!ctx) return text.length * r * 0.6;
    ctx.font = `500 ${r}px "Pretendard", sans-serif`;
    return ctx.measureText(text).width;
  };
})();

export const ym = (y: number | string, m: number | string): string =>
  `${y}-${String(m).padStart(2, '0')}`;

const NOW = new Date();
export const THIS_Y = NOW.getFullYear();
export const THIS_M = ym(THIS_Y, NOW.getMonth() + 1);
export const NOW_MONTH = NOW.getMonth() + 1;

export const prevM = (mo?: string): string => {
  if (!mo || typeof mo !== 'string') return '';
  const [y, m] = mo.split('-').map(Number);
  if (!y || !m) return '';
  return m === 1 ? ym(y - 1, 12) : ym(y, m - 1);
};

export const mLabel = (mo?: string): string => {
  if (!mo || typeof mo !== 'string') return '';
  const m = mo.slice(5);
  const num = +m;
  return isNaN(num) || num === 0 ? mo : `${num}월`;
};

export const sumBy = <T>(rows: T[], f: (r: T) => number): number =>
  rows.reduce((a, r) => a + f(r), 0);

export const niceMax = (v: number): number => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
};

export const axisC = (v: number): string =>
  v >= 1000 ? +(v / 1000).toFixed(1) + 'k' : String(Math.round(v));

export interface PctInfo {
  cls: 'flat' | 'up' | 'down';
  txt: string;
}

export const pct = (a?: number | null, b?: number | null): PctInfo | null => {
  if (!b || a == null) return null;
  const p = Math.round(((a - b) / b) * 1000) / 10;
  const up = p >= 0;
  return {
    cls: p === 0 ? 'flat' : up ? 'up' : 'down',
    txt: `${up ? '▲' : '▼'} ${Math.abs(p)}%`,
  };
};

export const SERIES_DEFS = [
  { k: 'Google SA', c: '--c-g', f: (r: SpendRow) => r.media === 'Google' && r.type === 'SA' },
  { k: 'Google DA', c: '--c-g2', f: (r: SpendRow) => r.media === 'Google' && r.type === 'DA' },
  { k: 'Naver SA', c: '--c-n', f: (r: SpendRow) => r.media === 'Naver' && r.type === 'SA' },
  { k: 'Naver DA', c: '--c-n2', f: (r: SpendRow) => r.media === 'Naver' && r.type === 'DA' },
  { k: 'Meta', c: '--c-m', f: (r: SpendRow) => r.media === 'Meta' },
];

export const QUOTE_CATS = ['서버', '워크스테이션', '스토리지', '노트북', 'PC', '모니터', '기타'];
/** 카테고리 개편 전 7분류 — mapping 시트에 이 값이 있으면 옛 값으로 보고 새 체계로 대체한다 */
const LEGACY_CATS = new Set([...QUOTE_CATS, 'PC·노트북']);
export const QUOTE_COLORS = ['--c-it', '--c-g', '--c-m', '--c-ka', '--c-etc', '--c-n2', '--c-n'];

// 캠페인명+광고그룹명 → 카테고리 정밀 매핑 테이블 (엑셀 "카테고리 분류_최종(ads)" 기준)
// 순서 중요: 광고그룹 지정 항목이 캠페인 전체 항목보다 앞에 위치해야 한다.
// 광고그룹 칸이 '' 이면 해당 캠페인의 모든 광고그룹에 적용된다.
const CAT_LOOKUP: ReadonlyArray<readonly [camp: string, grp: string, cat: string]> = [
  // 광고그룹으로 2차 분기
  ['LG전자',        '사이니지',         'LG전자 > 사이니지'],
  ['LG전자',        '전자칠판',         'LG전자 > 전자칠판'],
  ['SAN 스토리지',  '화웨이',           'SAN 스토리지 > 화웨이'],
  ['SAN 스토리지',  'NetAPP',           'SAN 스토리지 > NetAPP'],
  ['SAN 스토리지',  'MSA',              'SAN 스토리지 > MSA'],
  ['네트워크/방화벽','화웨이',           '네트워크/방화벽 > 화웨이'],
  ['네트워크/방화벽','FortiGate',        '네트워크/방화벽 > FortiGate'],
  ['네트워크/방화벽','PaloAlto',         '네트워크/방화벽 > PaloAlto'],
  ['소프트웨어',    '보안 소프트웨어',   '소프트웨어 > 보안 소프트웨어'],
  ['소프트웨어',    '기타 소프트웨어',   '소프트웨어 > 기타 소프트웨어'],
  // 캠페인명 자체가 노트북 2차
  ['HP 노트북',     '',                 '노트북 > HP 노트북'],
  ['Lenovo 노트북', '',                 '노트북 > Lenovo 노트북'],
  // 캠페인명 = 1차 카테고리
  ['3Dconnexion',           '', '3Dconnexion'],
  ['Dell 서버',             '', 'Dell 서버'],
  ['HPE 서버',              '', 'HPE 서버'],
  ['Lenovo 서버',           '', 'Lenovo 서버'],
  ['서버공통(주변장비)',     '', '서버공통(주변장비)'],
  ['GPU/AI 서버',           '', 'GPU/AI 서버'],
  ['LG전자',                '', 'LG전자'],
  ['MS서피스',              '', 'MS서피스'],
  ['데스크탑',              '', '데스크탑'],
  ['모니터',                '', '모니터'],
  ['데스크탑 워크스테이션', '', '데스크탑 워크스테이션'],
  ['AI Station',            '', 'AI Station'],
  ['모바일 워크스테이션',   '', '모바일 워크스테이션'],
  ['UPS',                   '', 'UPS'],
  ['NAS 스토리지',          '', 'NAS 스토리지'],
  ['SAN 스토리지',          '', 'SAN 스토리지'],
  ['네트워크/방화벽',       '', '네트워크/방화벽'],
  ['이중화 솔루션',         '', '이중화 솔루션'],
  ['백업 솔루션',           '', '백업 솔루션'],
  ['가상화 솔루션',         '', '가상화 솔루션'],
  ['화상회의솔루션',        '', '화상회의솔루션'],
  ['소프트웨어',            '', '소프트웨어'],
  ['GstarCAD',              '', 'GstarCAD'],
  ['유지보수/기술문의',     '', '유지보수/기술문의'],
  ['리스/렌탈/데모',        '', '리스/렌탈/데모'],
  // 이름만으로 카테고리를 알 수 없는 예외 캠페인 (엑셀 37~59행). 광고그룹 지정 항목을 먼저 둔다.
  // 구글·네이버 공통 적용 — 자사 광고·중소기업패키지·GDN_자사몰_최신 은 카테고리 없음('기타')이라 적지 않는다
  ['GDN_방화벽',            '(2606) GDN_방화벽_화웨이',    '네트워크/방화벽 > 화웨이'],
  ['GDN_방화벽',            '(2606) GDN_방화벽_FortiGate', '네트워크/방화벽 > FortiGate'],
  ['GDN_방화벽',            '(2606) GDN_방화벽_PaloAlto',  '네트워크/방화벽 > PaloAlto'],
  ['GDN_SAN스토리지',       'GDN_화웨이 스토리지',         'SAN 스토리지 > 화웨이'],
  ['★HPE_MDF',             '', 'HPE 서버'],
  ['★HPE_MDF_0706~',       '', 'HPE 서버'],
  ['HP 데모',               '', '리스/렌탈/데모'],
  ['GDN_이중화솔루션',      '', '이중화 솔루션'],
  ['GDN_HP노트북',          '', '노트북 > HP 노트북'],
  ['GDN_유지보수',          '', '유지보수/기술문의'],
  ['GDN_HP모니터',          '', '모니터'],
  ['GDN_GPU',               '', 'GPU/AI 서버'],
  ['GDN_방화벽',            '', '네트워크/방화벽'],
  ['GDN_HPE 서버',          '', 'HPE 서버'],
  ['GDN_Dell 서버',         '', 'Dell 서버'],
  ['GDN_화웨이MDF',         '', 'SAN 스토리지 > 화웨이'],
  ['GDN_SAN스토리지',       '', 'SAN 스토리지'],
  ['GDN_GstarCAD',          '', 'GstarCAD'],
  ['GDN_HP데스크탑',        '', '데스크탑'],
  ['GDN_ZBook',             '', '모바일 워크스테이션'],
  ['GDN_3Dconnexion',       '', '3Dconnexion'],
  ['GDN_데스크탑 워크스테이션', '', '데스크탑 워크스테이션'],
];

/**
 * 캠페인명과 광고그룹명으로 카테고리를 결정한다.
 * mapping 시트에 수동 지정이 없을 때 폴백으로 사용된다.
 * - 캠페인명에 " > " 가 포함되면 GDN 캠페인명 자체가 카테고리 경로이므로 그대로 반환
 * - CAT_LOOKUP 에서 캠페인(+광고그룹) 정확 일치 우선 탐색
 * - 일치 없으면 '기타' 반환
 */
export function standardCategoryOf(campaign = '', adgroup = ''): string {
  const c = String(campaign).trim();
  const g = String(adgroup).trim();

  // GDN 등 캠페인명 자체에 경로가 인코딩된 경우 ("SAN 스토리지 > 화웨이" 등)
  if (c.includes(' > ')) return c;

  for (const [camp, grp, cat] of CAT_LOOKUP) {
    if (c === camp && (grp === '' || g === grp)) return cat;
  }

  return '기타';
}

/** "1차 > 2차" 형태의 카테고리 문자열을 분리. ">" 없으면 cat2는 빈 문자열 */
export function parseCatParts(cat: string): { cat1: string; cat2: string } {
  const idx = cat.indexOf(' > ');
  return idx >= 0 ? { cat1: cat.slice(0, idx), cat2: cat.slice(idx + 3) } : { cat1: cat, cat2: '' };
}

export function buildCategoryMap(mapping: MappingRow[]): CategoryMap {
  const map: CategoryMap = new Map();
  mapping
    .filter((r) => String(r.category || '').trim())
    .forEach((r) => {
      const k = [
        String(r.media || '').trim(),
        String(r.campaign || '').trim(),
        String(r.ad_group || '').trim(),
      ].join('\u0001');
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({
        c: String(r.category).trim(),
        w: (Number(r.ratio) || 100) / 100,
      });
    });
  return map;
}

export function catsOf(map: CategoryMap, r: SpendRow): CategoryWeight[] {
  const camp = r.campaign.trim();
  const grp = r.adgroup.trim();
  const hit =
    map.get([r.media, camp, grp].join('\u0001')) || map.get([r.media, camp, ''].join('\u0001'));
  // mapping 시트에 예전 분류(서버·워크스테이션·스토리지…)만 남아 있으면 새 카테고리 체계로 다시 계산한다
  if (hit && !hit.every(({ c }) => LEGACY_CATS.has(c))) return hit;
  return [{ c: standardCategoryOf(camp, grp), w: 1 }];
}

export function catSum(
  map: CategoryMap,
  rows: SpendRow[],
  f: (r: SpendRow) => number
): Record<string, number> {
  const o: Record<string, number> = {};
  rows.forEach((r) =>
    catsOf(map, r).forEach(({ c, w }) => {
      o[c] = (o[c] || 0) + f(r) * w;
    })
  );
  return o;
}

export function sourceColorVar(source: string): string {
  if (source === '네이버(광고)' || source === 'Naver') return '--c-n';
  if (source.startsWith('네이버')) return '--c-n2';
  if (source === '구글(광고)' || source === 'Google') return '--c-g';
  if (source.startsWith('구글')) return '--c-g2';
  if (source.startsWith('Meta')) return '--c-m';
  if (source.startsWith('카카오')) return '--c-ka';
  if (source === '직접') return '--c-it';
  return '--sub';
}

export function buildSourceShareData(
  quotesRaw: QuoteRawRow[],
  yearPrefix: string,
  quotesMonthly?: QuoteRow[]
): { bySource: Record<string, number>; topSourceKey: string; items: SourceShareItem[] } {
  const bySource: Record<string, number> = {};
  const rawFiltered = quotesRaw.filter(
    (r) => r.date?.startsWith(yearPrefix) && r.source && r.source !== '미수집'
  );

  if (rawFiltered.length > 0) {
    rawFiltered.forEach((r) => {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
    });
  } else if (quotesMonthly?.length) {
    quotesMonthly
      .filter((r) => r.month?.startsWith(yearPrefix) && r.source && r.source !== '미수집')
      .forEach((r) => {
        bySource[r.source] = (bySource[r.source] || 0) + r.count;
      });
  }

  const sortedKeys = Object.keys(bySource).sort((a, b) => bySource[b] - bySource[a]);
  const topSourceKey = sortedKeys[0] || '–';
  const total = Object.values(bySource).reduce((a, b) => a + b, 0);
  const items: SourceShareItem[] = total
    ? sortedKeys.map((k) => {
        const rawPct = (bySource[k] / total) * 100;
        const v = rawPct > 0 && rawPct < 0.1 ? 0.1 : Math.round(rawPct * 10) / 10;
        return {
          k,
          c: sourceColorVar(k),
          v,
          count: bySource[k],
        };
      })
    : [];

  return { bySource, topSourceKey, items };
}

export function buildCategoryBarItems(
  curSpendByCat: Record<string, number>,
  prevSpendByCat: Record<string, number>,
  quoteCountOf: (category: string) => number,
  includeQuotes = true,
  topLimit = 7,
  sortBy: 'spend' | 'quotes' = 'spend'
): CategoryBarItem[] {
  // "1차 > 2차" 형식 키를 1차 카테고리 단위로 합산
  const aggCur: Record<string, number> = {};
  const aggPrev: Record<string, number> = {};
  const aggQ: Record<string, number> = {};
  const inputKeys = [...new Set([...Object.keys(curSpendByCat), ...Object.keys(prevSpendByCat)])];

  inputKeys.forEach((k) => {
    const sep = k.indexOf(' > ');
    const pk = sep >= 0 ? k.slice(0, sep) : k;
    aggCur[pk]  = (aggCur[pk]  || 0) + (curSpendByCat[k]  || 0);
    aggPrev[pk] = (aggPrev[pk] || 0) + (prevSpendByCat[k] || 0);
    aggQ[pk]    = (aggQ[pk]    || 0) + quoteCountOf(k);
  });

  const allKeys = Object.keys(aggCur).sort((a, b) => {
    if (sortBy === 'quotes') {
      const qDiff = (aggQ[b] || 0) - (aggQ[a] || 0);
      if (qDiff !== 0) return qDiff;
    }
    return (aggCur[b] || 0) - (aggCur[a] || 0);
  });

  const topKeys = allKeys.slice(0, topLimit);
  const restKeys = allKeys.slice(topLimit);

  const items: CategoryBarItem[] = topKeys.map((k) => ({
    k,
    cur:  aggCur[k]  / 1e4,
    prev: aggPrev[k] / 1e4,
    ...(includeQuotes ? { q: aggQ[k] } : {}),
  }));

  if (restKeys.length) {
    items.push({
      k: `기타 ${restKeys.length}개`,
      cur:  sumBy(restKeys, (k) => aggCur[k]  || 0) / 1e4,
      prev: sumBy(restKeys, (k) => aggPrev[k] || 0) / 1e4,
      ...(includeQuotes ? { q: sumBy(restKeys, (k) => aggQ[k] || 0) } : {}),
    });
  }

  return items;
}

/** 광고 카테고리(새 체계) → 견적 데이터 카테고리(개편 전 체계) 역매핑 */
export const AD_TO_QUOTE_CAT: Record<string, string> = {
  'HPE 서버': '서버', 'Dell 서버': '서버', 'Lenovo 서버': '서버',
  'GPU/AI 서버': '서버', '서버공통(주변장비)': '서버',
  '데스크탑 워크스테이션': '워크스테이션', '모바일 워크스테이션': '워크스테이션',
  'AI Station': '워크스테이션',
  'SAN 스토리지': '스토리지', 'NAS 스토리지': '스토리지',
  'SAN 스토리지 > 화웨이': '스토리지', 'SAN 스토리지 > NetAPP': '스토리지',
  'SAN 스토리지 > MSA': '스토리지', 'NAS 스토리지 > 시놀로지': '스토리지',
  '노트북 > HP 노트북': '노트북', '노트북 > Lenovo 노트북': '노트북',
  'MS서피스': 'PC', '데스크탑': 'PC',
  '모니터': '모니터',
};

/**
 * 새 광고 카테고리에 대응하는 견적 건수를 반환한다.
 * 견적 시트가 아직 옛 7분류를 쓰면 같은 그룹 내 광고비 비율로 비례 배분한다.
 */
export function quoteCountFor(
  quotesForMonth: QuoteRow[],
  cat: string,
  catSpend: Record<string, number>
): number {
  const direct = quotesForMonth.filter((r) => r.category === cat).reduce((a, r) => a + r.count, 0);
  if (direct > 0) return direct;

  const quoteCat = AD_TO_QUOTE_CAT[cat];
  if (!quoteCat) return 0;

  const groupTotal = quotesForMonth
    .filter((r) => r.category === quoteCat)
    .reduce((a, r) => a + r.count, 0);
  if (!groupTotal) return 0;

  const siblings = Object.keys(AD_TO_QUOTE_CAT).filter((k) => AD_TO_QUOTE_CAT[k] === quoteCat);
  const siblingSpend = siblings.reduce((s, k) => s + (catSpend[k] || 0), 0);
  const mySpend = catSpend[cat] || 0;
  if (!siblingSpend) return Math.round(groupTotal / siblings.length);
  return Math.round(groupTotal * (mySpend / siblingSpend));
}
