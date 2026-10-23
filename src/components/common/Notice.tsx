import React from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';

export interface NoticeProps {
  /** ok: 성공(초록) · warn: 경고·실패(주황) */
  tone: 'ok' | 'warn';
  className?: string;
  children: React.ReactNode;
}

/** 저장·연결 결과처럼 잠깐 띄우는 안내 박스 */
export const Notice: React.FC<NoticeProps> = ({ tone, className, children }) => {
  const Icon = tone === 'ok' ? CircleCheck : TriangleAlert;
  return (
    <div className={`notice ${tone}${className ? ` ${className}` : ''}`} role={tone === 'ok' ? 'status' : 'alert'}>
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
};
