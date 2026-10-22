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
      <svg
        className={open ? 'open' : ''}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
