import type {
  CategoryBarItem,
  CategoryMap,
  CategoryWeight,
  DonutItem,
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

export const QUOTE_CATS = ['서버', '워크스테이션', '스토리지', 'PC·노트북', '기타'];
export const QUOTE_COLORS = ['--c-it', '--c-g', '--c-m', '--c-etc', '--c-n'];

/**
 * 캠페인명과 광고그룹명을 기반으로 5대 표준 카테고리(서버, 워크스테이션, 스토리지, PC·노트북, 기타)를 판별한다.
 * 시트의 mapping 탭에 수동 지정 카테고리가 비어 있을 때 자동 매칭 기준으로 사용된다.
 */
export function standardCategoryOf(campaign = '', adgroup = ''): string {
  const c = String(campaign).trim();
  const g = String(adgroup).trim();
  const s = `${c} ${g}`.toLowerCase();

  if (/스토리지|storage|\bnas\b|\bsan\b|\bdas\b|\bmsa\b|netapp|시놀로지|synology|qnap|백업/.test(s)) {
    return '스토리지';
  }
  if (
    /워크스테이션|workstation|z\s*by\s*hp|zbyhp|zbook|\bz[12468]\b|z\s*central|zgx|data\s*science|\bgpu\b|ai\s*컴퓨터|딥러닝|머신러닝|타워형|미니\s*워크|모바일\s*워크/.test(
      s
    )
  ) {
    return '워크스테이션';
  }
  if (
    /서버|server|hpe|dell|델\b|lenovo|랙|rack|poweredge|proliant|\bdl\d|\bml\d|아이티시스템/.test(s) &&
    !/노트북/.test(s)
  ) {
    return '서버';
  }
  if (
    /노트북|laptop|데스크탑|데스크톱|desktop|\bpc\b|모니터|서피스|surface|엘리트북|엘리트보드|프로북|폴리오|드래곤플라이|파빌리온|옴니북|엘리트데스크|프로데스크|콤팩트|컴팩트|비즈니스|렌탈|올인원/.test(
      s
    )
  ) {
    return 'PC·노트북';
  }
  return '기타';
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
  return (
    map.get([r.media, camp, grp].join('\u0001')) ||
    map.get([r.media, camp, ''].join('\u0001')) || [
      { c: standardCategoryOf(camp, grp), w: 1 },
    ]
  );
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

export function buildSourceDonutData(
  quotesRaw: QuoteRawRow[],
  yearPrefix: string,
  quotesMonthly?: QuoteRow[]
): { bySource: Record<string, number>; topSourceKey: string; items: DonutItem[] } {
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
  const items: DonutItem[] = total
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
  const allKeys = [
    ...new Set([...Object.keys(curSpendByCat), ...Object.keys(prevSpendByCat)]),
  ].sort((a, b) => {
    if (sortBy === 'quotes') {
      const qDiff = (quoteCountOf(b) || 0) - (quoteCountOf(a) || 0);
      if (qDiff !== 0) return qDiff;
    }
    return (curSpendByCat[b] || 0) - (curSpendByCat[a] || 0);
  });

  const topKeys = allKeys.slice(0, topLimit);
  const restKeys = allKeys.slice(topLimit);

  const items: CategoryBarItem[] = topKeys.map((k) => ({
    k,
    cur: (curSpendByCat[k] || 0) / 1e4,
    prev: (prevSpendByCat[k] || 0) / 1e4,
    ...(includeQuotes ? { q: quoteCountOf(k) } : {}),
  }));

  if (restKeys.length) {
    items.push({
      k: `기타 ${restKeys.length}개`,
      cur: sumBy(restKeys, (k) => curSpendByCat[k] || 0) / 1e4,
      prev: sumBy(restKeys, (k) => prevSpendByCat[k] || 0) / 1e4,
      ...(includeQuotes ? { q: sumBy(restKeys, quoteCountOf) } : {}),
    });
  }

  return items;
}
