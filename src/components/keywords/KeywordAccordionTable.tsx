import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CampaignKeywordBucket, KeywordGroup, KeywordRow } from '../../types/dashboard';
import { fmt, mLabel, THIS_M } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { MediaPill } from '../common/MediaPill';
import { TableFootnote } from '../common/TableFootnote';
import { MoreButton } from '../common/MoreButton';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSort } from '../../hooks/useSort';
import { SortableTh } from '../common/SortableTh';
import { TabButton } from '../common/TabButton';
import { Card } from '../common/Card';

interface KeywordAccordionTableProps {
  topGroups: KeywordGroup[];
  campaigns: CampaignKeywordBucket[];
  month?: string;
  /** 키워드 실적이 있는 가장 이른 달 (YYYY-MM) — 이보다 앞선 달이면 빈 표에 이유를 적는다 */
  firstMonth?: string;
  media: 'all' | 'Google' | 'Naver';
  type: 'SA' | 'DA';
  kwTabIdx: number;
  onChangeTab: (idx: number) => void;
}

const mediaKo = (m: string) => (m === 'Naver' ? '네이버' : m === 'Google' ? '구글' : m);
// CTR = 클릭 ÷ 노출 × 100 (노출 0 이면 –)
const ctr = (clk: number, imp: number) => (imp ? `${((clk / imp) * 100).toFixed(1)}%` : '–');

type SortKey = 'imp' | 'clk' | 'ctr' | 'conv' | 'cost';

const NUMERIC_COLS: { key: SortKey; label: string }[] = [
  { key: 'imp', label: '노출' },
  { key: 'clk', label: '클릭' },
  { key: 'ctr', label: 'CTR' },
  { key: 'conv', label: '전환' },
  { key: 'cost', label: '광고비' },
];

const getGroupMetric = (g: KeywordGroup, key: SortKey) => {
  if (key === 'cost') return g.cost;
  const imp = g.list.reduce((sum, k) => sum + k.imp, 0);
  const clk = g.list.reduce((sum, k) => sum + k.clk, 0);
  if (key === 'imp') return imp;
  if (key === 'clk') return clk;
  if (key === 'ctr') return imp > 0 ? clk / imp : 0;
  if (key === 'conv') return g.list.reduce((sum, k) => sum + k.conv, 0);
  return 0;
};

const getKwMetric = (k: KeywordRow, key: SortKey) => {
  if (key === 'cost') return k.cost;
  if (key === 'imp') return k.imp;
  if (key === 'clk') return k.clk;
  if (key === 'conv') return k.conv;
  if (key === 'ctr') return k.imp > 0 ? k.clk / k.imp : 0;
  return 0;
};
/** 탭으로 바로 보이는 캠페인 수. 나머지는 '더보기' 목록에서 고른다 */
const VISIBLE_TABS = 10;

export const KeywordAccordionTable: React.FC<KeywordAccordionTableProps> = ({
  topGroups,
  campaigns,
  month = THIS_M,
  firstMonth,
  media,
  type,
  kwTabIdx,
  onChangeTab,
}) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [expandedKwGroups, setExpandedKwGroups] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(10);
  const [moreOpen, setMoreOpen] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const { sortKey, sortOrder, toggleSort } = useSort<SortKey>('cost');

  // 더보기 목록: 바깥 클릭·Esc 로 닫는다
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!tabBarRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
        setExpandedKwGroups((prevKw) => {
          if (!prevKw.has(groupKey)) return prevKw;
          const nextKw = new Set(prevKw);
          nextKw.delete(groupKey);
          return nextKw;
        });
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const toggleExpandKwGroup = (groupKey: string) => {
    setExpandedKwGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // 같은 캠페인 이름이 Google·Naver 양쪽에 있으면 한 탭으로 합치고, 탭 오른쪽에 매체 아이콘을 모두 붙인다
  const campLabel = (c: CampaignKeywordBucket) => c.campaign.trim();

  const safeKwIdx = kwTabIdx >= 0 && kwTabIdx <= campaigns.length ? kwTabIdx : 0;
  const selectedCamp = safeKwIdx > 0 ? campaigns[safeKwIdx - 1] : null;

  // 탭 또는 월 변경 시 더보기 리셋
  const prevKey = useRef(`${month}-${safeKwIdx}`);
  if (prevKey.current !== `${month}-${safeKwIdx}`) {
    prevKey.current = `${month}-${safeKwIdx}`;
    setVisibleCount(10);
  }

  const displayGroups = selectedCamp ? selectedCamp.groups : topGroups.slice(0, visibleCount);
  const sortedDisplayGroups = useMemo(() => {
    const list = [...displayGroups];
    list.sort((a, b) => {
      const valA = getGroupMetric(a, sortKey);
      const valB = getGroupMetric(b, sortKey);
      const diff = sortOrder === 'desc' ? valB - valA : valA - valB;
      if (diff !== 0) return diff;
      return b.cost - a.cost;
    });
    return list;
  }, [displayGroups, sortKey, sortOrder]);
  const hiddenCamps = campaigns.slice(VISIBLE_TABS);
  const hiddenSelected = safeKwIdx > VISIBLE_TABS;
  const selectTab = (idx: number) => {
    setMoreOpen(false);
    onChangeTab(idx);
  };
  const campTitle = (c: CampaignKeywordBucket) =>
    `${c.medias.map(mediaKo).join('·')} · ${c.campaign} (${c.groups.length}개 그룹)`;
  const campIcons = (c: CampaignKeywordBucket) =>
    c.medias.map((m) => <MediaPill key={m} media={m} iconOnly size={10} />);
  const periodLabel = `${month.slice(0, 4)}년 ${mLabel(month)}`;

  return (
    <Card name="kw-list" id="kw-list">
      <h3 id="ttKw">
        {type === 'DA' ? (
          '키워드'
        ) : !campaigns.length ? (
          <>
            키워드
            <span className="muted">{periodLabel} · 광고비 상위 캠페인</span>
          </>
        ) : safeKwIdx === 0 ? (
          <>
            키워드
            <span className="muted">
              {periodLabel} · 광고비 상위{' '}
              {visibleCount < topGroups.length
                ? `${visibleCount} / ${topGroups.length}`
                : topGroups.length}개 그룹, 그룹당 상위 10개
            </span>
          </>
        ) : (
          <>
            키워드
            <span className="muted">
              {periodLabel} · {selectedCamp?.campaign}
              <small className="kw-head-sub">({selectedCamp?.groups.length}개 광고그룹)</small>
            </span>
          </>
        )}
      </h3>

      {type === 'SA' && campaigns.length > 0 && (
        <div id="kwTabBar" className="kw-tabs" ref={tabBarRef}>
          {['전체', ...campaigns.slice(0, VISIBLE_TABS).map(campLabel)].map((lbl, i) => (
            <TabButton
              key={i}
              className="kw-tab-btn btn-camp-tab"
              data-btn="camp-tab"
              active={safeKwIdx === i}
              label={lbl}
              title={i === 0 ? '전체 (상위 10개 광고그룹)' : campTitle(campaigns[i - 1])}
              onClick={() => selectTab(i)}
            >
              {i > 0 && campIcons(campaigns[i - 1])}
            </TabButton>
          ))}

          {hiddenCamps.length > 0 && (
            <button
              type="button"
              className={`kw-more btn-kw-more${hiddenSelected ? ' on' : ''}`}
              id="btn-kw-more"
              data-btn="kw-more"
              aria-haspopup="listbox"
              aria-expanded={moreOpen}
              title={hiddenSelected && selectedCamp ? campTitle(selectedCamp) : '광고비 11위 이하 캠페인'}
              onClick={() => setMoreOpen((v) => !v)}
            >
              {hiddenSelected && selectedCamp ? (
                <>
                  <span>{campLabel(selectedCamp)}</span>
                  {campIcons(selectedCamp)}
                </>
              ) : (
                <span>+{hiddenCamps.length}개 더보기</span>
              )}
              <ChevronDown className={`kw-more-chev${moreOpen ? ' open' : ''}`} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}

          {moreOpen && (
            <div className="kw-more-menu" role="listbox" aria-label="광고비 11위 이하 캠페인">
              {hiddenCamps.map((c, j) => {
                const idx = VISIBLE_TABS + j + 1;
                return (
                  <button
                    key={c.campaign}
                    type="button"
                    role="option"
                    aria-selected={safeKwIdx === idx}
                    className={`kw-more-item btn-kw-more-item${safeKwIdx === idx ? ' on' : ''}`}
                    data-btn="kw-more-item"
                    title={campTitle(c)}
                    onClick={() => selectTab(idx)}
                  >
                    <span className="kw-more-rank">{idx}</span>
                    <span className="kw-more-name">{campLabel(c)}</span>
                    {campIcons(c)}
                    <span className="kw-more-cost">{fmt(c.cost)}원</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="tw">
        <table className="stk" id="tbKw">
          <colgroup>
            <col className="col-kw-name" />
            <col className="col-kw-imp" />
            <col className="col-kw-clk" />
            <col className="col-kw-ctr" />
            <col className="col-kw-conv" />
            <col className="col-kw-cost" />
          </colgroup>
          {type === 'DA' ? (
            <tbody>
              <tr>
                <td colSpan={6}>
                  <div className="empty">
                    디스플레이 광고(DA)는 키워드 입찰을 진행하지 않습니다.
                    <br />
                    <small className="muted">
                      타겟팅 배너로 운영되어 키워드 목록이 없습니다.
                    </small>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : !topGroups.length ? (
            <>
              <thead>
                <tr>
                  <th>캠페인 › 광고그룹 › 키워드</th>
                  <th className="n">노출</th>
                  <th className="n">클릭</th>
                  <th className="n">CTR</th>
                  <th className="n">전환</th>
                  <th className="n">광고비</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      {media === 'Google' ? (
                        <>
                          수집된 Google 검색광고 키워드가 없습니다.
                          <br />
                          <small className="muted">
                            Google Ads 스크립트 실행 후 자동 수집됩니다.
                          </small>
                        </>
                      ) : firstMonth && month < firstMonth ? (
                        '키워드 재구성 이전 기간이라 키워드별 실적이 없습니다.'
                      ) : (
                        '조회 조건에 해당하는 키워드가 없습니다.'
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>{selectedCamp ? '광고그룹 › 키워드' : '캠페인 › 광고그룹 › 키워드'}</th>
                  {NUMERIC_COLS.map(({ key, label }) => (
                    <SortableTh key={key} sortKey={key} activeKey={sortKey} order={sortOrder} onSort={toggleSort} className="n">
                      {label}
                    </SortableTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDisplayGroups.map((g) => {
                  const groupKey = `${g.media}-${g.campaign}-${g.adgroup}`;
                  const isOpen = openGroups.has(groupKey);
                  const isKwExpanded = expandedKwGroups.has(groupKey);
                  const allSortedKws = [...g.list].sort((a, b) => {
                    const valA = getKwMetric(a, sortKey);
                    const valB = getKwMetric(b, sortKey);
                    const diff = sortOrder === 'desc' ? valB - valA : valA - valB;
                    if (diff !== 0) return diff;
                    return b.cost - a.cost || b.clk - a.clk;
                  });
                  const sortedKws = isKwExpanded ? allSortedKws : allSortedKws.slice(0, 10);
                  const remainCount = allSortedKws.length - 10;
                  const grpImp = g.list.reduce((a, k) => a + k.imp, 0);
                  const grpClk = g.list.reduce((a, k) => a + k.clk, 0);
                  const grpConv = g.list.reduce((a, k) => a + k.conv, 0);

                  return (
                    <React.Fragment key={groupKey}>
                      <tr
                        className={`grp grp-accordion grp-${g.media.toLowerCase()}`}
                        onClick={() => toggleGroup(groupKey)}
                        title={isOpen ? '클릭하여 키워드 목록 접기' : '클릭하여 키워드 목록 펼치기'}
                      >
                        <td>
                          <div className="grp-acc-cell">
                            <span className="grp-acc-main">
                              <ChevronRight className={`grp-acc-chev${isOpen ? ' open' : ''}`} strokeWidth={2.25} />
                              <span className="grp-acc-title">
                                {selectedCamp ? g.adgroup : `${g.campaign} › ${g.adgroup}`}
                              </span>
                              <small className="grp-acc-cnt">
                                ({g.list.length}개 키워드 · {mediaKo(g.media)})
                              </small>
                            </span>
                          </div>
                        </td>
                        <td className="n">{fmt(grpImp)}</td>
                        <td className="n">{fmt(grpClk)}</td>
                        <td className="n">
                          {ctr(grpClk, grpImp)}
                        </td>
                        <td className="n">{fmt(grpConv)}</td>
                        <td className="n">
                          <b>{fmt(g.cost)}원</b>
                        </td>
                      </tr>

                      {isOpen &&
                        sortedKws.map((k, ki) => (
                          <tr key={`${k.keyword}-${ki}`}>
                            <td className="ind">{k.keyword}</td>
                            <td className="n">{fmt(k.imp)}</td>
                            <td className="n">{fmt(k.clk)}</td>
                            <td className="n">
                              {ctr(k.clk, k.imp)}
                            </td>
                            <td className="n">{fmt(k.conv)}</td>
                            <td className="n">{fmt(k.cost)}원</td>
                          </tr>
                        ))}

                      {isOpen && remainCount > 0 && (
                        <tr className="kw-more-row">
                          <td colSpan={6}>
                            <MoreButton
                              label={isKwExpanded ? '상위 10개만 보기' : `키워드 더보기 (+${remainCount}개)`}
                              open={isKwExpanded}
                              dataBtn="expand"
                              onClick={() => toggleExpandKwGroup(groupKey)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </>
          )}
        </table>

        {safeKwIdx === 0 && visibleCount < topGroups.length && (
          <div className="kw-more-wrap">
            <MoreButton
              label={`그룹 더보기 (+${Math.min(topGroups.length - visibleCount, 10)}개 · 전체 ${topGroups.length}개)`}
              onClick={() => setVisibleCount((v) => Math.min(v + 10, topGroups.length))}
            />
          </div>
        )}

        <TableFootnote
          unit="원·회"
          basis={`산출 근거: ${periodLabel} 실적(당월은 수집 시점까지) · 광고비 상위 캠페인/그룹 · CTR = 클릭 ÷ 노출`}
          sources={[
            <span key="src">
              출처:{' '}
              <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener">
                Google Ads
              </a>{' '}
              ·{' '}
              <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener">
                네이버 검색광고
              </a>{' '}
              API 자동 수집
            </span>,
          ]}
        />
      </div>
    </Card>
  );
};
