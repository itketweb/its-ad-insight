import React, { useMemo, useState } from 'react';
import { fmt, mLabel, sumBy, THIS_M } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { TableFootnote } from '../common/TableFootnote';
import { LIST_LIMIT, ShowMoreButton } from '../common/MoreButton';
import { ChevronRight } from 'lucide-react';
import { Card } from '../common/Card';

interface KeywordCategoryTableProps {
  month?: string;
  categoryKeys: string[];
  costByCat: Record<string, number>;
  clkByCat: Record<string, number>;
  convByCat: Record<string, number>;
  media: 'all' | 'Google' | 'Naver';
  type: 'SA' | 'DA';
}

function cpa(cost: number, conv: number) {
  return conv ? `${fmt(cost / conv)}원` : '–';
}

export const KeywordCategoryTable: React.FC<KeywordCategoryTableProps> = ({
  month = THIS_M,
  categoryKeys,
  costByCat,
  clkByCat,
  convByCat,
  media,
  type,
}) => {
  const [openParents, setOpenParents] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // 1차 카테고리별로 그룹화
  const { topKeys, childrenOf } = useMemo(() => {
    const childrenOf: Record<string, string[]> = {};
    const topKeys: string[] = [];
    const seen = new Set<string>();

    categoryKeys.forEach((k) => {
      const sep = k.indexOf(' > ');
      if (sep >= 0) {
        const parent = k.slice(0, sep);
        if (!childrenOf[parent]) {
          childrenOf[parent] = [];
          if (!seen.has(parent)) { topKeys.push(parent); seen.add(parent); }
        }
        childrenOf[parent].push(k);
      } else {
        if (!seen.has(k)) { topKeys.push(k); seen.add(k); }
        if (!childrenOf[k]) childrenOf[k] = [];
      }
    });

    return { topKeys, childrenOf };
  }, [categoryKeys]);

  const toggleParent = (key: string) =>
    setOpenParents((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const parentCost = (p: string) => sumBy(childrenOf[p]?.length ? childrenOf[p] : [p], (k) => costByCat[k] || 0);
  const parentClk  = (p: string) => sumBy(childrenOf[p]?.length ? childrenOf[p] : [p], (k) => clkByCat[k]  || 0);
  const parentConv = (p: string) => sumBy(childrenOf[p]?.length ? childrenOf[p] : [p], (k) => convByCat[k]  || 0);

  const totCost = sumBy(categoryKeys, (k) => costByCat[k] || 0);
  const totClk  = sumBy(categoryKeys, (k) => clkByCat[k]  || 0);
  const totConv = sumBy(categoryKeys, (k) => convByCat[k]  || 0);

  return (
    <Card name="kw-cat" id="kw-cat">
      <h3 id="ttCatConv">
        카테고리별 전환 · 소진
        <span className="muted">({mLabel(month || THIS_M)} 기준)</span>
      </h3>
      <div className="tw">
        <table className="stk" id="tbCatConv">
          <colgroup>
            <col className="col-cat-name" />
            <col className="col-cat-cost" />
            <col className="col-cat-clk" />
            <col className="col-cat-conv" />
            <col className="col-cat-cpa" />
          </colgroup>
          {categoryKeys.length ? (
            <>
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th className="n">광고비</th>
                  <th className="n">클릭</th>
                  <th className="n">전환</th>
                  <th className="n">전환당 비용</th>
                </tr>
              </thead>
              <tbody>
                {topKeys.slice(0, showAll ? undefined : LIST_LIMIT).map((parentKey) => {
                  const children = childrenOf[parentKey] || [];
                  const hasChildren = children.length > 0;
                  const isOpen = openParents.has(parentKey);
                  const cost = parentCost(parentKey);
                  const clk  = parentClk(parentKey);
                  const conv = parentConv(parentKey);

                  return (
                    <React.Fragment key={parentKey}>
                      <tr
                        className={hasChildren ? 'kw-cat-parent' : undefined}
                        onClick={hasChildren ? () => toggleParent(parentKey) : undefined}
                        style={hasChildren ? { cursor: 'pointer' } : undefined}
                      >
                        <td>
                          {hasChildren && (
                            <ChevronRight className={`kw-cat-chev${isOpen ? ' open' : ''}`} strokeWidth={2.25} aria-hidden="true" />
                          )}
                          <b>{parentKey}</b>
                          {hasChildren && (
                            <span className="kw-cat-child-count">{children.length}개</span>
                          )}
                        </td>
                        <td className="n">{fmt(cost)}원</td>
                        <td className="n">{fmt(clk)}</td>
                        <td className="n">{fmt(conv)}</td>
                        <td className="n">{cpa(cost, conv)}</td>
                      </tr>

                      {hasChildren && isOpen && children.map((childKey) => {
                        const childLabel = childKey.slice(parentKey.length + 3); // " > " = 3
                        const cc = costByCat[childKey] || 0;
                        const ck = clkByCat[childKey]  || 0;
                        const cv = convByCat[childKey]  || 0;
                        return (
                          <tr key={childKey} className="kw-cat-child">
                            <td className="kw-cat-child-label">{childLabel}</td>
                            <td className="n">{fmt(cc)}원</td>
                            <td className="n">{fmt(ck)}</td>
                            <td className="n">{fmt(cv)}</td>
                            <td className="n">{cpa(cc, cv)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                <tr className="grp">
                  <td>합계</td>
                  <td className="n"><b>{fmt(totCost)}원</b></td>
                  <td className="n">{fmt(totClk)}</td>
                  <td className="n">{fmt(totConv)}</td>
                  <td className="n"><b>{cpa(totCost, totConv)}</b></td>
                </tr>
              </tbody>
            </>
          ) : (
            <tbody>
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    {type === 'DA' ? (
                      <>
                        수집된 디스플레이 광고(DA) 데이터가 없습니다.
                        <br />
                        <small className="muted">GFA 무인 스케줄러 동기화 후 자동 집계됩니다.</small>
                      </>
                    ) : media === 'Google' ? (
                      <>
                        수집된 Google 검색광고 데이터가 없습니다.
                        <br />
                        <small className="muted">스크립트 실행 후 데이터가 집계됩니다.</small>
                      </>
                    ) : (
                      '조회 조건에 해당하는 광고 데이터가 없습니다.'
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          )}
        </table>
        <ShowMoreButton total={topKeys.length} expanded={showAll} onToggle={() => setShowAll((v) => !v)} />
        <TableFootnote
          unit="원"
          basis="산출 근거: 전환당 비용 = 광고비 ÷ 광고전환수 (SA 전환 추적 태그 기준)"
          sources={[
            <span key="src">
              출처:{' '}
              <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener">Google Ads</a>{' '}
              ·{' '}
              <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener">네이버 검색광고</a>{' '}
              API 자동 수집
            </span>,
          ]}
        />
      </div>
    </Card>
  );
};
