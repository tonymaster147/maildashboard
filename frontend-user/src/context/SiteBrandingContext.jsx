import { createContext, useContext, useEffect, useState } from 'react';
import { getPublicSite } from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

// Fallback support email when a site has no contact_email configured.
// Used by the GET HELP 24/7 button in the topbar.
export const FALLBACK_SUPPORT_EMAIL = 'sale.makemytutor@gmail.com';

const DEFAULT_BRAND = {
  name: 'EduPro',
  nickname: null,
  logoUrl: null,
  faviconUrl: null,
  contactEmail: null,
  resolved: false
};

const SiteBrandingContext = createContext(DEFAULT_BRAND);

export const SiteBrandingProvider = ({ children }) => {
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  useEffect(() => {
    getPublicSite()
      .then(res => {
        const s = res.data?.site;
        if (s) {
          const faviconUrl = s.favicon_url
            ? (s.favicon_url.startsWith('http') ? s.favicon_url : `${API_ORIGIN}${s.favicon_url}`)
            : null;
          setBrand({
            name: s.name,
            nickname: s.nickname,
            logoUrl: s.logo_url ? (s.logo_url.startsWith('http') ? s.logo_url : `${API_ORIGIN}${s.logo_url}`) : null,
            faviconUrl,
            contactEmail: s.contact_email || null,
            resolved: true,
            siteKey: s.site_key,
            siteId: s.id,
            meta: {
              login: { title: s.meta_title_login, desc: s.meta_desc_login },
              signup: { title: s.meta_title_signup, desc: s.meta_desc_signup },
              dashboard: { title: s.meta_title_dashboard, desc: s.meta_desc_dashboard }
            }
          });
          document.title = s.name;

          // Swap the browser tab icon to the site's favicon
          if (faviconUrl) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = faviconUrl;
          }

          // Inject head scripts (once)
          if (s.head_scripts && !document.getElementById('site-head-scripts')) {
            const container = document.createElement('div');
            container.id = 'site-head-scripts';
            container.innerHTML = s.head_scripts;
            // Move scripts/meta from container into <head>
            Array.from(container.children).forEach(node => {
              if (node.tagName === 'SCRIPT') {
                const s2 = document.createElement('script');
                Array.from(node.attributes).forEach(a => s2.setAttribute(a.name, a.value));
                s2.text = node.textContent;
                document.head.appendChild(s2);
              } else {
                document.head.appendChild(node.cloneNode(true));
              }
            });
          }

          // Inject body scripts (once)
          if (s.body_scripts && !document.getElementById('site-body-scripts')) {
            const container = document.createElement('div');
            container.id = 'site-body-scripts';
            container.innerHTML = s.body_scripts;
            Array.from(container.children).forEach(node => {
              if (node.tagName === 'SCRIPT') {
                const s2 = document.createElement('script');
                Array.from(node.attributes).forEach(a => s2.setAttribute(a.name, a.value));
                s2.text = node.textContent;
                document.body.appendChild(s2);
              } else {
                document.body.appendChild(node.cloneNode(true));
              }
            });
          }
        }
      })
      .catch(() => { /* keep default */ });
  }, []);

  return (
    <SiteBrandingContext.Provider value={brand}>
      {children}
    </SiteBrandingContext.Provider>
  );
};

export const useSiteBranding = () => useContext(SiteBrandingContext);
