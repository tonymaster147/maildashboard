import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

const PALETTE = {
  success: { color: 'var(--success, #16a34a)', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.25)', Icon: FiCheckCircle },
  error:   { color: 'var(--danger, #dc2626)',  bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', Icon: FiAlertCircle },
  info:    { color: 'var(--accent, #2563eb)',  bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', Icon: FiInfo }
};

export default function Notice({ type = 'info', children, style }) {
  const { color, bg, border, Icon } = PALETTE[type] || PALETTE.info;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 14px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 'var(--radius-sm, 8px)',
      marginBottom: 16,
      color,
      fontSize: 14,
      lineHeight: 1.4,
      ...style
    }}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ color: 'var(--text-primary)', flex: 1 }}>{children}</span>
    </div>
  );
}
