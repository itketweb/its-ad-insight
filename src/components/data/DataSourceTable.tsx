import React from 'react';
import { MediaPill } from '../common/MediaPill';
import { TableFootnote } from '../common/TableFootnote';
import { SkelBar } from '../common/SkeletonView';
import { StatusBadge, type StatusLevel } from '../common/StatusBadge';
import { Card } from '../common/Card';

export interface DataSourceRowItem {
  media: string;
  variant: 'g' | 'n' | 'it' | 'm' | 'etc';
  titleSuffix: string;
  desc: string;
  method: string;
  liveSummary: string;
  statusLabel: string;
  statusCls: string;
}

interface DataSourceTableProps {
  sourceRows: DataSourceRowItem[];
  /** 첫 데이터를 받는 중 — 적재량·상태 칸은 자리표시 */
  loading?: boolean;
}

export const DataSourceTable: React.FC<DataSourceTableProps> = ({ sourceRows, loading = false }) => {
  return (
    <section>
      <h2 className="sec">데이터 소스별 실시간 수집 현황</h2>
      <div className="hier">
        <span>매체</span>›
        <span>
          캠페인 <small>≒ 카테고리</small>
        </span>
        ›<span>광고그룹</span>›
        <span>
          키워드 <small>SA</small> / 배너 <small>DA</small>
        </span>
      </div>
      <Card name="sources" tableWrap id="data-sources">
        <table className="stk">
          <thead>
            <tr>
              <th>소스</th>
              <th>수집 방식 · 현재 적재량</th>
              <th className="c">상태</th>
            </tr>
          </thead>
          <tbody>
            {sourceRows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <MediaPill media={row.media} variant={row.variant} /> {row.titleSuffix}
                  <div className="sub-t">{row.desc}</div>
                </td>
                <td>
                  <div>{row.method}</div>
                  <div className="sub-t">{loading ? <SkelBar w="14rem" h="0.75rem" /> : row.liveSummary}</div>
                </td>
                <td className="c">
                  {loading ? (
                    <SkelBar w="4.5rem" h="1.25rem" />
                  ) : (
                    <StatusBadge level={row.statusCls as StatusLevel}>{row.statusLabel}</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TableFootnote
          basis="데이터 기준: API 직접 연동 매체(Google·Naver·스토어) 실시간 수집 및 시트 기반 배치 수집 이원화 운영"
          sources={[
            '과거 수치는 사내 공유 폴더 월간보고서·키워드TFT 엑셀에서 1회 정규화 이관해 전년·전분기 비교에 사용',
          ]}
        />
      </Card>
    </section>
  );
};
