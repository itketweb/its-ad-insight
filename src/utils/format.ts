import type { CategoryMap, CategoryWeight, MappingRow, SpendRow } from '../types/dashboard';

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

export const prevM = (mo: string): string => {
  const [y, m] = mo.split('-').map(Number);
  return m === 1 ? ym(y - 1, 12) : ym(y, m - 1);
};

export const mLabel = (mo: string): string => `${+mo.slice(5)}월`;

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

export function buildCategoryMap(mapping: MappingRow[]): CategoryMap {
  const map: CategoryMap = new Map();
  mapping
    .filter((r) => String(r.category || '').trim())
    .forEach((r) => {
      const k = [r.media, r.campaign, r.ad_group || ''].join('\u0001');
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({
        c: String(r.category).trim(),
        w: (Number(r.ratio) || 100) / 100,
      });
    });
  return map;
}

export function catsOf(map: CategoryMap, r: SpendRow): CategoryWeight[] {
  return (
    map.get([r.media, r.campaign, r.adgroup].join('\u0001')) ||
    map.get([r.media, r.campaign, ''].join('\u0001')) || [
      { c: r.campaign || '미분류', w: 1 },
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
