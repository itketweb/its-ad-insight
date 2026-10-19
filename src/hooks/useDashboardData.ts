import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AdRow,
  DashboardData,
  KeywordRow,
  ManualRow,
  RawAdApiRow,
  RawApiPayload,
  RawKeywordApiRow,
  RawMetaApiRow,
  RawSpendApiRow,
  SpendRow,
  SyncStatus,
} from '../types/dashboard';
import { buildCategoryMap } from '../utils/format';

export const DEFAULT_URL =
  'https://script.google.com/macros/s/AKfycbzQS9yMlp9L_eRaH77QWLsY6GOY7L5hyRk1fkuaAHg8GvJmHHwhPRgr2zWldgbX5-cNcg/exec';
export const DEFAULT_KEY = '2d3b0cc2b04a4873a835583968ca7a0b';

const CACHE_STORAGE_KEY = 'adi_data_cache';

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

    return {
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

  const toAdRow = (media: string, r: RawAdApiRow): AdRow => ({
    media,
    type: String(r.type || 'SA').trim(),
    campaign: String(r.campaign ?? '').trim(),
    adgroup: String(r.ad_group ?? '').trim(),
    title: String(r.title || r.ad_type || '').trim(),
    url: String(r.url || '').trim(),
    image: String(r.image || '').trim(),
  });

  const upd = (rows?: RawMetaApiRow[]) =>
    (rows || []).find((r) => r.key === 'updated')?.value || '';

  const candidates = [j.served, upd(j.g_meta), upd(j.n_meta), upd(j.q_meta)]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const precise = candidates.filter((s) => s.length >= 10);
  const rawUpdated = precise.length ? precise.sort().pop()! : candidates.sort().pop() || '';

  return {
    updated: fmtUpdatedTimestamp(rawUpdated),
    sources: { google: upd(j.g_meta), naver: upd(j.n_meta), quote: upd(j.q_meta) },
    spend,
    manual,
    mapping: j.mapping || [],
    quotes: (j.quotes_monthly || []).map((r) => ({
      month: String(r.month ?? '').trim().slice(0, 7),
      category: String(r.category ?? '').trim(),
      source: String(r.source ?? '').trim(),
      count: n(r.count),
    })),
    quotesRaw: (j.quotes_raw || [])
      .map((r) => ({
        date: String(r.date || '').trim(),
        category: String(r.category || '').trim(),
        source: String(r.source || '').trim(),
        status: String(r.status || '').trim(),
      }))
      .filter((r) => r.date)
      .sort((a, b) => b.date.localeCompare(a.date)),
    keywords: [
      ...(j.g_keywords || []).map((r) => toKeywordRow('Google', r)),
      ...naverRawKws.map((r) => toKeywordRow('Naver', r)),
    ],
    ads: [
      ...(j.g_ads || []).map((r) => toAdRow('Google', r)),
      ...(j.n_ads || []).map((r) => toAdRow('Naver', r)),
    ],
  };
}

function saveCacheSafe(payload: RawApiPayload): void {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

function loadInitialCache(): { data: DashboardData; status: SyncStatus; restored: boolean } {
  try {
    const cached = localStorage.getItem(CACHE_STORAGE_KEY);
    if (cached) {
      const j = JSON.parse(cached) as RawApiPayload;
      if (j && (j.quotes_monthly?.length || j.n_adgroup_monthly?.length) && j.quotes_raw?.length) {
        return { data: fromApi(j), status: 'live', restored: true };
      }
    }
  } catch (e) {
    console.warn('[its-ad-insight] 로컬 캐시 복원 건너뜀:', e);
  }
  return { data: emptyData(), status: 'init', restored: false };
}

export function useDashboardData() {
  const initial = useMemo(() => loadInitialCache(), []);
  const [data, setData] = useState<DashboardData>(initial.data);
  const [status, setStatus] = useState<SyncStatus>(initial.status);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const categoryMap = useMemo(() => buildCategoryMap(data.mapping), [data.mapping]);

  const tryLoadStaticFallback = useCallback(async () => {
    try {
      const localRes = await fetch('data/latest.json');
      if (!localRes.ok) return;
      const localJ = (await localRes.json()) as RawApiPayload;
      setData((prevData) => {
        if (prevData.spend.length > 0 && prevData.quotesRaw.length > 0) return prevData;
        saveCacheSafe(localJ);
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
      setData(fromApi(j));
      setStatus('live');
      saveCacheSafe(j);
    } catch (e) {
      console.error('[its-ad-insight] 실데이터 동기화 오류 (화면 데이터 유지):', e);
      setStatus((prev) => (prev === 'live' ? 'live' : 'error'));
      await tryLoadStaticFallback();
    } finally {
      setIsSyncing(false);
    }
  }, [tryLoadStaticFallback]);

  useEffect(() => {
    if (!initial.restored) {
      tryLoadStaticFallback().finally(() => {
        load();
      });
    } else {
      load();
    }

    const timer = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [initial.restored, load, tryLoadStaticFallback]);

  useEffect(() => {
    document.body.classList.toggle('live', status === 'live');
  }, [status]);

  return { data, categoryMap, status, isSyncing, load };
}
