const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { sendAccessCode, sendForgotAccessCode } = require('../services/emailService');
require('dotenv').config();

/**
 * User Signup - Only username required, system generates access_code
 */
exports.signup = async (req, res) => {
  try {
    const { username, email } = req.body;

    // Check if username exists
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Generate random access code (8 chars)
    const rawAccessCode = uuidv4().slice(0, 8).toUpperCase();
    const hashedCode = await bcrypt.hash(rawAccessCode, 10);

    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (username, access_code, email, role) VALUES (?, ?, ?, ?)',
      [username, hashedCode, email || null, 'user']
    );

    // Send access code via email
    if (email) {
      await sendAccessCode(email, username, rawAccessCode);
    }

    res.status(201).json({
      message: 'Account created successfully',
      username,
      access_code: rawAccessCode,
      note: email ? 'Access code has been sent to your email' : 'Please save your access code securely'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

/**
 * User Login - username + access_code
 */
exports.login = async (req, res) => {
  try {
    const { username, access_code } = req.body;

    const [users] = await db.query(
      'SELECT id, username, access_code, email, role FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(access_code, user.access_code);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * Admin Login
 */
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await db.query(
      'SELECT id, username, access_code, email, role FROM users WHERE username = ? AND role = "admin"',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.access_code);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: 'admin' }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Tutor Login
 */
exports.tutorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [tutors] = await db.query(
      'SELECT id, name, email, password FROM tutors WHERE email = ? AND status = "active"',
      [email]
    );

    if (tutors.length === 0) {
      return res.status(401).json({ error: 'Invalid tutor credentials' });
    }

    const tutor = tutors[0];
    const isMatch = await bcrypt.compare(password, tutor.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid tutor credentials' });
    }

    const token = jwt.sign(
      { id: tutor.id, name: tutor.name, role: 'tutor' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: tutor.id, name: tutor.name, email: tutor.email, role: 'tutor' }
    });
  } catch (error) {
    console.error('Tutor login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Sales Login (Sales Team Lead / Sales Executive)
 */
exports.salesLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [salesUsers] = await db.query(
      'SELECT id, name, email, password, role FROM sales_users WHERE email = ? AND status = "active"',
      [email]
    );

    if (salesUsers.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const salesUser = salesUsers[0];
    const isMatch = await bcrypt.compare(password, salesUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Load permissions
    const [permissions] = await db.query(
      'SELECT menu_key FROM sales_permissions WHERE sales_user_id = ? AND is_allowed = 1',
      [salesUser.id]
    );
    const allowedMenus = permissions.map(p => p.menu_key);

    const token = jwt.sign(
      { id: salesUser.id, name: salesUser.name, role: salesUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: salesUser.id,
        name: salesUser.name,
        email: salesUser.email,
        role: salesUser.role,
        permissions: allowedMenus
      }
    });
  } catch (error) {
    console.error('Sales login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Change Password (User)
 */
exports.changePassword = async (req, res) => {
  try {
    const { current_access_code, new_access_code } = req.body;
    const userId = req.user.id;

    const [users] = await db.query('SELECT access_code FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(current_access_code, users[0].access_code);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current access code is incorrect' });
    }

    const hashedCode = await bcrypt.hash(new_access_code, 10);
    await db.query('UPDATE users SET access_code = ? WHERE id = ?', [hashedCode, userId]);

    res.json({ message: 'Access code updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Forgot Access Code - send new access code to user's email
 */
exports.forgotAccessCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await db.query('SELECT id, username, email FROM users WHERE email = ? AND is_active = 1', [email]);
    if (users.length === 0) {
      return res.json({ message: 'If an account with that email exists, a new access code has been sent.' });
    }

    const user = users[0];
    const newAccessCode = uuidv4().slice(0, 8).toUpperCase();
    const hashedCode = await bcrypt.hash(newAccessCode, 10);

    await db.query('UPDATE users SET access_code = ? WHERE id = ?', [hashedCode, user.id]);
    await sendForgotAccessCode(user.email, user.username, newAccessCode);

    res.json({ message: 'If an account with that email exists, a new access code has been sent.' });
  } catch (error) {
    console.error('Forgot access code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
