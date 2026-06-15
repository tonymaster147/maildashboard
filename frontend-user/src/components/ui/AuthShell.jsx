// AuthShell — split-screen layout used by Login / Signup / ForgotAccessCode.
//
// Desktop: left half is a gradient hero (logo + tagline + social proof),
// right half is the white form card (children).
// Mobile (≤768px): hero is hidden, form card stacks full-width with the
// brand logo at the top.
//
// Site branding (logo + name) is read from useSiteBranding(). Same
// fallback chain the legacy auth pages used.

import { FiBookOpen } from 'react-icons/fi';
import { useSiteBranding } from '../../context/SiteBrandingContext';
import { C } from '../../theme/tokens';

export default function AuthShell({
  title,
  subtitle,
  heroTitle,
  heroSubtitle,
  children,
}) {
  const brand = useSiteBranding();
  const year = new Date().getFullYear();

  return (
    <div className="v2-auth-page">
    <div className="v2-auth-shell">
      {/* ── LEFT: gradient hero (desktop only) ────────────────── */}
      <div className="v2-auth-hero" aria-hidden="true">
        {/* Decorative blobs */}
        <div className="v2-auth-blob v2-auth-blob-a" />
        <div className="v2-auth-blob v2-auth-blob-b" />

        <div className="v2-auth-hero-inner">
          {/* Brand — uploaded logos are typically dark text/marks, so we
              place them on a white rounded backdrop so they read against
              the gradient. The icon-fallback brand uses a translucent
              backdrop instead since its color is white. */}
          <div style={{ marginBottom: 56 }}>
            {brand.logoUrl ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: '#ffffff',
                padding: '10px 18px',
                borderRadius: 12,
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.15)',
              }}>
                <img
                  src={brand.logoUrl} alt={brand.name}
                  style={{ maxHeight: 40, maxWidth: 180, objectFit: 'contain', display: 'block' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FiBookOpen size={20} color="#fff" />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>
                  {brand.name}
                </span>
              </div>
            )}
          </div>

          {/* Hero copy */}
          <h2 className="v2-auth-hero-title">
            {heroTitle || 'Welcome Back'}
          </h2>
          <p className="v2-auth-hero-sub">
            {heroSubtitle || 'Sign in to manage your assignments, message tutors, and track your progress all in one place.'}
          </p>
        </div>

        {/* Copyright pinned to the bottom of the hero */}
        <div className="v2-auth-copyright">
          © {year} {brand.name}. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT: form card ──────────────────────────────────── */}
      <div className="v2-auth-form-wrap">
        <div className="v2-auth-form-card">
          {/* Mobile-only brand (since hero is hidden ≤768px) */}
          <div className="v2-auth-form-brand">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl} alt={brand.name}
                style={{ maxHeight: 44, maxWidth: 180, objectFit: 'contain' }}
              />
            ) : (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'linear-gradient(135deg, #1f2937, #374151)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FiBookOpen size={18} color="#fff" />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{brand.name}</span>
              </>
            )}
          </div>

          {/* Title + subtitle */}
          <div style={{ marginBottom: 22 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.2,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ color: C.textMuted, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
    </div>
  );
}
