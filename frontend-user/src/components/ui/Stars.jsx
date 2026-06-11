// Stars — gold star strip for a 0–5 tutor rating (half-star steps via a
// width-clipped overlay). Renders nothing when no rating is set, so callers
// can drop it in unconditionally.

import { C } from '../../theme/tokens';

export default function Stars({ value, size = 11, showNumber = true }) {
  const v = parseFloat(value);
  if (!value || Number.isNaN(v) || v <= 0) return null;

  const clamped = Math.min(5, Math.max(0, v));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        aria-label={`Rated ${clamped.toFixed(1)} out of 5`}
        style={{
          position: 'relative', display: 'inline-block',
          fontSize: size, lineHeight: 1, color: '#d6dae1', letterSpacing: 1,
        }}
      >
        {'★★★★★'}
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 0,
            overflow: 'hidden', whiteSpace: 'nowrap',
            width: `${(clamped / 5) * 100}%`,
            color: '#fbbf24', letterSpacing: 1,
          }}
        >
          {'★★★★★'}
        </span>
      </span>
      {showNumber && (
        <span style={{ fontSize: size - 1, fontWeight: 700, color: C.textMuted }}>
          {clamped.toFixed(1)}
        </span>
      )}
    </span>
  );
}
