import { useState, useMemo } from 'react';
import { FiSettings, FiEye, FiEyeOff } from 'react-icons/fi';
import { C } from '../../theme/tokens';
import Card from './Card';
import Pill from './Pill';
import Row from './Row';
import UpdateCredentialModal from './UpdateCredentialModal';

// Login Details card with per-order dropdown.
// Pulls the credentials directly from the orders array (each order already
// carries its own school_url/school_username/school_password fields).
//
// Props:
//   orders — array of order objects with login fields. The dropdown lists
//            every order that has either credentials set OR is active.
//   onChanged — called after a successful credential update so parent reloads.
export default function LoginDetailsCard({ orders, onChanged }) {
  // Show every order the student might still need to share credentials for —
  // i.e. anything that isn't already finished. Completed and cancelled orders
  // are hidden because there's nothing left to do on them.
  const credentialOrders = useMemo(
    () => (orders || []).filter(o => !['completed', 'cancelled'].includes(o.status)),
    [orders]
  );

  const [selectedId, setSelectedId] = useState(() => credentialOrders[0]?.id || null);
  const [editing, setEditing] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const selected = credentialOrders.find(o => o.id === selectedId) || credentialOrders[0];

  // Keep selected in sync when orders refresh after edit
  if (selected && selected.id !== selectedId) {
    setSelectedId(selected.id);
  }

  if (!selected) {
    return (
      <Card>
        <Header />
        <p style={{ color: C.textMuted, fontSize: 13, margin: '8px 0 0' }}>
          No active orders yet. Place an order to share portal credentials with your tutor.
        </p>
      </Card>
    );
  }

  const updated = selected.login_updated_at
    ? new Date(selected.login_updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()
    : null;

  const hasCreds = selected.school_url || selected.school_username || selected.school_password;

  return (
    <Card>
      <Header updated={updated} />

      {/* Order picker — dropdown when multiple orders, label when only one */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.3 }}>For</span>
        {credentialOrders.length > 1 ? (
          <select
            value={selectedId || ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            style={{
              flex: 1, fontFamily: 'ui-monospace, monospace', fontWeight: 700,
              color: C.textSecondary, fontSize: 12, padding: '5px 8px',
              border: `1px solid ${C.border}`, borderRadius: 6,
              background: C.surface, cursor: 'pointer', outline: 'none',
            }}
          >
            {credentialOrders.map(o => (
              <option key={o.id} value={o.id}>
                {formatOption(o)}
              </option>
            ))}
          </select>
        ) : (
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: C.textSecondary,
            fontSize: 12,
          }}>
            {selected.order_code || `#${selected.id}`}
          </span>
        )}
      </div>


      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 14 }}>
        {hasCreds ? (
          <>
            <Row label="URL"  value={selected.school_url      || <Muted>not set</Muted>} />
            <Row label="User" value={selected.school_username || <Muted>not set</Muted>} />
            <Row
              label="Pass"
              value={
                selected.school_password ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {showPass ? selected.school_password : '••••••••'}
                    <button
                      type="button" onClick={() => setShowPass(s => !s)}
                      title={showPass ? 'Hide' : 'Show'}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'inline-flex' }}
                    >
                      {showPass ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                    </button>
                  </span>
                ) : <Muted>not set</Muted>
              }
            />
          </>
        ) : (
          <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 8px' }}>
            No credentials saved for this order yet. Click below to share them with your tutor.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <FiSettings size={13} /> {hasCreds ? 'UPDATE CREDENTIAL' : 'ADD CREDENTIAL'}
      </button>

      <UpdateCredentialModal
        open={editing}
        onClose={() => setEditing(false)}
        order={selected}
        onSaved={() => onChanged?.()}
      />
    </Card>
  );
}

function Header({ updated }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <h3 style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 1 }}>
        LOGIN DETAILS
      </h3>
      {updated && (
        <span style={{ marginLeft: 'auto' }}>
          <Pill bg={C.greenSoft} color={C.green}>UPDATED {updated}</Pill>
        </span>
      )}
    </div>
  );
}

function Muted({ children }) {
  return <span style={{ color: C.textMuted, fontStyle: 'italic', fontWeight: 500 }}>{children}</span>;
}

// Format a single <option> label: `ORDER_CODE — Course Name`, with the
// course name truncated at the nearest word boundary so long titles like
// "test this is klkkkkk..." don't blow up the dropdown width. Three dots
// (not the single ellipsis char) for readability inside <option>, which
// some platforms render in a stripped font.
const MAX_OPTION_NAME = 18;
function formatOption(o) {
  const code = o.order_code || `#${o.id}`;
  if (!o.course_name) return code;
  let name = o.course_name;
  if (name.length > MAX_OPTION_NAME) {
    const cut = name.slice(0, MAX_OPTION_NAME);
    // Don't cut mid-word — fall back to the last space before the limit.
    const lastSpace = cut.lastIndexOf(' ');
    const trimmed = (lastSpace > MAX_OPTION_NAME * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
    name = trimmed + '...';
  }
  return `${code} — ${name}`;
}
