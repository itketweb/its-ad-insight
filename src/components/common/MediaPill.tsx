import React from 'react';

interface MediaPillProps {
  media: string;
  variant?: 'g' | 'n' | 'm' | 'it' | 'etc' | '';
  id?: string;
}

function resolveVariant(media: string): string {
  if (media === 'Google') return 'g';
  if (media === 'Naver') return 'n';
  if (media === 'Meta') return 'm';
  if (media === '견적') return 'it';
  if (media === 'MDF') return 'etc';
  return '';
}

export const MediaPill: React.FC<MediaPillProps> = ({ media, variant, id }) => {
  const cls = variant !== undefined ? variant : resolveVariant(media);
  return (
    <span className={`pill${cls ? ` ${cls}` : ''}`} id={id}>
      {media}
    </span>
  );
};
