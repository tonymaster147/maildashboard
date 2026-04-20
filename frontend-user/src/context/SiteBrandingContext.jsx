import { createContext, useContext, useEffect, useState } from 'react';
import { getPublicSite } from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const DEFAULT_BRAND = {
  name: 'EduPro',
  nickname: null,
  logoUrl: null,
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
          setBrand({
            name: s.name,
            nickname: s.nickname,
            logoUrl: s.logo_url ? (s.logo_url.startsWith('http') ? s.logo_url : `${API_ORIGIN}${s.logo_url}`) : null,
            resolved: true,
            siteKey: s.site_key,
            siteId: s.id
          });
          document.title = s.name;
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
