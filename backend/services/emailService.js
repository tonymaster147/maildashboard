const nodemailer = require('nodemailer');
const db = require('../config/db');
const { decryptSecret } = require('../utils/crypto');
require('dotenv').config();

const ADMIN_EMAIL = 'faruqui.a4u@gmail.com';

// Master fallback transporter (env-based)
const masterTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const MASTER_FROM = process.env.EMAIL_FROM || 'noreply@tutoringplatform.com';
const MASTER_BRAND = {
  name: process.env.BRAND_NAME || 'EduPro',
  logoUrl: process.env.BRAND_LOGO_URL || null
};

// Cache site transporters by id
const siteTransporters = new Map();

function buildFrom(name, email) {
  if (!email) return null;
  return name ? `"${name}" <${email}>` : email;
}

async function getSiteContext(siteId) {
  if (!siteId) return null;
  try {
    const [rows] = await db.query('SELECT * FROM sites WHERE id = ? AND is_active = 1', [siteId]);
    if (rows.length === 0) return null;
    const s = rows[0];
    if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) return null;

    let tx = siteTransporters.get(s.id);
    if (!tx || tx._sig !== `${s.smtp_host}:${s.smtp_port}:${s.smtp_secure}:${s.smtp_user}:${s.updated_at}`) {
      const pass = decryptSecret(s.smtp_pass);
      if (!pass) return null;
      const port = s.smtp_port || 587;
      const secure = port === 465 ? true : !!s.smtp_secure;
      tx = nodemailer.createTransport({
        host: s.smtp_host,
        port,
        secure,
        auth: { user: s.smtp_user, pass }
      });
      tx._sig = `${s.smtp_host}:${s.smtp_port}:${s.smtp_secure}:${s.smtp_user}:${s.updated_at}`;
      siteTransporters.set(s.id, tx);
    }

    const from = buildFrom(s.from_name || s.name, s.from_email || s.smtp_user);
    return {
      transporter: tx,
      from: from || MASTER_FROM,
      brand: { name: s.name, logoUrl: s.logo_url }
    };
  } catch (e) {
    console.error('getSiteContext error:', e.message);
    return null;
  }
}

function masterContext() {
  return {
    transporter: masterTransporter,
    from: MASTER_FROM,
    brand: MASTER_BRAND
  };
}

/**
 * Resolve transport + branding for a given site id.
 * Falls back to master config when site is missing or SMTP unavailable.
 */
async function resolveContext(siteId) {
  return (siteId && await getSiteContext(siteId)) || masterContext();
}

async function sendViaContext(ctx, { to, subject, html }) {
  try {
    await ctx.transporter.sendMail({ from: ctx.from, to, subject, html });
    return true;
  } catch (err) {
    // On site-specific failure, fall back to master once
    if (ctx !== masterContext && ctx.transporter !== masterTransporter) {
      console.warn(`⚠️ Site SMTP failed (${err.message}), falling back to master`);
      try {
        await masterTransporter.sendMail({ from: MASTER_FROM, to, subject, html });
        return true;
      } catch (e2) {
        console.error('❌ Master fallback failed:', e2.message);
        return false;
      }
    }
    console.error('❌ Email send failed:', err.message);
    return false;
  }
}

async function getOrderSiteId(orderId) {
  if (!orderId) return null;
  try {
    const [rows] = await db.query('SELECT site_id FROM orders WHERE id = ?', [orderId]);
    return rows[0]?.site_id || null;
  } catch { return null; }
}

// ───────────────────────── templates ─────────────────────────

const header = (brand, title) => {
  const logo = brand.logoUrl
    ? `<div style="margin-bottom: 12px;"><img src="${brand.logoUrl}" alt="${brand.name}" style="max-height: 48px; max-width: 200px;" /></div>`
    : '';
  return `
  <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #0C2D64, #1a4a8a); padding: 32px 30px; text-align: center;">
      ${logo}
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${title}</h1>
    </div>
    <div style="padding: 32px 30px;">
  `;
};

const footer = (brand) => `
    </div>
    <div style="background: #f8fafc; padding: 16px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${brand.name}</p>
    </div>
  </div>
`;

// ───────────────────────── senders ─────────────────────────

async function sendAccessCode(email, username, accessCode, siteId) {
  if (!email) return;
  const ctx = await resolveContext(siteId);
  const html = `
    ${header(ctx.brand, `Welcome to ${ctx.brand.name}!`)}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Your account has been created successfully.</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #84C225; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Username:</strong> ${username}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Access Code:</strong> <span style="background: #84C225; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 18px; letter-spacing: 2px;">${accessCode}</span></p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Please save your access code securely. You will need it to log in.</p>
      <p style="color: #64748b; font-size: 14px;">If you did not create this account, please ignore this email.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to: email, subject: `Your Account Access Code - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Access code email sent to ${email}`);
}

async function sendForgotAccessCode(email, username, newAccessCode, siteId) {
  if (!email) return;
  const ctx = await resolveContext(siteId);
  const html = `
    ${header(ctx.brand, 'Access Code Reset')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">We received a request to reset your access code. Here are your updated credentials:</p>
      <div style="background: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Username:</strong> ${username}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>New Access Code:</strong> <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 18px; letter-spacing: 2px;">${newAccessCode}</span></p>
      </div>
      <p style="color: #ef4444; font-size: 14px; font-weight: 500;">⚠️ Your previous access code has been invalidated.</p>
      <p style="color: #64748b; font-size: 14px;">If you did not request this, please contact support immediately.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to: email, subject: `Access Code Reset - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Forgot access code email sent to ${email}`);
}

async function sendNewOrderAdmin(orderDetails) {
  const { orderId, courseName, username, orderType, subject, educationLevel, status, sourceUrl, planName, totalPrice, paymentStatus, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));

  const pStatus = paymentStatus || 'unpaid';
  const paymentColors = { completed: { bg: '#dcfce7', text: '#16a34a' }, pending: { bg: '#fef3c7', text: '#d97706' }, cancelled: { bg: '#fee2e2', text: '#dc2626' }, unpaid: { bg: '#f1f5f9', text: '#64748b' } };
  const pColor = paymentColors[pStatus] || paymentColors.unpaid;

  const html = `
    ${header(ctx.brand, '📋 New Order Notification')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">A new order has been ${status === 'incomplete' ? 'started' : 'updated'}.</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Order ID</td><td style="padding: 10px 0; color: #334155; font-weight: 600; text-align: right;">#${orderId}</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">User</td><td style="padding: 10px 0; color: #334155; font-weight: 500; text-align: right;">${username || 'N/A'}</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Course</td><td style="padding: 10px 0; color: #334155; font-weight: 500; text-align: right;">${courseName || 'N/A'}</td></tr>
        ${orderType ? `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Type</td><td style="padding: 10px 0; color: #334155; text-align: right;">${orderType}</td></tr>` : ''}
        ${subject ? `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Subject</td><td style="padding: 10px 0; color: #334155; text-align: right;">${subject}</td></tr>` : ''}
        ${educationLevel ? `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Level</td><td style="padding: 10px 0; color: #334155; text-align: right;">${educationLevel}</td></tr>` : ''}
        ${planName ? `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Plan</td><td style="padding: 10px 0; color: #334155; text-align: right;">${planName}</td></tr>` : ''}
        ${totalPrice ? `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Total</td><td style="padding: 10px 0; color: #84C225; font-weight: 700; font-size: 18px; text-align: right;">$${parseFloat(totalPrice).toFixed(2)}</td></tr>` : ''}
        ${sourceUrl ? `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Source</td><td style="padding: 10px 0; color: #334155; text-align: right;">${sourceUrl}</td></tr>` : ''}
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Payment</td><td style="padding: 10px 0; text-align: right;"><span style="background: ${pColor.bg}; color: ${pColor.text}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${pStatus}</span></td></tr>
        <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Order Status</td><td style="padding: 10px 0; text-align: right;"><span style="background: ${status === 'active' ? '#dcfce7' : '#fef3c7'}; color: ${status === 'active' ? '#16a34a' : '#d97706'}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${status}</span></td></tr>
      </table>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: ADMIN_EMAIL,
    subject: `Order #${orderId} - ${status === 'incomplete' ? 'New Draft' : status === 'active' ? 'Payment Confirmed' : 'Updated'} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Admin order email sent for order #${orderId}`);
}

async function sendOrderConfirmationUser(email, orderDetails) {
  if (!email) return;
  const { orderId, courseName, status, planName, totalPrice, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));

  const isPaid = status === 'active';
  const html = `
    ${header(ctx.brand, isPaid ? '✅ Payment Confirmed!' : '📝 Order Started')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">${isPaid ? 'Your payment has been processed and your order is now active!' : 'Your order has been started. Complete the remaining steps to proceed to payment.'}</p>
      <div style="background: ${isPaid ? '#f0fdf4' : '#f0f9ff'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isPaid ? '#22c55e' : '#3b82f6'}; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        ${planName ? `<p style="margin: 5px 0; color: #334155;"><strong>Plan:</strong> ${planName}</p>` : ''}
        ${totalPrice ? `<p style="margin: 5px 0; color: #334155;"><strong>Total:</strong> <span style="color: #84C225; font-weight: 700; font-size: 18px;">$${parseFloat(totalPrice).toFixed(2)}</span></p>` : ''}
        <p style="margin: 5px 0; color: #334155;"><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: 600; color: ${isPaid ? '#16a34a' : '#d97706'};">${status}</span></p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your dashboard to view or manage your order.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: email,
    subject: `${isPaid ? 'Payment Confirmed' : 'Order Started'} - Order #${orderId} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ User order email sent to ${email} for order #${orderId}`);
}

async function sendTutorTaskEmail(email, name, orderDetails) {
  if (!email) return;
  const { orderId, courseName, subject, planName, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));

  const html = `
    ${header(ctx.brand, '🎓 New Task Assigned')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">A new task has been assigned to you. Please check your dashboard for more details.</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        ${subject ? `<p style="margin: 5px 0; color: #334155;"><strong>Subject:</strong> ${subject}</p>` : ''}
        ${planName ? `<p style="margin: 5px 0; color: #334155;"><strong>Plan:</strong> ${planName}</p>` : ''}
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your Tutor Panel to start working on this task.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: email,
    subject: `New Task Assigned: Order #${orderId} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Tutor task email sent to ${email} for order #${orderId}`);
}

// Tutor / sales welcome emails are admin-initiated and have no site context → master.
async function sendTutorWelcomeEmail(email, name, password) {
  if (!email) return;
  const ctx = masterContext();
  const html = `
    ${header(ctx.brand, `Welcome to ${ctx.brand.name} Tutors!`)}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">An administrator has just created a Tutor account for you. Here are your login credentials:</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Password:</strong> <span style="background: #8b5cf6; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 16px; letter-spacing: 1px;">${password}</span></p>
      </div>
      <p style="color: #ef4444; font-size: 14px; font-weight: 500;">⚠️ Please keep your credentials secure and log into the Tutor Portal to see your tasks.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: email,
    subject: `Your Tutor Account Credentials - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Tutor welcome email sent to ${email}`);
}

async function sendSalesWelcomeEmail(email, name, password, role) {
  if (!email) return;
  const ctx = masterContext();
  const roleLabel = role === 'sales_lead' ? 'Sales Team Lead' : 'Sales Executive';
  const html = `
    ${header(ctx.brand, `Welcome to ${ctx.brand.name} - ${roleLabel}!`)}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">An administrator has created a <strong>${roleLabel}</strong> account for you. Here are your login credentials:</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Password:</strong> <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 16px; letter-spacing: 1px;">${password}</span></p>
        <p style="margin: 5px 0; color: #334155;"><strong>Role:</strong> ${roleLabel}</p>
      </div>
      <p style="color: #ef4444; font-size: 14px; font-weight: 500;">⚠️ Please keep your credentials secure and log into the Admin Panel using the Sales Team login option.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: email,
    subject: `Your ${roleLabel} Account Credentials - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Sales welcome email sent to ${email}`);
}

async function sendOrderStatusChangeEmail(email, orderDetails) {
  if (!email) return;
  const { orderId, courseName, oldStatus, newStatus, planName, totalPrice, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));

  const statusColors = {
    incomplete: { bg: '#f1f5f9', text: '#64748b' },
    pending: { bg: '#fef3c7', text: '#d97706' },
    active: { bg: '#dcfce7', text: '#16a34a' },
    in_progress: { bg: '#dbeafe', text: '#2563eb' },
    completed: { bg: '#dcfce7', text: '#16a34a' },
    cancelled: { bg: '#fee2e2', text: '#dc2626' }
  };
  const newColor = statusColors[newStatus] || statusColors.pending;
  const oldColor = statusColors[oldStatus] || statusColors.pending;

  const html = `
    ${header(ctx.brand, '📦 Order Status Updated')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">The status of your order has been updated.</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid ${newColor.text}; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        ${planName ? `<p style="margin: 5px 0; color: #334155;"><strong>Plan:</strong> ${planName}</p>` : ''}
        ${totalPrice ? `<p style="margin: 5px 0; color: #334155;"><strong>Total:</strong> $${parseFloat(totalPrice).toFixed(2)}</p>` : ''}
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <span style="background: ${oldColor.bg}; color: ${oldColor.text}; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase;">${oldStatus}</span>
        <span style="color: #94a3b8; font-size: 20px; margin: 0 12px;">→</span>
        <span style="background: ${newColor.bg}; color: ${newColor.text}; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase;">${newStatus}</span>
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your dashboard to view your order details.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: email,
    subject: `Order #${orderId} Status Updated to ${newStatus.replace('_', ' ').toUpperCase()} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Status change email sent to ${email} for order #${orderId}`);
}

module.exports = { sendAccessCode, sendForgotAccessCode, sendNewOrderAdmin, sendOrderConfirmationUser, sendTutorTaskEmail, sendTutorWelcomeEmail, sendSalesWelcomeEmail, sendOrderStatusChangeEmail };
