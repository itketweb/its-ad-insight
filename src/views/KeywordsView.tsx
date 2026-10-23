import React, { useState } from 'react';
import type {
  AdRow,
  CampaignKeywordBucket,
  CategoryMap,
  DashboardData,
  KeywordGroup,
  KeywordRow,
  SyncStatus,
} from '../types/dashboard';
import { catSum, catsOf, mLabel, THIS_M } from '../utils/format';
import { adStatKey, groupAdsByAdgroup, selectRoundRobinAds, type AdStat } from '../utils/creativeImage';
import { EXTERNAL_LINKS } from '../utils/constants';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { SegmentedControl } from '../components/common/SegmentedControl';
import {
  CategoryFilter,
  buildCategoryFilter,
  matchesCategory,
  useCategoryFilterState,
} from '../components/common/CategoryFilter';
import { PeriodNavSlot } from '../components/common/PeriodNav';
import { KeywordCategoryTable } from '../components/keywords/KeywordCategoryTable';
import { KeywordAccordionTable } from '../components/keywords/KeywordAccordionTable';
import { AdCreativesList } from '../components/keywords/AdCreativesList';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';

interface KeywordsViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
  /** 실데이터를 받는 중 (화면은 저장해 둔 이전 데이터로 먼저 그린다) */
  isSyncing?: boolean;
  selectedMonth?: string;
}

const KEYWORDS_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '키워드·소재·입찰가·품질지수 포함' },
];

export const KeywordsView: React.FC<KeywordsViewProps> = ({
  data,
  categoryMap,
  status,
  isSyncing = false,
  selectedMonth,
}) => {
  const [media, setMedia] = useState<'all' | 'Google' | 'Naver'>('all');
  const [type, setType] = useState<'SA' | 'DA'>('SA');
  const [kwTabIdx, setKwTabIdx] = useState<number>(0);
  const catState = useCategoryFilterState();

  if (!data.keywords.length && !data.spend.length) {
    return (
      <div className="view on" data-view="keywords" data-title="키워드 · 소재">
        <ViewHeader
          title="키워드 · 소재 성과"
          description="광고그룹별 검색 키워드 입찰/품질/전환 지표 및 배너·확장 소재 현황"
          status={status}
        />
        <Card name="empty" id="kw-empty">
          <EmptyState message="취합된 키워드 및 소재 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요." />
        </Card>
        <SecSrc sources={KEYWORDS_SOURCES} />
      </div>
    );
  }

  const pass = (r: { media: string; type: string }) =>
    (media === 'all' || r.media === media) && r.type === type;

  const ms = [...new Set(data.spend.map((r) => r.month))].sort();
  const mo =
    (selectedMonth && ms.includes(selectedMonth) ? selectedMonth : undefined) ||
    selectedMonth ||
    ms.filter((m) => m <= THIS_M).pop() ||
    ms[ms.length - 1] ||
    THIS_M;
  const rows = data.spend.filter((r) => r.month === mo && pass(r));
  const cost = catSum(categoryMap, rows, (r) => r.cost);
  const clk = catSum(categoryMap, rows, (r) => r.clk);
  const conv = catSum(categoryMap, rows, (r) => r.conv);
  const ck = Object.keys(cost).sort((a, b) => cost[b] - cost[a]);

  // 1차/2차 카테고리 필터 — ck에 실제로 존재하는 값만 노출
  const catFilter = buildCategoryFilter(ck, catState);
  const filteredCk = ck.filter((k) => matchesCategory(k, catFilter.cat1, catFilter.cat2));

  // 키워드 그룹 집계 (SA) - 선택된 월(mo) 기준 집계
  const ks = data.keywords.filter((k) => k.month === mo && pass(k));
  // 키워드 실적이 있는 가장 이른 달 — 이보다 앞선 달은 키워드 재구성 전이라 비어 있다
  const kwFirstMonth = data.keywords
    .filter(pass)
    .map((k) => k.month)
    .sort()[0];
  const groups: Record<string, KeywordGroup> = {};
  const sumClk = (list: KeywordRow[]) => list.reduce((a, k) => a + k.clk, 0);
  ks.forEach((k) => {
    const g = [k.media, k.campaign, k.adgroup].join('\u0001');
    if (!groups[g]) {
      groups[g] = {
        media: k.media,
        campaign: k.campaign,
        adgroup: k.adgroup,
        cost: 0,
        list: [],
      };
    }
    groups[g].list.push(k);
    groups[g].cost += k.cost;
  });

  const allGroups = Object.values(groups).sort(
    (a, b) => b.cost - a.cost || sumClk(b.list) - sumClk(a.list)
  );

  // 카테고리 필터 — 광고그룹의 매핑 카테고리로 판단해 키워드 그룹과 주요 · 확장 소재에 똑같이 적용
  const inCategory = (g: { media: string; campaign: string; adgroup: string }) =>
    !catFilter.cat1 ||
    catsOf(categoryMap, {
      month: mo, media: g.media, type,
      campaign: g.campaign, adgroup: g.adgroup,
      cost: 0, imp: 0, clk: 0, conv: 0,
    }).some(({ c }) => matchesCategory(c, catFilter.cat1, catFilter.cat2));
  const activeGroups = allGroups.filter(inCategory);
  const topGroups = activeGroups;

  // 캠페인 탭: 캠페인명 단위로 묶고(같은 이름은 Google·Naver 합산) 광고비 상위 10개 캠페인
  const campMap: Record<string, CampaignKeywordBucket> = {};
  activeGroups.forEach((g) => {
    const key = g.campaign.trim();
    if (!campMap[key]) {
      campMap[key] = { medias: [], campaign: key, cost: 0, groups: [] };
    }
    if (!campMap[key].medias.includes(g.media)) {
      campMap[key].medias.push(g.media);
      campMap[key].medias.sort();
    }
    campMap[key].groups.push(g);
    campMap[key].cost += g.cost;
  });
  // 전부 넘기고, 상위 10개만 탭으로 보이며 나머지는 '더보기' 목록에 둔다
  const campaigns = Object.values(campMap).sort((a, b) => b.cost - a.cost);

  // 주요 소재: 기준월 광고비가 큰 캠페인의 소재부터
  const campCost: Record<string, number> = {};
  rows.forEach((r) => {
    const k = `${r.media}\u0001${r.campaign}`;
    campCost[k] = (campCost[k] || 0) + r.cost;
  });
  // 소재별 기준월 실적 — 캠페인 안에서는 비용(없으면 노출)이 큰 소재부터 고른다
  const adStats: Record<string, AdStat> = {};
  (data.adStats || [])
    .filter((s) => s.month === mo)
    .forEach((s) => {
      const k = adStatKey(s.media, s.adId);
      const cur = adStats[k] || (adStats[k] = { cost: 0, imp: 0, clk: 0, conv: 0 });
      cur.cost += s.cost;
      cur.imp += s.imp;
      cur.clk += s.clk;
      cur.conv += s.conv;
    });
  const adWeight = (a: AdRow) => {
    const s = adStats[adStatKey(a.media, a.adId)];
    return s ? s.cost * 1e3 + s.imp : 0;
  };
  // 광고그룹 단위로 묶어(그룹 안 소재마다 제목·설명·링크가 다를 수 있다) 캠페인마다 돌아가며 모두 넘긴다 — 개수 제한은 목록의 더보기가 맡는다
  const adGroups = selectRoundRobinAds(
    groupAdsByAdgroup(data.ads.filter((a) => pass(a) && inCategory(a)).sort((a, b) => adWeight(b) - adWeight(a))),
    Infinity,
    (g) => campCost[`${g.media}\u0001${g.campaign}`] || 0
  );

  return (
    <div className="view on" data-view="keywords" data-title="키워드 · 소재">
      <ViewHeader
        title="키워드 · 소재 성과"
        description="광고그룹별 검색 키워드 입찰/품질/전환 지표 및 배너·확장 소재 현황"
        status={status}
      />

      <div className="mock-bar">
        <SegmentedControl<'all' | 'Google' | 'Naver'>
          dataKey="media"
          options={[
            { value: 'all', label: '전체' },
            { value: 'Google', label: 'Google' },
            { value: 'Naver', label: 'Naver' },
          ]}
          value={media}
          onChange={(m) => {
            setMedia(m);
            setKwTabIdx(0);
          }}
        />
        <SegmentedControl<'SA' | 'DA'>
          dataKey="type"
          options={[
            { value: 'SA', label: 'SA' },
            { value: 'DA', label: 'DA' },
          ]}
          value={type}
          onChange={(t) => {
            setType(t);
            setKwTabIdx(0);
          }}
        />
        <PeriodNavSlot>
          <CategoryFilter filter={catFilter} />
        </PeriodNavSlot>
      </div>

      <KeywordCategoryTable
        month={mo}
        categoryKeys={filteredCk}
        costByCat={cost}
        clkByCat={clk}
        convByCat={conv}
        media={media}
        type={type}
      />

      {type === 'SA' && (
        <KeywordAccordionTable
          topGroups={topGroups}
          campaigns={campaigns}
          month={mo}
          firstMonth={kwFirstMonth}
          media={media}
          type={type}
          kwTabIdx={kwTabIdx}
          onChangeTab={setKwTabIdx}
        />
      )}

      {(type === 'SA' || adGroups.length > 0) && (
        <AdCreativesList groups={adGroups} stats={adStats} loading={isSyncing} periodLabel={`${mo.slice(0, 4)}년 ${mLabel(mo)}`} media={media} type={type} />
      )}
      <SecSrc sources={KEYWORDS_SOURCES} />
    </div>
  );
};
