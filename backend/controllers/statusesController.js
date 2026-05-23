// CRUD for admin_statuses and tutor_statuses. Only admin role can write.
// Built-in rows can be renamed and deactivated but not deleted, since automation
// references them by `code`.

const db = require('../config/db');
const statusCache = require('../utils/statuses');

const TABLES = {
  admin: 'admin_statuses',
  tutor: 'tutor_statuses'
};

function tableFor(kind) {
  return TABLES[kind] || null;
}

function slugify(name) {
  return String(name || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

exports.list = async (req, res) => {
  try {
    const table = tableFor(req.params.kind);
    if (!table) return res.status(404).json({ error: 'Unknown kind' });
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY sort_order, id`);
    res.json({ statuses: rows });
  } catch (err) {
    console.error('List statuses error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const table = tableFor(req.params.kind);
    if (!table) return res.status(404).json({ error: 'Unknown kind' });
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    let code = slugify(name);
    if (!code) return res.status(400).json({ error: 'Unable to derive code from name' });
    const [dup] = await db.query(`SELECT id FROM ${table} WHERE code = ?`, [code]);
    if (dup.length > 0) code = `${code}_${Date.now().toString(36).slice(-4)}`;

    const [result] = await db.query(
      `INSERT INTO ${table} (code, name, sort_order, is_active, is_builtin) VALUES (?, ?, ?, 1, 0)`,
      [code, name, sort_order || 100]
    );
    statusCache.invalidate();
    res.status(201).json({ id: result.insertId, code, message: 'Status created' });
  } catch (err) {
    console.error('Create status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const table = tableFor(req.params.kind);
    if (!table) return res.status(404).json({ error: 'Unknown kind' });
    const { id } = req.params;
    const { name, sort_order, is_active } = req.body;

    const updates = [];
    const params = [];
    if (name !== undefined)       { updates.push('name = ?');       params.push(name); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (is_active !== undefined)  { updates.push('is_active = ?');  params.push(is_active ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    await db.query(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`, params);
    statusCache.invalidate();
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const table = tableFor(req.params.kind);
    if (!table) return res.status(404).json({ error: 'Unknown kind' });
    const { id } = req.params;

    const [rows] = await db.query(`SELECT is_builtin FROM ${table} WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Status not found' });
    if (rows[0].is_builtin) return res.status(400).json({ error: 'Built-in statuses cannot be deleted (deactivate instead)' });

    // FK is ON DELETE SET NULL, so orders pointing to this row become NULL
    await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    statusCache.invalidate();
    res.json({ message: 'Status deleted' });
  } catch (err) {
    console.error('Delete status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
