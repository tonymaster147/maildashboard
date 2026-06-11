import { C } from '../../theme/tokens';

// Surface container. Default padding 18px, rounded 12px, 1px border.
// Pass padding={0} when child needs to bleed to the edges (e.g. blog hero,
// Stripe embedded checkout).
export default function Card({ children, padding, style, className, onClick }) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: C.radiusLg,
        padding: padding != null ? padding : 18,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
