import React from 'react';
import type { DataAuditReport } from '../../utils/dataAudit';
import { TableFootnote } from '../common/TableFootnote';
import { SkelBar, SkelRows } from '../common/SkeletonView';
import { StatusBadge } from '../common/StatusBadge';
import { Card } from '../common/Card';

interface DataAuditTableProps {
  audit: DataAuditReport;
  /** 첫 데이터를 받는 중 — 빈 데이터로 낸 '실패' 결과 대신 자리표시 */
  loading?: boolean;
}

export const DataAuditTable: React.FC<DataAuditTableProps> = ({ audit, loading = false }) => {
  return (
    <section id="data-audit-section">
      <h2 className="sec">
        실시간 데이터 매칭 · 통계 무결성 검증{' '}
        {loading ? (
          <SkelBar w="6rem" h="1.25rem" className="skel-inline" />
        ) : (
          <StatusBadge level={audit.overallLevel === 'ok' ? 'ok' : 'chk'}>
            {audit.passedCount}/{audit.totalCount} 항목 통과
          </StatusBadge>
        )}
      </h2>
      <Card name="audit" tableWrap id="data-audit">
        <table className="stk" id="tbDataAudit">
          <thead>
            <tr>
              <th>검증 항목</th>
              <th>실시간 대조 수치 및 검증 상세</th>
              <th className="c">결과</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkelRows rows={audit.checks.length || 6} widths={['60%', '80%', '4rem']} />}
            {!loading && audit.checks.map((chk) => (
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
      </Card>
    </section>
  );
};
