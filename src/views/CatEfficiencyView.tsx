import React from 'react';
import type { CategoryBarItem, CategoryMap, DashboardData, SyncStatus } from '../types/dashboard';
import { catSum, fmt, mLabel, prevM, sumBy, THIS_M } from '../utils/format';
import { KpiCard } from '../components/charts/KpiCard';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';

interface CatEfficiencyViewProps {
  data: DashboardData;
  categoryMap: CategoryMap;
  status: SyncStatus;
}

export const CatEfficiencyView: React.FC<CatEfficiencyViewProps> = ({
  data,
  categoryMap,
  status,
}) => {
  const live = status === 'live';

  if (!data.spend.length) {
    return (
      <div className="view on" data-view="cat-efficiency" data-title="카테고리 효율">
        <div className="mod-h">
          <div>
            <h2>카테고리 효율 분석</h2>
            <p>카테고리별 광고비 소진 대비 견적 획득 성과 및 획득단가(CPA) 비교</p>
          </div>
          <span className={`ex${live ? ' live' : ''}`} data-src>
            {live ? '실제 취합 데이터' : '데이터 대기 중'}
          </span>
        </div>
        <div className="kpis" id="kpiCatEff">
          <div className="kpi">
            <div className="l">카테고리 데이터</div>
            <div className="v">–</div>
            <div className="d flat">데이터 연결 필요</div>
          </div>
        </div>
        <div className="card">
          <div className="empty">취합된 데이터가 없습니다.</div>
        </div>
      </div>
    );
  }

  const allMonths = [...new Set(data.spend.map((r) => r.month))].sort();
  const curM = allMonths.filter((m) => m <= THIS_M).pop() || allMonths[allMonths.length - 1];
  const pv = prevM(curM);

  const rowsCur = data.spend.filter((r) => r.month === curM);
  const rowsPrev = data.spend.filter((r) => r.month === pv);
  const catSpendCur = catSum(categoryMap, rowsCur, (r) => r.cost);
  const catSpendPrev = catSum(categoryMap, rowsPrev, (r) => r.cost);
  const catClk = catSum(categoryMap, rowsCur, (r) => r.clk);
  const catConv = catSum(categoryMap, rowsCur, (r) => r.conv);

  const qOf = (mo: string, c: string) =>
    data.quotes
      .filter((r) => r.month === mo && r.category === c)
      .reduce((a, r) => a + r.count, 0);

  const allCatKeys = [
    ...new Set([...Object.keys(catSpendCur), ...Object.keys(catSpendPrev)]),
  ].sort((a, b) => (catSpendCur[b] || 0) - (catSpendCur[a] || 0));

  const totSpend = sumBy(rowsCur, (r) => r.cost);
  const curQuotes = data.quotes.filter((r) => r.month === curM);
  const totQuotes = sumBy(curQuotes, (r) => r.count);

  const catData = allCatKeys.map((k) => {
    const cost = catSpendCur[k] || 0;
    const prevCost = catSpendPrev[k] || 0;
    const quotes = qOf(curM, k);
    const clk = catClk[k] || 0;
    const conv = catConv[k] || 0;
    const cpa = quotes > 0 ? cost / quotes : null;
    return {
      k,
      cost,
      prevCost,
      quotes,
      clk,
      conv,
      cpa,
      share: totSpend > 0 ? (cost / totSpend) * 100 : 0,
    };
  });

  const topSpendCat = catData[0];
  const topQuoteCat = [...catData].sort((a, b) => b.quotes - a.quotes)[0];
  const validCpaCats = catData
    .filter((c): c is typeof c & { cpa: number } => c.cpa != null && c.quotes > 0)
    .sort((a, b) => a.cpa - b.cpa);
  const bestCpaCat = validCpaCats[0];
  const avgCpa = totQuotes > 0 ? totSpend / totQuotes : 0;

  const top7 = allCatKeys.slice(0, 7);
  const rest = allCatKeys.slice(7);
  const list: CategoryBarItem[] = top7.map((k) => ({
    k,
    cur: (catSpendCur[k] || 0) / 1e4,
    prev: (catSpendPrev[k] || 0) / 1e4,
    q: qOf(curM, k),
  }));
  if (rest.length) {
    list.push({
      k: `기타 ${rest.length}개`,
      cur: sumBy(rest, (k) => catSpendCur[k] || 0) / 1e4,
      prev: sumBy(rest, (k) => catSpendPrev[k] || 0) / 1e4,
      q: sumBy(rest, (k) => qOf(curM, k)),
    });
  }

  const maxCpa = Math.max(...validCpaCats.map((c) => c.cpa), 1);
  const totClk = sumBy(rowsCur, (r) => r.clk);
  const totConv = sumBy(rowsCur, (r) => r.conv);

  return (
    <div className="view on" data-view="cat-efficiency" data-title="카테고리 효율">
      <div className="mod-h">
        <div>
          <h2>카테고리 효율 분석</h2>
          <p>카테고리별 광고비 소진 대비 견적 획득 성과 및 획득단가(CPA) 비교</p>
        </div>
        <span className={`ex${live ? ' live' : ''}`} data-src>
          {live ? '실제 취합 데이터' : '데이터 대기 중'}
        </span>
      </div>
      <p className="sec-src">
        <a href="https://ads.google.com" target="_blank" rel="noopener">
          Google Ads API
        </a>
        <a href="https://searchad.naver.com" target="_blank" rel="noopener">
          네이버 검색광고 API
        </a>
        <a
          href="https://docs.google.com/spreadsheets/d/1mxrTeh7bo50RTz_2_UNyQxtQrljoEK4-xgPy9fr8nIg/edit"
          target="_blank"
          rel="noopener"
        >
          취합 스프레드시트
        </a>
        <span>광고비·클릭·전환 + 고도몰 견적 시트 교차 집계</span>
      </p>

      <div className="kpis" id="kpiCatEff">
        <KpiCard
          label="최다 집행 카테고리"
          value={topSpendCat?.k || '–'}
          smallValue
          sub={`${fmt(topSpendCat?.cost || 0)}원 (${(topSpendCat?.share || 0).toFixed(1)}%)`}
        />
        <KpiCard
          label="최다 견적 카테고리"
          value={topQuoteCat?.k || '–'}
          smallValue
          sub={`${fmt(topQuoteCat?.quotes || 0)}건 접수`}
        />
        <KpiCard
          label="최고 효율 (최저 CPA)"
          value={bestCpaCat?.k || '–'}
          smallValue
          sub={bestCpaCat ? `건당 ${fmt(bestCpaCat.cpa)}원` : '–'}
        />
        <KpiCard
          label={`${mLabel(curM)} 전체 평균 CPA`}
          value={avgCpa ? `${fmt(avgCpa)}원` : '–'}
          sub={`광고비 ${fmt(totSpend)}원 / ${totQuotes}건`}
        />
      </div>

      <div className="grid">
        <div className="card">
          <h3 id="ttCatEff">
            <span>
              카테고리별 광고비 소진 비교{' '}
              <span className="muted">
                ({mLabel(curM)} vs {mLabel(pv)} · 만원)
              </span>
            </span>
          </h3>
          <CategoryBarChart id="chCatEff" list={list} />
          <div className="leg">
            <span>
              <i style={{ background: 'var(--bar)' }} />
              기준월
            </span>
            <span>
              <i style={{ background: 'var(--bar2)' }} />
              전월
            </span>
          </div>
        </div>
        <div className="card">
          <h3 id="ttCatCpa">
            <span>
              카테고리별 견적 획득 단가 (CPA){' '}
              <span className="muted">({mLabel(curM)} 실적 기준)</span>
            </span>
          </h3>
          <div id="chCatCpa">
            {validCpaCats.length ? (
              <div className="cpa-list">
                {validCpaCats.map((c) => (
                  <div key={c.k} className="cpa-row">
                    <div className="cpa-name" title={c.k}>
                      {c.k}
                    </div>
                    <div className="cpa-track">
                      <div
                        className="cpa-bar"
                        style={{ width: `${Math.max(5, Math.round((c.cpa / maxCpa) * 100))}%` }}
                      />
                    </div>
                    <div className="cpa-info">
                      <span className="cpa-val">{fmt(c.cpa)}원</span>
                      <span className="cpa-badge">{c.quotes}건 견적</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                기준월의 견적 접수 데이터가 없어 CPA를 산출할 수 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card tw">
        <h3 id="ttCatTable">
          <span>
            카테고리별 집행 성과 및 전환 효율 상세{' '}
            <span className="muted">({mLabel(curM)} 기준)</span>
          </span>
        </h3>
        <table id="tbCatEfficiency">
          <thead>
            <tr>
              <th>카테고리</th>
              <th className="n">광고비</th>
              <th className="n">비중</th>
              <th className="n">클릭수</th>
              <th className="n">광고전환</th>
              <th className="n">접수견적</th>
              <th className="n">견적전환율</th>
              <th className="n">건당 광고비 (CPA)</th>
            </tr>
          </thead>
          <tbody>
            {catData.map((c) => {
              const convRate = c.clk > 0 ? `${((c.quotes / c.clk) * 100).toFixed(2)}%` : '–';
              return (
                <tr key={c.k}>
                  <td>
                    <b>{c.k}</b>
                  </td>
                  <td className="n">{fmt(c.cost)}원</td>
                  <td className="n">{c.share.toFixed(1)}%</td>
                  <td className="n">{fmt(c.clk)}</td>
                  <td className="n">{fmt(c.conv)}</td>
                  <td className="n">
                    <b>{c.quotes ? `${fmt(c.quotes)}건` : '–'}</b>
                  </td>
                  <td className="n">{convRate}</td>
                  <td className="n">
                    <b>{c.cpa != null ? `${fmt(c.cpa)}원` : '–'}</b>
                  </td>
                </tr>
              );
            })}
            <tr className="grp">
              <td>합계</td>
              <td className="n">{fmt(totSpend)}원</td>
              <td className="n">100.0%</td>
              <td className="n">{fmt(totClk)}</td>
              <td className="n">{fmt(totConv)}</td>
              <td className="n">
                <b>{fmt(totQuotes)}건</b>
              </td>
              <td className="n">
                {totClk > 0 ? `${((totQuotes / totClk) * 100).toFixed(2)}%` : '–'}
              </td>
              <td className="n">
                <b>{avgCpa ? `${fmt(avgCpa)}원` : '–'}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <p id="srcCatEfficiency" className="tbl-src">
          단위: 원·건&nbsp;
          <span>
            광고비·클릭·전환 —{' '}
            <a href="https://ads.google.com" target="_blank" rel="noopener">
              Google Ads
            </a>{' '}
            /{' '}
            <a href="https://searchad.naver.com" target="_blank" rel="noopener">
              네이버 검색광고
            </a>{' '}
            API 자동 수집
          </span>
          <span>접수 견적 — 아이티켓 고도몰 견적 시트 (collectQuotes)</span>
        </p>
      </div>
    </div>
  );
};
