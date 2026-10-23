import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** 현재 페이지 양옆으로 보여 줄 번호 개수 */
  delta?: number;
}

/** [‹] 1 … 4 5 [6] 7 8 … 20 [›] — 처음·끝 번호와 현재 주변만 보이고 나머지는 … 로 줄인다 */
export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onChange, delta = 2 }) => {
  const pageNumbers = useMemo((): (number | 'ellipsis')[] => {
    const result: (number | 'ellipsis')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
        result.push(i);
      } else if (result[result.length - 1] !== 'ellipsis') {
        result.push('ellipsis');
      }
    }
    return result;
  }, [page, totalPages, delta]);

  return (
    <nav className="pagination" aria-label="페이지 이동">
      <button
        type="button"
        className="pag-btn pag-arrow"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        title="이전 페이지"
        aria-label="이전 페이지"
      >
        <ChevronLeft size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {pageNumbers.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`el-${i}`} className="pag-ellipsis">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pag-btn${p === page ? ' active' : ''}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        className="pag-btn pag-arrow"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        title="다음 페이지"
        aria-label="다음 페이지"
      >
        <ChevronRight size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </nav>
  );
};
