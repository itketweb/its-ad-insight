import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DashboardData, SpendRow, SyncStatus } from '../types/dashboard';
import { buildCategoryMap } from '../utils/format';

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
  const url =
    s.url && String(s.url).trim()
      ? String(s.url).trim()
      : envUrl && String(envUrl).trim()
        ? String(envUrl).trim()
        : c.url && String(c.url).trim()
          ? String(c.url).trim()
          : DEFAULT_URL;
  const key =
    s.key && String(s.key).trim()
      ? String(s.key).trim()
      : envKey && String(envKey).trim()
        ? String(envKey).trim()
        : c.key && String(c.key).trim()
          ? String(c.key).trim()
          : DEFAULT_KEY;
  return { url, key };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromApi(j: any): DashboardData {
  const n = (v: unknown) => Number(v) || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (media: string, r: any): SpendRow => ({
    month: String(r.month).slice(0, 7),
    media,
    type: r.type || 'SA',
    campaign: String(r.campaign),
    adgroup: String(r.ad_group ?? ''),
    cost: n(r.cost),
    imp: n(r.impressions),
    clk: n(r.clicks),
    conv: n(r.conversions),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spend: SpendRow[] = (j.g_adgroup_monthly || []).map((r: any) => row('Google', r));
  const hasGroup = new Set(spend.map((r) => r.month + '\u0001' + r.campaign));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (j.g_campaign_monthly || []).forEach((r: any) => {
    const c = row('Google', r);
    if (!hasGroup.has(c.month + '\u0001' + c.campaign)) {
      spend.push({ ...c, adgroup: '(광고그룹 없음)' });
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (j.n_adgroup_monthly || []).forEach((r: any) => spend.push(row('Naver', r)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manual = (j.manual || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      month: String(r.month).slice(0, 7),
      item: String(r.item).trim().toUpperCase(),
      amount: n(r.amount),
    }))
    .filter((r: { amount: number }) => r.amount);

  manual
    .filter((r: { item: string }) => r.item === 'META')
    .forEach((r: { month: string; amount: number }) =>
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kw = (media: string, r: any) => ({
    media,
    type: String(r.type || 'SA'),
    campaign: String(r.campaign),
    adgroup: String(r.ad_group),
    keyword: String(r.keyword),
    match: r.match,
    bid: n(r.bid),
    quality: n(r.quality),
    cost: n(r.cost),
    imp: n(r.impressions),
    clk: n(r.clicks),
    conv: n(r.conversions),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ad = (media: string, r: any) => ({
    media,
    type: String(r.type || 'SA'),
    campaign: String(r.campaign),
    adgroup: String(r.ad_group),
    title: String(r.title || r.ad_type || ''),
    url: String(r.url || ''),
    image: String(r.image || ''),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upd = (rows: any[]) => ((rows || []).find((r) => r.key === 'updated') || {}).value || '';
  const candidates = [j.served, upd(j.g_meta), upd(j.n_meta), upd(j.q_meta)]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const precise = candidates.filter((s) => s.length >= 10);
  const rawUpdated = precise.length ? precise.sort().pop()! : candidates.sort().pop() || '';

  const fmtUpdated = (s: string) => {
    if (!s) return '';
    if (s.includes('T')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const pad = (v: number) => String(v).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    return s;
  };

  return {
    updated: fmtUpdated(rawUpdated),
    sources: { google: upd(j.g_meta), naver: upd(j.n_meta), quote: upd(j.q_meta) },
    spend,
    manual,
    mapping: j.mapping || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quotes: (j.quotes_monthly || []).map((r: any) => ({
      month: String(r.month).slice(0, 7),
      category: String(r.category),
      source: String(r.source),
      count: n(r.count),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quotesRaw: (j.quotes_raw || []).map((r: any) => ({
      date: String(r.date || ''),
      category: String(r.category || ''),
      source: String(r.source || ''),
      status: String(r.status || ''),
    })).filter((r: { date: string }) => r.date).sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date)),
    keywords: (j.g_keywords || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => kw('Google', r))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .concat((j.n_keywords || []).map((r: any) => kw('Naver', r))),
    ads: (j.g_ads || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ad('Google', r))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .concat((j.n_ads || []).map((r: any) => ad('Naver', r))),
  };
}

function loadInitialCache(): { data: DashboardData; status: SyncStatus; restored: boolean } {
  try {
    const cached = localStorage.getItem('adi_data_cache');
    if (cached) {
      const j = JSON.parse(cached);
      if (
        j &&
        ((j.quotes_monthly && j.quotes_monthly.length) ||
          (j.n_adgroup_monthly && j.n_adgroup_monthly.length))
      ) {
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

  const load = useCallback(async () => {
    const c = getCfg();
    if (!c.url || !c.key) {
      setStatus((prev) => (prev !== 'live' ? 'unlinked' : prev));
      return;
    }
    setIsSyncing(true);

    try {
      const fetchUrl = c.url + (c.url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(c.key);
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      const parsed = fromApi(j);
      setData(parsed);
      setStatus('live');
      try {
        localStorage.setItem('adi_data_cache', JSON.stringify(j));
      } catch {
        // ignore quota errors
      }
    } catch (e) {
      console.error('[its-ad-insight] 실데이터 동기화 오류 (화면 데이터 유지):', e);
      setStatus((prev) => {
        if (prev === 'live') return 'live';
        return 'error';
      });
      // 기존에 live 데이터가 없으면 로컬 정적 백업 data/latest.json 시도
      try {
        const localRes = await fetch('data/latest.json');
        if (localRes.ok) {
          const localJ = await localRes.json();
          setData((prevData) => {
            if (prevData.spend.length > 0 || prevData.quotes.length > 0) return prevData;
            try {
              localStorage.setItem('adi_data_cache', JSON.stringify(localJ));
            } catch {
              // ignore
            }
            return fromApi(localJ);
          });
          setStatus('live');
        }
      } catch {
        // ignore fallback failure
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!initial.restored) {
      fetch('data/latest.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((localJ) => {
          if (localJ) {
            setData((prev) => {
              if (prev.spend.length > 0 || prev.quotes.length > 0) return prev;
              try {
                localStorage.setItem('adi_data_cache', JSON.stringify(localJ));
              } catch {
                // ignore
              }
              return fromApi(localJ);
            });
            setStatus('live');
          }
        })
        .catch(() => {})
        .finally(() => {
          load();
        });
    } else {
      load();
    }

    const timer = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [initial.restored, load]);

  useEffect(() => {
    document.body.classList.toggle('live', status === 'live');
  }, [status]);

  return { data, categoryMap, status, isSyncing, load };
}
