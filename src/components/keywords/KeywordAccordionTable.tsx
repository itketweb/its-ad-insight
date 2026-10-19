import React, { useState } from 'react';
import type { CampaignKeywordBucket, KeywordGroup } from '../../types/dashboard';
import { fmt } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { MediaPill } from '../common/MediaPill';

interface KeywordAccordionTableProps {
  topGroups: KeywordGroup[];
  campaigns: CampaignKeywordBucket[];
  media: 'all' | 'Google' | 'Naver';
  type: 'SA' | 'DA';
  kwTabIdx: number;
  onChangeTab: (idx: number) => void;
}

export const KeywordAccordionTable: React.FC<KeywordAccordionTableProps> = ({
  topGroups,
  campaigns,
  media,
  type,
  kwTabIdx,
  onChangeTab,
}) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [expandedKwGroups, setExpandedKwGroups] = useState<Set<string>>(new Set());

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

  // 같은 캠페인 이름이 Google·Naver 양쪽에 있으면 탭에 매체를 붙인다
  const dupNames = new Set(
    campaigns.map((c) => c.campaign.trim()).filter((n, i, arr) => arr.indexOf(n) !== i)
  );
  const campLabel = (c: CampaignKeywordBucket) => {
    const name = c.campaign.trim();
    const full = dupNames.has(name) ? `${c.media[0]} · ${name}` : name;
    return full.length > 13 ? full.slice(0, 12) + '…' : full;
  };

  const safeKwIdx = kwTabIdx >= 0 && kwTabIdx <= campaigns.length ? kwTabIdx : 0;
  const selectedCamp = safeKwIdx > 0 ? campaigns[safeKwIdx - 1] : null;
  const displayGroups = selectedCamp ? selectedCamp.groups : topGroups;

  return (
    <div className="card" id="kw-list">
      <h3 id="ttKw">
        {type === 'DA' ? (
          '키워드'
        ) : !campaigns.length ? (
          <span>
            키워드 <span className="muted">최근 30일 · 광고비 상위 캠페인</span>
          </span>
        ) : safeKwIdx === 0 ? (
          <span>
            키워드{' '}
            <span className="muted">
              최근 30일 · 광고비 상위 {topGroups.length}개 그룹, 그룹당 상위 10개
            </span>
          </span>
        ) : (
          <span>
            키워드{' '}
            <span className="muted">
              {selectedCamp && <MediaPill media={selectedCamp.media} />} {selectedCamp?.campaign}
              <small className="kw-head-sub">({selectedCamp?.groups.length}개 광고그룹)</small>
            </span>
          </span>
        )}
      </h3>

      {type === 'SA' && campaigns.length > 0 && (
        <div id="kwTabBar" className="kw-tabs">
          {['전체', ...campaigns.map(campLabel)].map((lbl, i) => (
            <button
              key={i}
              className={safeKwIdx === i ? 'on' : ''}
              title={
                i === 0
                  ? '전체 (상위 10개 광고그룹)'
                  : `${campaigns[i - 1].media} · ${campaigns[i - 1].campaign} (${campaigns[i - 1].groups.length}개 그룹)`
              }
              onClick={() => onChangeTab(i)}
            >
              {lbl}
            </button>
          ))}
        </div>
      )}

      <div className="tw">
        <table className="stk" id="tbKw">
          {type === 'DA' ? (
            <tbody>
              <tr>
                <td>
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
              <colgroup>
                <col className="col-kw-name" />
                <col className="col-kw-bid" />
                <col className="col-kw-imp" />
                <col className="col-kw-clk" />
                <col className="col-kw-ctr" />
                <col className="col-kw-conv" />
                <col className="col-kw-cost" />
              </colgroup>
              <thead>
                <tr>
                  <th>캠페인 › 광고그룹 › 키워드</th>
                  <th className="n">현재 입찰가</th>
                  <th className="n">노출</th>
                  <th className="n">클릭</th>
                  <th className="n">CTR</th>
                  <th className="n">전환</th>
                  <th className="n">광고비</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      {media === 'Google' ? (
                        <>
                          수집된 Google 검색광고 키워드가 없습니다.
                          <br />
                          <small className="muted">
                            Google Ads 스크립트 실행 후 자동 수집됩니다.
                          </small>
                        </>
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
              <colgroup>
                <col className="col-kw-name" />
                <col className="col-kw-bid" />
                <col className="col-kw-imp" />
                <col className="col-kw-clk" />
                <col className="col-kw-ctr" />
                <col className="col-kw-conv" />
                <col className="col-kw-cost" />
              </colgroup>
              <thead>
                <tr>
                  <th>{selectedCamp ? '광고그룹 › 키워드' : '캠페인 › 광고그룹 › 키워드'}</th>
                  <th className="n">현재 입찰가</th>
                  <th className="n">노출</th>
                  <th className="n">클릭</th>
                  <th className="n">CTR</th>
                  <th className="n">전환</th>
                  <th className="n">광고비</th>
                </tr>
              </thead>
              <tbody>
                {displayGroups.map((g) => {
                  const groupKey = `${g.media}-${g.campaign}-${g.adgroup}`;
                  const isOpen = openGroups.has(groupKey);
                  const isKwExpanded = expandedKwGroups.has(groupKey);
                  const allSortedKws = [...g.list].sort(
                    (a, b) => b.cost - a.cost || b.clk - a.clk
                  );
                  const sortedKws = isKwExpanded ? allSortedKws : allSortedKws.slice(0, 10);
                  const remainCount = allSortedKws.length - 10;
                  const grpImp = g.list.reduce((a, k) => a + k.imp, 0);
                  const grpClk = g.list.reduce((a, k) => a + k.clk, 0);
                  const grpConv = g.list.reduce((a, k) => a + k.conv, 0);

                  return (
                    <React.Fragment key={groupKey}>
                      <tr
                        className="grp grp-accordion"
                        onClick={() => toggleGroup(groupKey)}
                        title={isOpen ? '클릭하여 키워드 목록 접기' : '클릭하여 키워드 목록 펼치기'}
                      >
                        <td>
                          <div className="grp-acc-cell">
                            <span className="grp-acc-main">
                              <svg
                                className={`grp-acc-chev${isOpen ? ' open' : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.25"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              <span className="grp-acc-title">
                                {selectedCamp ? g.adgroup : `${g.campaign} › ${g.adgroup}`}
                              </span>
                              <small className="grp-acc-cnt">
                                ({g.list.length}개 키워드{!isOpen ? ' · 접힘' : ''})
                              </small>
                            </span>
                            {!selectedCamp && (
                              <span className="grp-acc-pill">
                                <MediaPill media={g.media} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="n grp-dash">–</td>
                        <td className="n">{fmt(grpImp)}</td>
                        <td className="n">{fmt(grpClk)}</td>
                        <td className="n">
                          {grpImp ? `${((grpClk / grpImp) * 100).toFixed(1)}%` : '–'}
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
                            <td className="n">{fmt(k.bid)}원</td>
                            <td className="n">{fmt(k.imp)}</td>
                            <td className="n">{fmt(k.clk)}</td>
                            <td className="n">
                              {k.imp ? `${((k.clk / k.imp) * 100).toFixed(1)}%` : '–'}
                            </td>
                            <td className="n">{fmt(k.conv)}</td>
                            <td className="n">{fmt(k.cost)}원</td>
                          </tr>
                        ))}

                      {isOpen && remainCount > 0 && (
                        <tr className="kw-more-row">
                          <td colSpan={7}>
                            <button
                              type="button"
                              className="kw-more-btn"
                              onClick={() => toggleExpandKwGroup(groupKey)}
                            >
                              <span>
                                {isKwExpanded
                                  ? '상위 10개만 보기'
                                  : `키워드 더보기 (+${remainCount}개)`}
                              </span>
                              <svg
                                className={isKwExpanded ? 'open' : ''}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.25"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
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
        <p className="tbl-src">
          단위: 원·회&nbsp;
          <span>
            Google SA —{' '}
            <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener">
              Google Ads
            </a>{' '}
            API 자동 수집
          </span>
          <span>
            Naver SA —{' '}
            <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener">
              네이버 검색광고
            </a>{' '}
            API 자동 수집
          </span>
        </p>
      </div>
    </div>
  );
};
