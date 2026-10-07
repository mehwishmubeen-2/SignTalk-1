import { useEffect } from 'react';
import { useLocation } from 'react-router';

// React Router preserves scroll position between route changes; reset it on navigation.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
