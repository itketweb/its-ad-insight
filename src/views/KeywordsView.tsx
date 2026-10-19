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
import { ViewHeader, type SourceLinkItem } from '../components/common/ViewHeader';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { KeywordCategoryTable } from '../components/keywords/KeywordCategoryTable';
import { KeywordAccordionTable } from '../components/keywords/KeywordAccordionTable';
import { AdCreativesGrid } from '../components/keywords/AdCreativesGrid';

interface KeywordsViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
}

const KEYWORDS_SOURCES: SourceLinkItem[] = [
  { label: 'Google Ads API', href: EXTERNAL_LINKS.googleAds },
  { label: '네이버 검색광고 API', href: EXTERNAL_LINKS.naverSearchAd },
  { label: '취합 스프레드시트', href: EXTERNAL_LINKS.masterSheet },
  { label: '키워드·소재·입찰가·품질지수 포함' },
];

export const KeywordsView: React.FC<KeywordsViewProps> = ({ data, categoryMap, status }) => {
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
          sources={KEYWORDS_SOURCES}
        />
        <div className="card">
          <div className="empty">
            취합된 키워드 및 소재 데이터가 없습니다. 상단 [연결 설정] 버튼에서 데이터 연결을 완료해 주세요.
          </div>
        </div>
      </div>
    );
  }

  const pass = (r: { media: string; type: string }) =>
    (media === 'all' || r.media === media) && r.type === type;

  const ms = [...new Set(data.spend.map((r) => r.month))].sort();
  const mo = ms.filter((m) => m <= THIS_M).pop() || ms[ms.length - 1] || THIS_M;
  const rows = data.spend.filter((r) => r.month === mo && pass(r));
  const cost = catSum(categoryMap, rows, (r) => r.cost);
  const clk = catSum(categoryMap, rows, (r) => r.clk);
  const conv = catSum(categoryMap, rows, (r) => r.conv);
  const ck = Object.keys(cost).sort((a, b) => cost[b] - cost[a]);

  // 키워드 그룹 집계 (SA)
  const ks = data.keywords.filter(pass);
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

  // 캠페인 탭: 매체+캠페인 단위로 묶고 광고비 상위 10개 캠페인
  const campMap: Record<string, CampaignKeywordBucket> = {};
  allGroups.forEach((g) => {
    const key = [g.media, g.campaign].join('\u0001');
    if (!campMap[key]) {
      campMap[key] = { media: g.media, campaign: g.campaign, cost: 0, groups: [] };
    }
    campMap[key].groups.push(g);
    campMap[key].cost += g.cost;
  });
  const campaigns = Object.values(campMap)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const ads = selectRoundRobinAds(data.ads.filter(pass), 12);

  return (
    <div className="view on" data-view="keywords" data-title="키워드 · 소재">
      <ViewHeader
        title="키워드 · 소재 성과"
        description="광고그룹별 검색 키워드 입찰/품질/전환 지표 및 배너·확장 소재 현황"
        status={status}
        sources={KEYWORDS_SOURCES}
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
          media={media}
          type={type}
          kwTabIdx={kwTabIdx}
          onChangeTab={setKwTabIdx}
        />
      )}

      {(type === 'SA' || ads.length > 0) && (
        <AdCreativesGrid ads={ads} media={media} type={type} />
      )}
    </div>
  );
};
