import React from 'react';

export interface FootnoteSourceItem {
  label?: string;
  text?: string;
  href?: string;
}

export interface TableFootnoteProps {
  id?: string;
  unit?: string;
  basis?: string;
  sources?: (string | FootnoteSourceItem | React.ReactNode)[];
  action?: {
    text: string;
    href: string;
  };
  className?: string;
  children?: React.ReactNode;
}

export const TableFootnote: React.FC<TableFootnoteProps> = ({
  id,
  unit,
  basis,
  sources = [],
  action,
  className = '',
  children,
}) => {
  return (
    <div id={id} className={`tbl-src ${className}`.trim()}>
      {basis &&<span className="tbl-src-basis">{basis}</span>}
      {sources.map((item, idx) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return <span key={idx}>{item}</span>;
        }
        if (React.isValidElement(item)) {
          return <span key={idx}>{item}</span>;
        }
        const srcItem = item as FootnoteSourceItem;
        return (
          <span key={idx}>
            {srcItem.label && `${srcItem.label} — `}
            {srcItem.href ? (
              <a href={srcItem.href} target="_blank" rel="noopener">
                {srcItem.text || srcItem.label}
              </a>
            ) : (
              srcItem.text
            )}
          </span>
        );
      })}
      {children}
      {action && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener"
          className="tbl-src-action"
        >
          {action.text} ↗
        </a>
      )}
      {/* 단위는 차트 범례와 같이 우측 하단에 둔다 */}
      {unit && <span className="tbl-src-unit">단위: {unit}</span>}
    </div>
  );
};
