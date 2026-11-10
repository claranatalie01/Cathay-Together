import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    if (title === undefined) return;
    document.title = title ? `${title} · Cathay Together` : 'Cathay Together';
  }, [title]);
}
