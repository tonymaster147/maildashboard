import { C } from '../../theme/tokens';

// Key/value row used in Login Details, Order summary, Payment summary, etc.
// Mirrors the v2 demo's `<Row>` helper.
//
//   <Row label="URL"  value="canvas.school.edu" />
//   <Row label="Pass" value={<MaskedValue ... />} />
export default function Row({ label, value, labelWidth = 56, mono = true, style }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        ...style,
      }}
    >
      <span
        style={{
          width: labelWidth,
          flexShrink: 0,
          color: C.textMuted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: C.textPrimary,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          fontWeight: 600,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}
