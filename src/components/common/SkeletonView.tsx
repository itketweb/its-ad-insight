import React from 'react';

interface SkeletonViewProps {
  /** 화면 제목은 데이터 없이도 알 수 있으므로 그대로 보여 준다 */
  title: string;
  /** dashboard: KPI + 차트 2개 + 표 / table: 표 위주 화면 (키워드 · 데이터 연결) */
  variant?: 'dashboard' | 'table';
}

const Bar: React.FC<{ w?: string; h?: string; className?: string }> = ({ w, h, className = '' }) => (
  <span className={`skel ${className}`.trim()} style={{ width: w, height: h }} />
);

// 순위형 막대 카드 (카테고리별 소진 · 유입 매체 비중 등)
const LIST_WIDTHS = ['90%', '70%', '55%', '40%', '28%', '18%'];
const ListCard: React.FC = () => (
  <div className="card skel-card">
    <Bar w="40%" h="1rem" />
    {LIST_WIDTHS.map((w) => (
      <div key={w} className="skel-list">
        <Bar w="5.5rem" h="0.75rem" />
        <span className="skel-list-track">
          <Bar w={w} h="1.25rem" />
        </span>
        <Bar w="3rem" h="0.75rem" />
      </div>
    ))}
  </div>
);

const TableCard: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="card skel-card">
    <Bar w="30%" h="1rem" />
    <div className="skel-table">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-row">
          <Bar w="24%" />
          <Bar w="12%" />
          <Bar w="12%" />
          <Bar w="12%" />
          <Bar w="16%" />
        </div>
      ))}
    </div>
  </div>
);

/** 첫 데이터가 오기 전(캐시 없음) 실제 화면과 같은 틀로 회색 자리표시를 보여 준다 */
export const SkeletonView: React.FC<SkeletonViewProps> = ({ title, variant = 'dashboard' }) => (
  <div className="view on skel-view" aria-busy="true">
    <span className="sr-only" role="status">
      {title} 데이터를 불러오는 중입니다.
    </span>
    <div className="mod-h" aria-hidden="true">
      <div>
        <h2>{title}</h2>
        <Bar w="18rem" h="0.875rem" className="skel-desc" />
      </div>
    </div>

    <div aria-hidden="true">
      {variant === 'dashboard' && (
        <>
          <div className="kpis">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="kpi">
                <Bar w="55%" h="0.75rem" />
                <Bar w="70%" h="1.5rem" className="skel-kpi-v" />
                <Bar w="40%" h="0.75rem" />
              </div>
            ))}
          </div>
          <div className="grid">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="card skel-card">
                <Bar w="40%" h="1rem" />
                <Bar h="12rem" className="skel-chart" />
                <Bar w="50%" h="0.75rem" />
              </div>
            ))}
          </div>
          <div className="grid">
            <ListCard />
            <ListCard />
          </div>
        </>
      )}
      <TableCard rows={variant === 'table' ? 8 : 5} />
    </div>
  </div>
);
