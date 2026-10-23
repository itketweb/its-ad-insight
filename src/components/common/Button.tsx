import React from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'default' | 'primary' | 'link';
type ButtonSize = 'md' | 'sm' | 'xs';

interface ButtonStyleProps {
  /** default: 기본 버튼 · primary: 강조(파란 배경) · link: 밑줄 글자 버튼 */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 함께 표시할 Lucide 아이콘 */
  icon?: LucideIcon;
  /** 아이콘 위치 — end 는 "열기 ↗" 처럼 글자 뒤에 둔다 */
  iconPosition?: 'start' | 'end';
  /** 아이콘만 있는 버튼 — aria-label 을 꼭 함께 넘긴다 */
  iconOnly?: boolean;
}

const ICON_SIZE: Record<ButtonSize, number> = { md: 16, sm: 14, xs: 13 };

const buttonClass = (
  { variant = 'default', size = 'md', icon, iconOnly }: ButtonStyleProps,
  className?: string
) => {
  const base =
    variant === 'link'
      ? 'link-btn'
      : `btn${variant === 'primary' ? ' acc' : ''}${size !== 'md' ? ` btn-${size}` : ''}${iconOnly ? ' ic' : icon ? ' btn-icon' : ''}`;
  return className ? `${base} ${className}` : base;
};

const renderContent = (
  { icon: Icon, iconPosition = 'start', size = 'md' }: ButtonStyleProps,
  children: React.ReactNode
) => {
  const iconEl = Icon && <Icon size={ICON_SIZE[size]} aria-hidden="true" />;
  const label = children != null && children !== false && (Icon ? <span>{children}</span> : children);
  return iconPosition === 'end' ? <>{label}{iconEl}</> : <>{iconEl}{label}</>;
};

export interface ButtonProps extends ButtonStyleProps, React.ButtonHTMLAttributes<HTMLButtonElement> {}

/** 대시보드 공용 버튼. 화면별 모양은 className(btn-xxx)으로 덧입힌다 */
export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  icon,
  iconPosition,
  iconOnly,
  className,
  type = 'button',
  children,
  ...rest
}) => (
  <button {...rest} type={type} className={buttonClass({ variant, size, icon, iconOnly }, className)}>
    {renderContent({ icon, iconPosition, size }, children)}
  </button>
);

export interface ButtonLinkProps extends ButtonStyleProps, React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

/** 버튼 모양의 링크 — 외부 링크는 새 탭으로 연다 */
export const ButtonLink: React.FC<ButtonLinkProps> = ({
  variant,
  size,
  icon,
  iconPosition,
  iconOnly,
  className,
  href,
  target = '_blank',
  rel = 'noopener noreferrer',
  children,
  ...rest
}) => (
  <a {...rest} href={href} target={target} rel={rel} className={buttonClass({ variant, size, icon, iconOnly }, className)}>
    {renderContent({ icon, iconPosition, size }, children)}
  </a>
);
