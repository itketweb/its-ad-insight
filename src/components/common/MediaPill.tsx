import React from 'react';

interface MediaPillProps {
  media: string;
  variant?: 'g' | 'n' | 'm' | 'it' | 'etc' | '';
  id?: string;
  iconOnly?: boolean;
  size?: number;
}

export const GoogleLogo: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.37 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const NaverLogo: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path
      fill="#03C75A"
      d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
    />
  </svg>
);

function resolveVariant(media: string): string {
  if (media === 'Google') return 'g';
  if (media === 'Naver') return 'n';
  if (media === 'Meta') return 'm';
  if (media === '견적') return 'it';
  if (media === 'MDF') return 'etc';
  return '';
}

export const MediaPill: React.FC<MediaPillProps> = ({ media, variant, id, iconOnly, size }) => {
  const cls = variant !== undefined ? variant : resolveVariant(media);

  if (iconOnly) {
    const s = size || 14;
    let icon = null;
    if (cls === 'g') icon = <GoogleLogo size={s} />;
    else if (cls === 'n') icon = <NaverLogo size={s} />;

    if (icon) {
      return (
        <span
          className={`pill icon-only${cls ? ` ${cls}` : ''}`}
          id={id}
          title={media}
          aria-label={media}
          style={size ? { width: size, height: size, minWidth: size } : undefined}
        >
          {icon}
        </span>
      );
    }
  }

  return (
    <span className={`pill${cls ? ` ${cls}` : ''}`} id={id}>
      {media}
    </span>
  );
};
