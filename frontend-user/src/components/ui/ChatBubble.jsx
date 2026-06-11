import { C } from '../../theme/tokens';

// Map sender role to a label color (used above non-own messages).
// Preserves the exact colors the legacy Chat.jsx used so the visual identity
// of each role stays consistent.
const ROLE_COLOR = {
  tutor:           C.indigo,    // #6366f1
  admin:           '#3b82f6',
  sales_lead:      '#f59e0b',
  sales_executive: '#f97316',
  support:         C.green,
};
const ROLE_LABEL = {
  sales_lead:      'Sales Lead',
  sales_executive: 'Sales Exec',
};

const colorFor = (role) => ROLE_COLOR[role] || C.accent;
const labelFor = (role) => ROLE_LABEL[role] || role;

// Channel theme for the OWN message bubble background.
const CHANNEL_OWN_BG = {
  tutor:   C.indigo,
  support: C.green,
  issue:   C.accent,   // issue threads: student-to-staff replies
};

// ChatBubble — single message row.
//
// Props:
//   mine        boolean   own (sent) vs received styling
//   channel     'tutor'|'support'  controls own-bubble color
//   senderName  string    shown above non-own messages
//   senderRole  string    drives role color + label suffix
//   message     string    text body (skipped if attachment provided)
//   attachment  node      pass <AttachmentBubble msg isOwn /> if msg.attachment_url
//   timestamp   ISO       shown small below the bubble
//   flagged     boolean   red ring + tinted background when moderation flagged
export default function ChatBubble({
  mine, channel = 'support', senderName, senderRole,
  message, attachment, timestamp, flagged,
}) {
  // Coerce — backend sends MySQL int (0/1). `0 && JSX` would render the
  // literal "0" inside the bubble, which is what was leaking through.
  const isFlagged = Number(flagged) === 1;
  const ownBg = CHANNEL_OWN_BG[channel] || C.accent;
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: mine ? 'flex-end' : 'flex-start',
      gap: 2,
      maxWidth: '100%',
    }}>
      {/* Sender name + role for received messages */}
      {!mine && senderName && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: colorFor(senderRole),
          padding: '0 4px', letterSpacing: 0.2,
        }}>
          {senderName}{senderRole ? ` (${labelFor(senderRole)})` : ''}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: '78%',
        padding: '9px 13px',
        borderRadius: 14,
        background: mine ? ownBg : C.surface,
        color: mine ? '#fff' : C.textPrimary,
        border: mine ? 'none' : `1px solid ${C.border}`,
        outline: isFlagged ? `2px solid ${C.red}` : 'none',
        boxShadow: mine ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
        wordBreak: 'break-word',
        fontSize: 14,
        lineHeight: 1.45,
      }}>
        {attachment ? attachment : <div>{message}</div>}
        {isFlagged ? (
          <div style={{ fontSize: 10, marginTop: 4, color: mine ? 'rgba(255,255,255,0.85)' : C.red, fontWeight: 700, letterSpacing: 0.3 }}>
            ⚠ Flagged
          </div>
        ) : null}
      </div>

      {/* Timestamp */}
      {time && (
        <div style={{ fontSize: 10, color: C.textMuted, padding: '0 4px' }}>
          {time}
        </div>
      )}
    </div>
  );
}
