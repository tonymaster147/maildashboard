import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { getStatuses, createStatus, updateStatus, deleteStatus } from '../services/api';

/**
 * Editable list of statuses for a given kind ("admin" or "tutor").
 * Built-in rows can be renamed and toggled active/inactive but not deleted.
 */
export default function StatusListEditor({ kind, title, accent = '#84c225' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const load = () => {
    setLoading(true);
    getStatuses(kind).then(res => setRows(res.data.statuses || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [kind]);

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try { await createStatus(kind, { name: newName.trim() }); setNewName(''); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed to add'); }
    finally { setBusy(false); }
  };

  const beginEdit = (row) => { setEditingId(row.id); setEditingName(row.name); };
  const cancelEdit = () => { setEditingId(null); setEditingName(''); };

  const saveEdit = async () => {
    if (!editingName.trim()) return cancelEdit();
    try { await updateStatus(kind, editingId, { name: editingName.trim() }); cancelEdit(); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed to save'); }
  };

  const toggleActive = async (row) => {
    try { await updateStatus(kind, row.id, { is_active: !row.is_active }); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed'); }
  };

  const remove = async (row) => {
    if (row.is_builtin) return;
    if (!confirm(`Delete "${row.name}"? Orders currently using this status will become uncategorized.`)) return;
    try { await deleteStatus(kind, row.id); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div className="card">
      <h4 style={{ marginBottom: 12 }}>{title} ({rows.length})</h4>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
        Built-in statuses can be renamed and deactivated but not deleted (automation references them). Custom statuses can be fully managed.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder={`Add new ${kind} status…`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button className="btn btn-primary" onClick={add} disabled={busy || !newName.trim()}>
          <FiPlus size={14} /> Add
        </button>
      </div>

      {loading ? <div className="loading-spinner" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(row => (
            <div key={row.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: row.is_active ? 'var(--bg-input)' : 'rgba(127,127,127,0.06)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm, 8px)',
              opacity: row.is_active ? 1 : 0.55
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
              {editingId === row.id ? (
                <>
                  <input
                    className="form-input"
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' ? cancelEdit() : null}
                    style={{ flex: 1, padding: '4px 8px' }}
                  />
                  <button className="btn btn-sm btn-primary" onClick={saveEdit}><FiCheck size={12} /></button>
                  <button className="btn btn-sm btn-secondary" onClick={cancelEdit}><FiX size={12} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 500 }}>{row.name}</span>
                  <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>{row.code}</code>
                  {row.is_builtin ? <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>built-in</span> : null}
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleActive(row)} title={row.is_active ? 'Deactivate' : 'Activate'}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => beginEdit(row)} title="Rename"><FiEdit2 size={12} /></button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => remove(row)}
                    disabled={row.is_builtin}
                    style={{ opacity: row.is_builtin ? 0.4 : 1, cursor: row.is_builtin ? 'not-allowed' : 'pointer' }}
                    title={row.is_builtin ? 'Built-in cannot be deleted' : 'Delete'}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
