const db = require('../config/db');
const nodemailer = require('nodemailer');
const { encryptSecret, decryptSecret } = require('../utils/crypto');
const { invalidateSiteCache } = require('../middleware/siteResolver');

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function sanitizeForResponse(row) {
  if (!row) return row;
  const { smtp_pass, ...rest } = row;
  return { ...rest, smtp_pass_set: !!smtp_pass };
}

exports.listSites = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sites ORDER BY created_at DESC');
    res.json({ sites: rows.map(sanitizeForResponse) });
  } catch (error) {
    console.error('List sites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSite = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sites WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Site not found' });
    res.json({ site: sanitizeForResponse(rows[0]) });
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createSite = async (req, res) => {
  try {
    const {
      name, url, nickname, logo_url, site_key,
      from_name, from_email,
      smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
      is_active
    } = req.body;

    if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

    let key = (site_key && site_key.trim()) ? slugify(site_key) : slugify(name);
    if (!key) return res.status(400).json({ error: 'Unable to derive site_key from name' });

    const [dup] = await db.query('SELECT id FROM sites WHERE site_key = ?', [key]);
    if (dup.length > 0) key = `${key}-${Date.now().toString(36).slice(-4)}`;

    const encPass = smtp_pass ? encryptSecret(smtp_pass) : null;

    const [result] = await db.query(
      `INSERT INTO sites
       (site_key, name, url, nickname, logo_url, from_name, from_email,
        smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        key, name, url, nickname || null, logo_url || null,
        from_name || null, from_email || null,
        smtp_host || null,
        smtp_port ? parseInt(smtp_port) : 587,
        smtp_secure ? 1 : 0,
        smtp_user || null, encPass,
        is_active === false ? 0 : 1
      ]
    );

    invalidateSiteCache();
    res.status(201).json({ id: result.insertId, site_key: key, message: 'Site created' });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates = [];
    const params = [];
    const assignable = ['name', 'url', 'nickname', 'logo_url', 'from_name', 'from_email',
      'smtp_host', 'smtp_port', 'smtp_user'];

    assignable.forEach(f => {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(body[f] === '' ? null : body[f]);
      }
    });

    if (body.smtp_secure !== undefined) { updates.push('smtp_secure = ?'); params.push(body.smtp_secure ? 1 : 0); }
    if (body.is_active !== undefined) { updates.push('is_active = ?'); params.push(body.is_active ? 1 : 0); }
    if (body.site_key !== undefined) { updates.push('site_key = ?'); params.push(slugify(body.site_key)); }

    // Only update password if explicitly sent (and non-empty)
    if (body.smtp_pass !== undefined && body.smtp_pass !== '') {
      updates.push('smtp_pass = ?');
      params.push(encryptSecret(body.smtp_pass));
    } else if (body.smtp_pass === null) {
      // Explicit clear
      updates.push('smtp_pass = ?');
      params.push(null);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    await db.query(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`, params);

    invalidateSiteCache();
    res.json({ message: 'Site updated' });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteSite = async (req, res) => {
  try {
    const { id } = req.params;
    // Soft delete by setting inactive (orders may reference it)
    await db.query('UPDATE sites SET is_active = 0 WHERE id = ?', [id]);
    invalidateSiteCache();
    res.json({ message: 'Site deactivated' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.testEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient `to` is required' });

    const [rows] = await db.query('SELECT * FROM sites WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Site not found' });
    const s = rows[0];

    if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) {
      return res.status(400).json({ error: 'SMTP is not fully configured for this site' });
    }

    const pass = decryptSecret(s.smtp_pass);
    if (!pass) return res.status(500).json({ error: 'Unable to decrypt SMTP password' });

    const port = s.smtp_port || 587;
    const secure = port === 465 ? true : !!s.smtp_secure;
    const transporter = nodemailer.createTransport({
      host: s.smtp_host,
      port,
      secure,
      auth: { user: s.smtp_user, pass }
    });

    await transporter.verify();
    await transporter.sendMail({
      from: s.from_email ? `"${s.from_name || s.name}" <${s.from_email}>` : s.smtp_user,
      to,
      subject: `Test email from ${s.name}`,
      html: `<p>This is a test email sent from <strong>${s.name}</strong> (${s.url}).</p>
             <p>If you received this, the SMTP configuration is working correctly.</p>`
    });

    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
};

/**
 * Public endpoint — returns the resolved site's branding (safe fields only).
 * No auth required. Used by user frontends to brand signup/login pages per site.
 */
exports.getPublicBranding = async (req, res) => {
  try {
    if (!req.site) return res.json({ site: null });
    res.json({
      site: {
        id: req.site.id,
        site_key: req.site.site_key,
        name: req.site.name,
        nickname: req.site.nickname || null,
        logo_url: req.site.logo_url || null,
        url: req.site.url
      }
    });
  } catch (error) {
    console.error('Public branding error:', error);
    res.json({ site: null });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
