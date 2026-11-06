/** 뱃지 크기 — md(기본) 24px, sm 20px. 높이는 CSS 변수 --badge-h 로 정해지고 .badge-sm 이 작은 값으로 바꾼다 */
export type BadgeSize = 'md' | 'sm';

/** 뱃지 className 에 붙일 크기 클래스 (기본 크기는 빈 문자열) */
export const badgeSizeClass = (size?: BadgeSize): string => (size === 'sm' ? 'badge-sm' : '');
