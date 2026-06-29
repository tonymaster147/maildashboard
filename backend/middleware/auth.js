const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

/**
 * Verify JWT token middleware
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

/**
 * Role-based access control middleware
 * @param  {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

/**
 * Sales data window — a sales_executive may only see records created within
 * the last `data_window_days` days. Sets:
 *   req.salesCutoff      Date | null   (null = unrestricted: lead/admin)
 *   req.salesWindowDays  number | null
 * Controllers add `AND <table>.created_at >= req.salesCutoff` when it's set,
 * and route guards block direct access to older single records.
 */
const attachSalesWindow = async (req, res, next) => {
  req.salesCutoff = null;
  req.salesWindowDays = null;
  try {
    if (req.user && req.user.role === 'sales_executive') {
      const [rows] = await db.query('SELECT data_window_days FROM sales_users WHERE id = ?', [req.user.id]);
      const days = rows.length && rows[0].data_window_days != null ? rows[0].data_window_days : 60;
      req.salesWindowDays = days;
      req.salesCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }
  } catch (e) {
    console.error('attachSalesWindow error:', e.message);
  }
  next();
};

module.exports = { verifyToken, requireRole, attachSalesWindow };
