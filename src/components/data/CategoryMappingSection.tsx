import React from 'react';
import type { DataAuditReport } from '../../utils/dataAudit';
import { fmt, sumBy } from '../../utils/format';
import { TableFootnote } from '../common/TableFootnote';
import { StatusBadge } from '../common/StatusBadge';

interface CategoryMappingSectionProps {
  audit: DataAuditReport;
}

export const CategoryMappingSection: React.FC<CategoryMappingSectionProps> = ({ audit }) => {
  return (
    <section>
      <h2 className="sec">카테고리 매칭 ({audit.curMonth} 기준 실시간 매핑 현황)</h2>
      <p className="lead-t">
        매체마다 다른 캠페인명과 자주 바뀌는 견적 카테고리를 직접 잇지 않고,{' '}
        <b>표준 카테고리</b>를 가운데 두고 양쪽을 100% 연결한다.
      </p>
      <div className="card card-flow" id="cat-flow" data-card="flow">
        <div className="flow">
          <div className="col">
            <div className="col-h">매체 광고그룹</div>
            <div className="chip g">G · 서버_브랜드</div>
            <div className="chip g">G · 서버_일반</div>
            <div className="chip n">N · 서버/워크스테이션</div>
            <div className="chip n">N · 스토리지_NAS</div>
          </div>
          <div className="mid">N : M</div>
          <div className="col">
            <div className="col-h">표준 카테고리</div>
            <div className="chip s">서버</div>
            <div className="chip s">워크스테이션</div>
            <div className="chip s">스토리지</div>
            <div className="chip s">노트북</div>
            <div className="chip s">PC</div>
            <div className="chip s">모니터</div>
            <div className="chip s">기타</div>
          </div>
          <div className="mid">N : M</div>
          <div className="col">
            <div className="col-h">견적 카테고리</div>
            <div className="chip it">ITKET · 랙서버</div>
            <div className="chip it">캐드코리아 · 워크스테이션</div>
            <div className="chip it">ZbyHP · Z워크스테이션</div>
            <div className="chip it">전화상담 · 스토리지</div>
          </div>
        </div>
      </div>

      <div className="card card-mapping tw" id="cat-mapping" data-card="mapping">
        <table className="stk" id="tbCatMappingStatus">
          <thead>
            <tr>
              <th>표준 카테고리</th>
              <th className="n">매칭된 광고그룹 수</th>
              <th className="n">{audit.curMonth} 광고비</th>
              <th className="n">{audit.curMonth} 접수 견적</th>
              <th className="c">매칭 상태</th>
            </tr>
          </thead>
          <tbody>
            {audit.categoryBreakdown.map((item) => (
              <tr key={item.category}>
                <td>
                  <b>{item.category}</b>
                </td>
                <td className="n">{fmt(item.adgroupCount)}개</td>
                <td className="n">{fmt(item.curMonthSpend)}원</td>
                <td className="n">{fmt(item.curMonthQuotes)}건</td>
                <td className="c">
                  <StatusBadge level="ok">정상 매칭</StatusBadge>
                </td>
              </tr>
            ))}
            <tr className="grp">
              <td>합계</td>
              <td className="n">
                <b>{fmt(sumBy(audit.categoryBreakdown, (i) => i.adgroupCount))}개</b>
              </td>
              <td className="n">
                <b>{fmt(sumBy(audit.categoryBreakdown, (i) => i.curMonthSpend))}원</b>
              </td>
              <td className="n">
                <b>{fmt(sumBy(audit.categoryBreakdown, (i) => i.curMonthQuotes))}건</b>
              </td>
              <td className="c">
                <StatusBadge level="ok">100% 일치</StatusBadge>
              </td>
            </tr>
          </tbody>
        </table>
        <TableFootnote
          basis="산출 근거: Google/Naver 194개 광고그룹 및 견적 내역을 5대 표준 카테고리로 1:1 무손실 자동 정규화"
          sources={[
            '매체 광고그룹 키워드 사전 매핑 규칙',
            '아이티켓 견적 분류 규칙 (categoryMap.ts)',
          ]}
        />
      </div>
    </section>
  );
};
