import { Link } from 'react-router-dom';
import { FiPlusCircle, FiArrowUpRight } from 'react-icons/fi';
import { C } from '../../theme/tokens';
import IconBadge from './IconBadge';

// Gradient banner CTA — primary entry point for a new assignment from the
// dashboard. Replaces the old order-timeline hero (per Sonia Ma'am's feedback:
// course deadlines change too often for a fixed timeline).
export default function SubmitAssignmentBanner({ to = '/new-order' }) {
  return (
    <div className="v2-cta-banner" style={{
      position: 'relative', overflow: 'hidden',
      background: C.gradHero,
      color: '#fff', borderRadius: C.radiusXl, padding: '22px 26px',
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      {/* Decorative blobs */}
      <div aria-hidden style={{
        position: 'absolute', right: -40, top: -40, width: 180, height: 180,
        borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', right: 60, bottom: -60, width: 140, height: 140,
        borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
      }} />

      <IconBadge
        icon={FiPlusCircle}
        size={52}
        iconSize={26}
        bg="rgba(255,255,255,0.18)"
        color="#fff"
        radius={14}
        style={{ position: 'relative', zIndex: 1, backdropFilter: 'blur(6px)' }}
      />

      <div className="v2-cta-banner-text-wrap" style={{ flex: 1, minWidth: 220, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, opacity: 0.85, marginBottom: 4 }}>
          NEW ASSIGNMENT
        </div>
        <div className="v2-cta-banner-title" style={{ fontSize: 19, fontWeight: 800, letterSpacing: 0.2, marginBottom: 4 }}>
          Got another deadline coming up?
        </div>
        <div className="v2-cta-banner-text" style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
          Drop the brief in seconds — our tutors review it and respond fast. No semester or fixed schedule required.
        </div>
      </div>

      <Link to={to} className="v2-cta-banner-button" style={{
        background: '#fff', color: C.gradBlue, border: 'none', borderRadius: C.radius,
        padding: '13px 22px', fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.15)', position: 'relative', zIndex: 1,
        whiteSpace: 'nowrap', textDecoration: 'none',
      }}>
        GET MORE ASSIGNMENT HELP <FiArrowUpRight size={14} />
      </Link>
    </div>
  );
}
