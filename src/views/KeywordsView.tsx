import React, { useState } from 'react';
import type {
  CampaignKeywordBucket,
  CategoryMap,
  DashboardData,
  KeywordGroup,
  KeywordRow,
  SyncStatus,
} from '../types/dashboard';
import { catSum, THIS_M } from '../utils/format';
import { selectRoundRobinAds } from '../utils/creativeImage';
import { EXTERNAL_LINKS } from '../utils/constants';
import { ViewHeader, SecSrc, type SourceLinkItem } from '../components/common/ViewHeader';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { KeywordCategoryTable } from '../components/keywords/KeywordCategoryTable';
import { KeywordAccordionTable } from '../components/keywords/KeywordAccordionTable';
import { AdCreativesGrid } from '../components/keywords/AdCreativesGrid';

interface KeywordsViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
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
  selectedMonth,
}) => {
  const [media, setMedia] = useState<'all' | 'Google' | 'Naver'>('all');
  const [type, setType] = useState<'SA' | 'DA'>('SA');
  const [kwTabIdx, setKwTabIdx] = useState<number>(0);

  if (!data.keywords.length && !data.spend.length) {
    return (
      <div className="view on" data-view="keywords" data-title="키워드 · 소재">
        <ViewHeader
          title="키워드 · 소재 성과"
          description="광고그룹별 검색 키워드 입찰/품질/전환 지표 및 배너·확장 소재 현황"
          status={status}
        />
        <div className="card">
          <div className="empty">
            취합된 키워드 및 소재 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요.
          </div>
        </div>
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
  const topGroups = allGroups.slice(0, 10);

  // 캠페인 탭: 캠페인명 단위로 묶고(같은 이름은 Google·Naver 합산) 광고비 상위 10개 캠페인
  const campMap: Record<string, CampaignKeywordBucket> = {};
  allGroups.forEach((g) => {
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
  const ads = selectRoundRobinAds(
    data.ads.filter(pass),
    12,
    (a) => campCost[`${a.media}\u0001${a.campaign}`] || 0
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
        <span className="sp" />
      </div>

      <KeywordCategoryTable
        month={mo}
        categoryKeys={ck}
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

      {(type === 'SA' || ads.length > 0) && (
        <AdCreativesGrid ads={ads} media={media} type={type} />
      )}
      <SecSrc sources={KEYWORDS_SOURCES} />
    </div>
  );
};
