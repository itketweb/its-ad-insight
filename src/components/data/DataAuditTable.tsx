import React from 'react';
import type { DataAuditReport } from '../../utils/dataAudit';
import { TableFootnote } from '../common/TableFootnote';
import { StatusBadge } from '../common/StatusBadge';

interface DataAuditTableProps {
  audit: DataAuditReport;
}

export const DataAuditTable: React.FC<DataAuditTableProps> = ({ audit }) => {
  return (
    <section id="data-audit-section">
      <h2 className="sec">
        실시간 데이터 매칭 · 통계 무결성 검증{' '}
        <StatusBadge level={audit.overallLevel === 'ok' ? 'ok' : 'chk'}>
          {audit.passedCount}/{audit.totalCount} 항목 통과
        </StatusBadge>
      </h2>
      <div className="card tw">
        <table className="stk" id="tbDataAudit">
          <thead>
            <tr>
              <th>검증 항목</th>
              <th>실시간 대조 수치 및 검증 상세</th>
              <th className="c">결과</th>
            </tr>
          </thead>
          <tbody>
            {audit.checks.map((chk) => (
              <tr key={chk.id}>
                <td>
                  <b>{chk.title}</b>
                </td>
                <td>
                  <div>{chk.summary}</div>
                  <div className="sub-t">{chk.detail}</div>
                </td>
                <td className="c">
                  <StatusBadge level={chk.level}>
                    {chk.badgeText}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TableFootnote
          basis="검증 근거: 취합 스프레드시트 11개 시트 전수 대조 · 견적 및 광고비 교차 검증 엔진 (dataAudit.ts)"
          sources={[
            '검증 주기 — Apps Script 15분 자동 동기화 시 실시간 실행',
            '오차 판정 기준 — 누락 0건 (100% 무결성 보장)',
          ]}
        />
      </div>
    </section>
  );
};
