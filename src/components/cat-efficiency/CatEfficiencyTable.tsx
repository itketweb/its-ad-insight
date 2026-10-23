import React, { useMemo, useState } from 'react';
import type { CatEfficiencyItem } from './types';
import { fmt, mLabel, sumBy } from '../../utils/format';
import { EXTERNAL_LINKS } from '../../utils/constants';
import { TableFootnote } from '../common/TableFootnote';
import { ChevronRight } from 'lucide-react';
import { useSort } from '../../hooks/useSort';
import { SortableTh } from '../common/SortableTh';
import { Card } from '../common/Card';
import { LIST_LIMIT, ShowMoreButton } from '../common/MoreButton';

interface CatEfficiencyTableProps {
  catData: CatEfficiencyItem[];
  curM: string;
  totSpend: number;
  totClk: number;
  totConv: number;
  totQuotes: number;
  avgCpa: number;
}

type SortKey = 'k' | 'cost' | 'share' | 'clk' | 'conv' | 'quotes' | 'convRate' | 'cpa';

interface ParentGroup {
  parentKey: string;
  items: CatEfficiencyItem[];
  cost: number;
  clk: number;
  conv: number;
  quotes: number;
  share: number;
  cpa: number | null;
}

export const CatEfficiencyTable: React.FC<CatEfficiencyTableProps> = ({
  catData,
  curM,
  totSpend,
  totClk,
  totConv,
  totQuotes,
  avgCpa,
}) => {
  const { sortKey, sortOrder, toggleSort } = useSort<SortKey>('cost');
  const [showAll, setShowAll] = useState(false);
  const [openParents, setOpenParents] = useState<Set<string>>(new Set());


  const toggleParent = (key: string) =>
    setOpenParents((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // 1차·2차 카테고리 그룹화
  const parentGroups = useMemo((): ParentGroup[] => {
    const map: Record<string, CatEfficiencyItem[]> = {};
    const order: string[] = [];

    catData.forEach((item) => {
      const sep = item.k.indexOf(' > ');
      const parentKey = sep >= 0 ? item.k.slice(0, sep) : item.k;
      if (!map[parentKey]) { map[parentKey] = []; order.push(parentKey); }
      map[parentKey].push(item);
    });

    return order.map((parentKey) => {
      const items = map[parentKey];
      const cost    = sumBy(items, (i) => i.cost);
      const clk     = sumBy(items, (i) => i.clk);
      const conv    = sumBy(items, (i) => i.conv);
      const quotes  = sumBy(items, (i) => i.quotes);
      const share   = totSpend > 0 ? (cost / totSpend) * 100 : 0;
      const cpa     = quotes > 0 ? cost / quotes : null;
      return { parentKey, items, cost, clk, conv, quotes, share, cpa };
    });
  }, [catData, totSpend]);

  const sortedGroups = useMemo(() => {
    return [...parentGroups].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'k') {
        diff = a.parentKey.localeCompare(b.parentKey);
      } else if (sortKey === 'convRate') {
        const ra = a.clk > 0 ? a.quotes / a.clk : 0;
        const rb = b.clk > 0 ? b.quotes / b.clk : 0;
        diff = ra - rb;
      } else if (sortKey === 'cpa') {
        diff = (a.cpa ?? Infinity) - (b.cpa ?? Infinity);
      } else if (sortKey === 'share') {
        diff = a.share - b.share;
      } else {
        diff = (a[sortKey as 'cost' | 'clk' | 'conv' | 'quotes'] as number)
             - (b[sortKey as 'cost' | 'clk' | 'conv' | 'quotes'] as number);
      }
      return sortOrder === 'desc' ? -diff : diff;
    });
  }, [parentGroups, sortKey, sortOrder]);

  const th = (label: string, key: SortKey, align = 'n') => (
    <SortableTh sortKey={key} activeKey={sortKey} order={sortOrder} onSort={toggleSort} className={align || undefined}>
      {label}
    </SortableTh>
  );

  const convRateStr = (quotes: number, clk: number) =>
    clk > 0 ? `${((quotes / clk) * 100).toFixed(2)}%` : '–';

  const cpaStr = (cpa: number | null) =>
    cpa != null ? `${fmt(cpa)}원` : '–';

  return (
    <Card name="cat-table" tableWrap id="cat-table">
      <h3 id="ttCatTable">
        카테고리별 집행 성과 및 전환 효율 상세
        <span className="muted">({mLabel(curM)} 기준)</span>
      </h3>
      <table className="stk" id="tbCatEfficiency">
        <colgroup>
          <col className="col-eff-name" />
          <col className="col-eff-cost" />
          <col className="col-eff-share" />
          <col className="col-eff-clk" />
          <col className="col-eff-conv" />
          <col className="col-eff-quotes" />
          <col className="col-eff-rate" />
          <col className="col-eff-cpa" />
        </colgroup>
        <thead>
          <tr>
            {th('카테고리', 'k', '')}
            {th('광고비', 'cost')}
            {th('비중', 'share')}
            {th('클릭수', 'clk')}
            {th('광고전환', 'conv')}
            {th('접수견적', 'quotes')}
            {th('견적전환율', 'convRate')}
            {th('건당 광고비 (CPA)', 'cpa')}
          </tr>
        </thead>
        <tbody>
          {sortedGroups.slice(0, showAll ? undefined : LIST_LIMIT).map(({ parentKey, items, cost, clk, conv, quotes, share, cpa }) => {
            const hasChildren = items.length > 1 || items[0].k !== parentKey;
            const isOpen = openParents.has(parentKey);

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
                      <span className="kw-cat-child-count">{items.length}개</span>
                    )}
                  </td>
                  <td className="n">{fmt(cost)}원</td>
                  <td className="n">{share.toFixed(1)}%</td>
                  <td className="n">{fmt(clk)}</td>
                  <td className="n">{fmt(conv)}</td>
                  <td className="n"><b>{quotes ? `${fmt(quotes)}건` : '–'}</b></td>
                  <td className="n">{convRateStr(quotes, clk)}</td>
                  <td className="n"><b>{cpaStr(cpa)}</b></td>
                </tr>

                {hasChildren && isOpen && items.map((item) => {
                  const childLabel = item.k.slice(parentKey.length + 3);
                  return (
                    <tr key={item.k} className="kw-cat-child">
                      <td className="kw-cat-child-label">{childLabel}</td>
                      <td className="n">{fmt(item.cost)}원</td>
                      <td className="n">{totSpend > 0 ? `${((item.cost / totSpend) * 100).toFixed(1)}%` : '–'}</td>
                      <td className="n">{fmt(item.clk)}</td>
                      <td className="n">{fmt(item.conv)}</td>
                      <td className="n">{item.quotes ? `${fmt(item.quotes)}건` : '–'}</td>
                      <td className="n">{convRateStr(item.quotes, item.clk)}</td>
                      <td className="n">{cpaStr(item.cpa)}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          <tr className="grp">
            <td>합계</td>
            <td className="n">{fmt(totSpend)}원</td>
            <td className="n">100.0%</td>
            <td className="n">{fmt(totClk)}</td>
            <td className="n">{fmt(totConv)}</td>
            <td className="n"><b>{fmt(totQuotes)}건</b></td>
            <td className="n">{totClk > 0 ? `${((totQuotes / totClk) * 100).toFixed(2)}%` : '–'}</td>
            <td className="n"><b>{avgCpa ? `${fmt(avgCpa)}원` : '–'}</b></td>
          </tr>
        </tbody>
      </table>
      <ShowMoreButton total={sortedGroups.length} expanded={showAll} onToggle={() => setShowAll((v) => !v)} />
      <TableFootnote
        id="srcCatEfficiency"
        unit="원·건"
        basis="산출 근거: 견적전환율 = (접수견적 ÷ 클릭수) × 100 · CPA = 광고비 ÷ 접수견적"
        sources={[
          <span key="ads">
            광고비·클릭·전환 —{' '}
            <a href={EXTERNAL_LINKS.googleAds} target="_blank" rel="noopener">Google Ads</a>{' '}
            /{' '}
            <a href={EXTERNAL_LINKS.naverSearchAd} target="_blank" rel="noopener">네이버 검색광고</a>{' '}
            API 자동 수집
          </span>,
          '접수 견적 — 아이티켓 고도몰 견적 시트 (collectQuotes)',
        ]}
      />
    </Card>
  );
};
