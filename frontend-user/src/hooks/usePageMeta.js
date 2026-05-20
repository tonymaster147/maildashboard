import { useEffect } from 'react';
import { useSiteBranding } from '../context/SiteBrandingContext';

/**
 * Sets <title> and <meta name="description"> based on site branding for the given page key.
 * @param {'login'|'signup'|'dashboard'} pageKey
 */
export function usePageMeta(pageKey) {
  const brand = useSiteBranding();

  useEffect(() => {
    if (!brand?.meta) return;
    const page = brand.meta[pageKey];
    if (!page) return;

    if (page.title) document.title = page.title;
    else if (brand.name) document.title = brand.name;

    if (page.desc) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', page.desc);
    }
  }, [brand, pageKey]);
}
