import { C } from '../../theme/tokens';

// Avatar — renders a circular photo if `photo` URL is provided, else initials.
// Falls back to initials automatically if the image fails to load.
//
// Use the helper `initialsFrom(name)` to derive initials from a tutor or user
// name string (max 2 letters, uppercase).
//
// Props:
//   initials — fallback text shown when no photo (e.g. "JS")
//   size     — pixel diameter (default 36)
//   bg       — fallback background color (default light blue)
//   color    — fallback text color (default v2 accent)
//   photo    — image URL; if set and loads, photo is used instead of initials
//   ring     — optional ring color (1–2px border)
import { useState } from 'react';

export function initialsFrom(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  initials,
  size = 36,
  bg = C.accentSoft,
  color = C.accent,
  photo,
  ring,
  alt,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const useImage = photo && !imgFailed;

  if (useImage) {
    return (
      <img
        src={photo}
        alt={alt || initials || 'avatar'}
        onError={() => setImgFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: ring ? `2px solid ${ring}` : 'none',
          background: bg,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color,
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: ring ? `2px solid ${ring}` : 'none',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
    >
      {initials}
    </div>
  );
}
