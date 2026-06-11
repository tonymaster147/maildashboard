import { C } from '../../theme/tokens';

// Rounded square icon container (e.g. the +circle on the SubmitAssignment
// banner, service strip tiles, dashboard kpi-style icons).
//
//   <IconBadge icon={FiPlusCircle} size={52} bg="rgba(255,255,255,0.18)" color="#fff" />
export default function IconBadge({
  icon: Icon,
  size = 40,
  bg = C.accentSoft,
  color = C.accent,
  radius,
  iconSize,
  style,
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius ?? Math.round(size * 0.27),
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {Icon ? <Icon size={iconSize ?? Math.round(size * 0.5)} /> : null}
    </div>
  );
}
