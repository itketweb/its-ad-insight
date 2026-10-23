import React from 'react';

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** 대시보드 공용 입력칸 (검색·비밀번호 등) */
export const TextInput: React.FC<TextInputProps> = ({ className, type = 'text', ...rest }) => (
  <input {...rest} type={type} className={`input${className ? ` ${className}` : ''}`} />
);
