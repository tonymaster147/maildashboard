import { createContext, useContext, useEffect, useState } from 'react';
import { getPublicSite } from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

// Fallback support email when a site has no contact_email configured.
// Used by the GET HELP 24/7 button in the topbar.
export const FALLBACK_SUPPORT_EMAIL = 'sale.makemytutor@gmail.com';

// `loading` is what consumers check before painting a brand. It is NOT the same
// as `resolved`: loading means "we don't know yet", resolved means "the API
// answered and named a site". Rendering the DEFAULT_BRAND while loading is what
// caused the EduPro logo to flash on every cold load before the real one
// arrived — consumers must render a neutral placeholder instead.
const DEFAULT_BRAND = {
  name: 'EduPro',
  nickname: null,
  logoUrl: null,
  faviconUrl: null,
  contactEmail: null,
  resolved: false,
  loading: true
};

// Cache the resolved brand per deployment so a returning visitor paints the
// correct logo on the first frame instead of waiting for the network. Keyed by
// BASE_URL because one origin can host more than one deployment (/dashboard/,
// /order/). The API is still called on every load, so a logo changed in the
// admin panel lands on the very next visit.
const CACHE_KEY = `site_brand:${import.meta.env.BASE_URL || '/'}`;

function readCachedBrand() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached.name !== 'string') return null;
    return { ...cached, resolved: true, loading: false };
  } catch {
    return null;
  }
}

function writeCachedBrand(brand) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      name: brand.name,
      nickname: brand.nickname,
      logoUrl: brand.logoUrl,
      faviconUrl: brand.faviconUrl,
      contactEmail: brand.contactEmail,
      siteKey: brand.siteKey,
      siteId: brand.siteId,
      meta: brand.meta
    }));
  } catch { /* private mode / quota — the app works without it */ }
}

// Tab title + favicon follow the brand. Applied from cache too, so the tab
// stops showing the build's placeholder title on repeat visits.
function applyDocumentBrand(name, faviconUrl) {
  if (name) document.title = name;
  if (faviconUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }
}

const SiteBrandingContext = createContext(DEFAULT_BRAND);

export const SiteBrandingProvider = ({ children }) => {
  const [brand, setBrand] = useState(() => readCachedBrand() || DEFAULT_BRAND);

  // Paint cached title/favicon immediately rather than a frame later.
  useEffect(() => {
    const cached = readCachedBrand();
    if (cached) applyDocumentBrand(cached.name, cached.faviconUrl);
  }, []);

  useEffect(() => {
    getPublicSite()
      .then(res => {
        const s = res.data?.site;
        if (s) {
          const faviconUrl = s.favicon_url
            ? (s.favicon_url.startsWith('http') ? s.favicon_url : `${API_ORIGIN}${s.favicon_url}`)
            : null;
          const next = {
            name: s.name,
            nickname: s.nickname,
            logoUrl: s.logo_url ? (s.logo_url.startsWith('http') ? s.logo_url : `${API_ORIGIN}${s.logo_url}`) : null,
            faviconUrl,
            contactEmail: s.contact_email || null,
            resolved: true,
            loading: false,
            siteKey: s.site_key,
            siteId: s.id,
            meta: {
              login: { title: s.meta_title_login, desc: s.meta_desc_login },
              signup: { title: s.meta_title_signup, desc: s.meta_desc_signup },
              dashboard: { title: s.meta_title_dashboard, desc: s.meta_desc_dashboard }
            }
          };
          setBrand(next);
          writeCachedBrand(next);
          applyDocumentBrand(next.name, faviconUrl);

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
        } else {
          // API answered but named no site (e.g. an origin that isn't in the
          // sites table): fall back to the default brand, but stop loading.
          setBrand(b => (b.resolved ? b : { ...DEFAULT_BRAND, loading: false }));
        }
      })
      .catch(() => {
        setBrand(b => (b.resolved ? b : { ...DEFAULT_BRAND, loading: false }));
      });
  }, []);

  return (
    <SiteBrandingContext.Provider value={brand}>
      {children}
    </SiteBrandingContext.Provider>
  );
};

export const useSiteBranding = () => useContext(SiteBrandingContext);
