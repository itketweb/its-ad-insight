import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  AdRow,
  AdStatRow,
  DashboardData,
  KeywordRow,
  ManualRow,
  QuoteRow,
  RawAdApiRow,
  RawAdStatApiRow,
  RawApiPayload,
  RawKeywordApiRow,
  RawMetaApiRow,
  RawSpendApiRow,
  SpendRow,
  QuoteRawRow,
  SyncStatus,
} from '../types/dashboard';
import { buildCategoryMap, LEGACY_ONLY_CATS, THIS_M } from '../utils/format';
import { quoteCategoryOf } from '../utils/categoryText';
import { adStatKey } from '../utils/creativeImage';
import { readCachedPayload, writeCachedPayload } from '../utils/payloadCache';

export const DEFAULT_URL =
  'https://script.google.com/macros/s/AKfycbzQS9yMlp9L_eRaH77QWLsY6GOY7L5hyRk1fkuaAHg8GvJmHHwhPRgr2zWldgbX5-cNcg/exec';
export const DEFAULT_KEY = '2d3b0cc2b04a4873a835583968ca7a0b';


export function getCfg(): { url: string; key: string } {
  const c = window.ADI || {};
  const envUrl = import.meta.env?.VITE_ADI_URL;
  const envKey = import.meta.env?.VITE_ADI_KEY;
  let s: { url?: string; key?: string } = {};
  try {
    s = JSON.parse(localStorage.getItem('adi_cfg') || '{}');
  } catch {
    // ignore
  }
  const pick = (...vals: Array<unknown>) => {
    for (const v of vals) {
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  return {
    url: pick(s.url, envUrl, c.url) || DEFAULT_URL,
    key: pick(s.key, envKey, c.key) || DEFAULT_KEY,
  };
}

function emptyData(): DashboardData {
  return {
    updated: '',
    sources: { google: '', naver: '' },
    spend: [],
    manual: [],
    mapping: [],
    quotes: [],
    quotesRaw: [],
    keywords: [],
    ads: [],
    adStats: [],
  };
}

function fmtUpdatedTimestamp(s: string): string {
  if (!s) return '';
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const pad = (v: number) => String(v).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  return s;
}

/**
 * 수집 스크립트가 아직 개편 전 7분류(서버·워크스테이션·스토리지…)로 견적을 나눠 보냈으면,
 * 원장(quotes_raw)의 제목·광고 꼬리표로 새 분류표에 맞춰 다시 분류하고 월별 건수도 원장에서 다시 센다.
 * 수집 스크립트(quoteCategory_)가 새 분류로 바뀐 뒤에는 그대로 통과한다.
 */
function withCurrentQuoteCategories(data: DashboardData): DashboardData {
  const legacy = data.quotes.some((r) => LEGACY_ONLY_CATS.has(r.category));
  // 제목이 없는 원장(배포에 묶인 data/latest.json 스냅숏 등)은 다시 분류할 근거가 없어 그대로 둔다
  if (!legacy || !data.quotesRaw.some((r) => r.subject)) return data;
  const quotesRaw = data.quotesRaw.map((r) => ({ ...r, category: quoteCategoryOf(r.subject || '', r.sourceDetail) }));
  const agg = new Map<string, QuoteRow>();
  quotesRaw.forEach((r) => {
    const month = r.date.slice(0, 7);
    const k = [month, r.category, r.source].join('\u0001');
    const cur = agg.get(k);
    if (cur) cur.count += 1;
    else agg.set(k, { month, category: r.category, source: r.source, count: 1 });
  });
  return { ...data, quotes: [...agg.values()], quotesRaw };
}

export function fromApi(j: RawApiPayload): DashboardData {
  const n = (v: unknown) => Number(v) || 0;

  const toSpendRow = (media: string, r: RawSpendApiRow): SpendRow => ({
    month: String(r.month ?? '').trim().slice(0, 7),
    media,
    type: String(r.type || 'SA').trim(),
    campaign: String(r.campaign ?? '').trim(),
    adgroup: String(r.ad_group ?? '').trim(),
    cost: n(r.cost),
    imp: n(r.impressions),
    clk: n(r.clicks),
    conv: n(r.conversions),
  });

  const spend: SpendRow[] = (j.g_adgroup_monthly || []).map((r) => toSpendRow('Google', r));
  const hasGroup = new Set(spend.map((r) => `${r.month}\u0001${r.campaign}`));

  (j.g_campaign_monthly || []).forEach((r) => {
    const c = toSpendRow('Google', r);
    if (!hasGroup.has(`${c.month}\u0001${c.campaign}`)) {
      spend.push({ ...c, adgroup: '(광고그룹 없음)' });
    }
  });

  (j.n_adgroup_monthly || []).forEach((r) => spend.push(toSpendRow('Naver', r)));

  const manual: ManualRow[] = (j.manual || [])
    .map((r) => ({
      month: String(r.month ?? '').trim().slice(0, 7),
      item: String(r.item ?? '').trim().toUpperCase(),
      amount: n(r.amount),
    }))
    .filter((r) => r.amount > 0);

  manual
    .filter((r) => r.item === 'META')
    .forEach((r) =>
      spend.push({
        month: r.month,
        media: 'Meta',
        type: 'DA',
        campaign: 'Meta',
        adgroup: '',
        cost: r.amount,
        imp: 0,
        clk: 0,
        conv: 0,
      })
    );

  // 네이버 파워링크는 2026-07-29부로 기존 nccQi.qiGrade가 폐지되어 모든 키워드가 고정값 4로 내려온다.
  // 신규 지표(ad_relevance, expected_click)가 없고 네이버 키워드 전체가 4로만 채워진 경우 고정 기본값이므로 0 처리한다.
  const naverRawKws = j.n_keywords || [];
  const isLegacyUniformNaverQi =
    naverRawKws.length > 0 &&
    naverRawKws.every(
      (r) =>
        !n(r.ad_relevance) &&
        !n(r.expected_click) &&
        (n(r.quality) === 4 || n(r.quality) === 0)
    );

  const toKeywordRow = (media: string, r: RawKeywordApiRow): KeywordRow => {
    const adRelevance = n(r.ad_relevance) || undefined;
    const expectedClick = n(r.expected_click) || undefined;
    const rawQ = n(r.quality);
    const quality =
      media === 'Naver'
        ? adRelevance && expectedClick
          ? Math.round((adRelevance + expectedClick) / 2)
          : adRelevance || expectedClick || (isLegacyUniformNaverQi && rawQ === 4 ? 0 : rawQ)
        : rawQ;

    const month = String(r.month ?? '').trim().slice(0, 7) || THIS_M;

    return {
      month,
      media,
      type: String(r.type || 'SA').trim(),
      campaign: String(r.campaign ?? '').trim(),
      adgroup: String(r.ad_group ?? '').trim(),
      keyword: String(r.keyword ?? '').trim(),
      match: r.match,
      bid: n(r.bid),
      quality,
      adRelevance,
      expectedClick,
      cost: n(r.cost),
      imp: n(r.impressions),
      clk: n(r.clicks),
      conv: n(r.conversions),
    };
  };

  // 줄바꿈으로 이은 목록 열(images·titles·descs) → 배열. 대표 값(first)이 있으면 맨 앞에 둔다
  const lines = (v: unknown, first = '') => {
    const list = String(v ?? '')
      .split(/\s*\n\s*/)
      .filter(Boolean);
    return [...new Set(first ? [first, ...list] : list)];
  };

  const toAdRow = (media: string, r: RawAdApiRow): AdRow => {
    const images = lines(r.images, String(r.image || '').trim());
    const title = String(r.title || r.ad_type || '').trim();
    return {
      media,
      type: String(r.type || 'SA').trim(),
      adId: String(r.ad_id ?? '').trim(),
      adType: String(r.ad_type ?? '').trim(),
      campaign: String(r.campaign ?? '').trim(),
      adgroup: String(r.ad_group ?? '').trim(),
      title,
      titles: lines(r.titles, title),
      descs: lines(r.descs),
      url: String(r.url || '').trim(),
      image: images[0] || '',
      images,
    };
  };

  // 캠페인 이름을 바꾸면 시트에 옛 이름의 행이 남아 같은 소재가 두 번 온다 — 앞(최근 수집) 행만 쓴다
  const uniqueAds = (rows: AdRow[]) => {
    const seen = new Set<string>();
    return rows.filter((a) => {
      if (!a.adId) return true;
      const k = adStatKey(a.media, a.adId);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const toAdStatRow = (media: string, r: RawAdStatApiRow): AdStatRow => ({
    month: String(r.month ?? '').trim().slice(0, 7),
    media,
    adId: String(r.ad_id ?? '').trim(),
    cost: n(r.cost),
    imp: n(r.impressions),
    clk: n(r.clicks),
    conv: n(r.conversions),
  });

  const upd = (rows?: RawMetaApiRow[]) =>
    (rows || []).find((r) => r.key === 'updated')?.value || '';

  const candidates = [j.served, upd(j.g_meta), upd(j.n_meta), upd(j.q_meta)]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const precise = candidates.filter((s) => s.length >= 10);
  const rawUpdated = precise.length ? precise.sort().pop()! : candidates.sort().pop() || '';

  const data: DashboardData = {
    updated: fmtUpdatedTimestamp(rawUpdated),
    sources: { google: upd(j.g_meta), naver: upd(j.n_meta), quote: upd(j.q_meta) },
    spend,
    manual,
    mapping: j.mapping || [],
    quotes: (j.quotes_monthly || []).map((r) => {
      const src = String(r.source ?? '').trim();
      return {
        month: String(r.month ?? '').trim().slice(0, 7),
        category: String(r.category ?? '').trim(),
        source: src === '직접·기타' ? '기타' : src,
        count: n(r.count),
      };
    }),
    quotesRaw: (j.quotes_raw || [])
      .map((r, idx) => {
        const src = String(r.source || '').trim();
        return {
          id: r.id ? String(r.id) : ('q_' + (idx + 1)),
          sno: r.sno != null ? String(r.sno).trim() : undefined,
          subject: r.subject != null ? String(r.subject).trim() : undefined,
          company: r.company != null ? String(r.company).trim() : undefined,
          name: r.name != null ? String(r.name).trim() : undefined,
          email: r.email != null ? String(r.email).trim() : undefined,
          date: String(r.date || '').trim(),
          category: String(r.category || '').trim(),
          source: src === '직접·기타' ? '기타' : src,
          // "네이버(광고) - ROSEHA" 처럼 " - " 뒤에 붙은 광고 꼬리표만 따로 둔다
          sourceDetail: String(r.source_raw || '').split(/\s+-\s+/).slice(1).join(' - ').trim(),
        };
      })
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    keywords: [
      ...(j.g_keywords || []).map((r) => toKeywordRow('Google', r)),
      ...naverRawKws.map((r) => toKeywordRow('Naver', r)),
    ],
    ads: uniqueAds([
      ...(j.g_ads || []).map((r) => toAdRow('Google', r)),
      ...(j.n_ads || []).map((r) => toAdRow('Naver', r)),
    ]),
    adStats: [
      ...(j.g_ad_stats || []).map((r) => toAdStatRow('Google', r)),
      ...(j.n_ad_stats || []).map((r) => toAdStatRow('Naver', r)),
    ],
  };
  return withCurrentQuoteCategories(data);
}

const isUsableCache = (j: RawApiPayload | null): j is RawApiPayload =>
  !!j && !!(j.quotes_monthly?.length || j.n_adgroup_monthly?.length) && !!j.quotes_raw?.length;

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [status, setStatus] = useState<SyncStatus>('init');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  // 실데이터가 먼저 도착하면 늦게 읽힌 캐시로 덮어쓰지 않는다
  const liveLoaded = useRef(false);

  const categoryMap = useMemo(() => buildCategoryMap(data.mapping), [data.mapping]);

  const tryLoadStaticFallback = useCallback(async () => {
    try {
      const localRes = await fetch('data/latest.json');
      if (!localRes.ok) return;
      const localJ = (await localRes.json()) as RawApiPayload;
      setData((prevData) => {
        if (prevData.spend.length > 0 && prevData.quotesRaw.length > 0) return prevData;
        writeCachedPayload(localJ);
        return fromApi(localJ);
      });
      setStatus('live');
    } catch {
      // ignore fallback failure
    }
  }, []);

  const load = useCallback(async () => {
    const c = getCfg();
    if (!c.url || !c.key) {
      setStatus((prev) => (prev !== 'live' ? 'unlinked' : prev));
      return;
    }
    setIsSyncing(true);

    try {
      const fetchUrl = `${c.url}${c.url.includes('?') ? '&' : '?'}key=${encodeURIComponent(c.key)}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as RawApiPayload;
      if (j.error) throw new Error(j.error);
      liveLoaded.current = true;
      setData(fromApi(j));
      setStatus('live');
      writeCachedPayload(j);
    } catch (e) {
      console.error('[its-ad-insight] 실데이터 동기화 오류 (화면 데이터 유지):', e);
      setStatus((prev) => (prev === 'live' ? 'live' : 'error'));
      await tryLoadStaticFallback();
    } finally {
      setIsSyncing(false);
    }
  }, [tryLoadStaticFallback]);

  useEffect(() => {
    // 지난번 받은 데이터로 먼저 그리고(없으면 배포에 묶인 스냅숏), 실데이터를 받아 바꿔 끼운다
    readCachedPayload().then(async (cached) => {
      if (isUsableCache(cached)) {
        if (!liveLoaded.current) {
          setData(fromApi(cached));
          setStatus('live');
        }
      } else {
        await tryLoadStaticFallback();
      }
      load();
    });

    const timer = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load, tryLoadStaticFallback]);

  useEffect(() => {
    document.body.classList.toggle('live', status === 'live');
  }, [status]);

  const updateQuotesRaw = useCallback((newQuotes: QuoteRawRow[]) => {
    const agg: Record<string, number> = {};
    newQuotes.forEach((r) => {
      const mo = (r.date || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mo)) return;
      const key = `${mo}\u0001${r.category || '기타'}\u0001${r.source || '미수집'}`;
      agg[key] = (agg[key] || 0) + 1;
    });
    const recalculated: QuoteRow[] = Object.entries(agg).map(([k, count]) => {
      const [month, category, source] = k.split('\u0001');
      return { month, category, source, count };
    });
    setData((prev) => ({
      ...prev,
      quotesRaw: newQuotes,
      quotes: recalculated.length > 0 ? recalculated : prev.quotes,
    }));
  }, []);

  return { data, categoryMap, status, isSyncing, load, updateQuotesRaw };
}
