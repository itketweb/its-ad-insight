import { ChevronDown } from 'lucide-react';

interface MoreButtonProps {
  /** 버튼 라벨 */
  label: string;
  /** 펼친 상태 — 화살표가 위쪽을 향한다 */
  open?: boolean;
  onClick: () => void;
  /** 이벤트/QA 훅용 data-btn 값 */
  dataBtn?: string;
}

/** 목록·표 하단의 '더보기 / 접기' 버튼. 탭 바 '더보기'와 같은 톤(0.75rem·화살표)으로 통일한다. */
export function MoreButton({ label, open = false, onClick, dataBtn }: MoreButtonProps) {
  return (
    <button type="button" className="more-btn" data-btn={dataBtn} aria-expanded={open} onClick={onClick}>
      <span>{label}</span>
      <ChevronDown className={open ? 'open' : ''} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

/** 카테고리 목록 기본 표시 개수 — 나머지는 '더보기'로 한 번에 펼친다 */
export const LIST_LIMIT = 10;

interface ShowMoreButtonProps {
  /** 전체 개수 */
  total: number;
  /** 펼쳐서 전부 보이는 중인지 */
  expanded: boolean;
  onToggle: () => void;
  /** 버튼 이름 앞 낱말 (예: 카테고리) */
  noun?: string;
  limit?: number;
  dataBtn?: string;
}

/** 목록 아래 '○○ 더보기 (+N개 · 전체 M개)' ↔ '상위 10개만 보기'. 전체가 limit 이하면 그리지 않는다 */
export function ShowMoreButton({ total, expanded, onToggle, noun = '카테고리', limit = LIST_LIMIT, dataBtn }: ShowMoreButtonProps) {
  if (total <= limit) return null;
  return (
    <div className="kw-more-wrap">
      <MoreButton
        label={expanded ? `상위 ${limit}개만 보기` : `${noun} 더보기 (+${total - limit}개 · 전체 ${total}개)`}
        open={expanded}
        dataBtn={dataBtn}
        onClick={onToggle}
      />
    </div>
  );
}
