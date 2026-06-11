import { C } from '../../theme/tokens';

// Compact status/category badge. Pass bg + color to colorize.
// Common pairs:
//   green:  bg={C.greenSoft}  color={C.green}
//   orange: bg={C.orangeSoft} color={C.orangeText}
//   red:    bg={C.redSoft}    color={C.red}
//   blue:   bg={C.accentSoft} color={C.accent}
//   gray:   bg="#eef2f7"      color={C.textSecondary}
export default function Pill({
  children, bg, color, uppercase = true, truncate = false, title, style,
}) {
  return (
    <span
      title={title}
      style={{
        display: truncate ? 'block' : 'inline-block',
        maxWidth: truncate ? '100%' : undefined,
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        fontSize: 11,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: C.radiusPill,
        background: bg ?? '#eef2f7',
        color: color ?? C.textSecondary,
        textTransform: uppercase ? 'uppercase' : 'none',
        letterSpacing: 0.4,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
