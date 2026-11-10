import { useSearchParams } from 'react-router-dom';

// v2 design trial: limited to the screens that call this hook.
// `?design=v1` shows the original look for before/after comparison.
export function useDesignTheme() {
  const [params] = useSearchParams();
  const v2 = params.get('design') !== 'v1';
  return { v2, themeClass: v2 ? 'theme-v2' : '', navTheme: v2 ? 'v2' : undefined };
}
