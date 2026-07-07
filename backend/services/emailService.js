const nodemailer = require('nodemailer');
const db = require('../config/db');
const { decryptSecret } = require('../utils/crypto');
const { formatOrderRef } = require('../utils/orderCode');
require('dotenv').config();

const { getAdminEmails } = require('./settings');

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
      brand: { name: s.name, logoUrl: s.logo_url ? `https://thetranslations.cc${s.logo_url}` : null }
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

async function sendEmailChangeCode(newEmail, username, code, siteId) {
  if (!newEmail) return;
  const ctx = await resolveContext(siteId);
  const html = `
    ${header(ctx.brand, 'Verify your new email')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hi ${username}, please use the code below to confirm this email address for your ${ctx.brand.name} account.</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #84C225; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Your verification code</p>
        <p style="margin: 0; font-family: monospace; font-size: 32px; letter-spacing: 8px; color: #84C225; font-weight: 700;">${code}</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">This code expires in 15 minutes. If you did not request this change, you can safely ignore this email — your current email will remain unchanged.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to: newEmail, subject: `Verify your new email - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Email-change code sent to ${newEmail}`);
}

// ───────────────────────── Issue / Support-ticket emails ─────────────────────────

async function sendIssueCreated({ issueId, subject, category, description, userName, userEmail, orderId, recipients }) {
  if (!recipients || recipients.length === 0) return;
  const ctx = await resolveContext(orderId ? await getOrderSiteId(orderId) : null);
  const ref = orderId ? await formatOrderRef(orderId) : null;
  const html = `
    ${header(ctx.brand, '🆘 New Support Issue')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 16px;">${userName || 'A student'} just opened a new issue.</p>
      <div style="background: #f0f9ff; padding: 18px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 18px;">
        <p style="margin: 4px 0; color: #334155;"><strong>Issue:</strong> #${issueId}</p>
        <p style="margin: 4px 0; color: #334155;"><strong>Subject:</strong> ${subject}</p>
        <p style="margin: 4px 0; color: #334155;"><strong>Category:</strong> ${category}</p>
        ${ref ? `<p style="margin: 4px 0; color: #334155;"><strong>Order:</strong> ${ref}</p>` : ''}
        <p style="margin: 4px 0; color: #334155;"><strong>From:</strong> ${userName || ''} ${userEmail ? `&lt;${userEmail}&gt;` : ''}</p>
      </div>
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px; white-space: pre-wrap; color: #334155;">${description}</div>
      <p style="color: #64748b; font-size: 14px;">Log in to the admin panel → Issues to reply.</p>
    ${footer(ctx.brand)}`;
  for (const to of recipients) {
    const ok = await sendViaContext(ctx, { to, subject: `[Issue #${issueId}] ${subject} - ${ctx.brand.name}`, html });
    if (ok) console.log(`✅ Issue-created email sent to ${to}`);
  }
}

async function sendIssueReplyToUser({ issueId, subject, body, userName, to }) {
  if (!to) return;
  const ctx = masterContext();
  const html = `
    ${header(ctx.brand, '💬 Support Reply')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 16px;">Hi ${userName || 'there'}, support just replied to your issue.</p>
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 16px; white-space: pre-wrap; color: #334155;">${body}</div>
      <p style="color: #64748b; font-size: 14px;">Open your dashboard → Issues to reply.</p>
    ${footer(ctx.brand)}`;
  const ok = await sendViaContext(ctx, { to, subject: `Re: [Issue #${issueId}] ${subject} - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Issue reply (to user) sent to ${to}`);
}

async function sendIssueReplyToAdmin({ issueId, subject, body, userName, recipients }) {
  if (!recipients || recipients.length === 0) return;
  const ctx = masterContext();
  const html = `
    ${header(ctx.brand, '💬 User Replied')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 16px;">${userName || 'The student'} replied on issue #${issueId}.</p>
      <div style="background: #fff7ed; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 16px; white-space: pre-wrap; color: #334155;">${body}</div>
      <p style="color: #64748b; font-size: 14px;">Open the admin panel → Issues to reply.</p>
    ${footer(ctx.brand)}`;
  for (const to of recipients) {
    const ok = await sendViaContext(ctx, { to, subject: `Re: [Issue #${issueId}] ${subject} - ${ctx.brand.name}`, html });
    if (ok) console.log(`✅ Issue reply (to admin) sent to ${to}`);
  }
}

/**
 * User updated the school login details on an order — notify admin + all
 * active sales users so they know fresh credentials are available.
 */
async function sendLoginDetailsUpdated(details) {
  const { orderId, courseName, username, recipients, siteId } = details;
  if (!recipients || recipients.length === 0) return;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);

  const html = `
    ${header(ctx.brand, '🔐 Login Details Updated')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">
        ${username || 'A student'} just updated the school login details for an order.
        Please log in to the admin panel to view the new credentials.
      </p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order:</strong> ${ref}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Updated at:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Credentials are only visible inside the admin panel for security; they are not included in this email.</p>
    ${footer(ctx.brand)}
  `;
  for (const to of recipients) {
    const ok = await sendViaContext(ctx, { to, subject: `Login details updated - Order ${ref} - ${ctx.brand.name}`, html });
    if (ok) console.log(`✅ Login-updated email sent to ${to} for order ${ref}`);
  }
}

async function sendNewOrderAdmin(orderDetails) {
  const { orderId, courseName, username, orderType, subject, educationLevel, status, sourceUrl, planName, totalPrice, paymentStatus, paymentType, amountPaid, amountRemaining, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);

  const pStatus = paymentStatus || 'unpaid';
  const paymentColors = { completed: { bg: '#dcfce7', text: '#16a34a' }, pending: { bg: '#fef3c7', text: '#d97706' }, cancelled: { bg: '#fee2e2', text: '#dc2626' }, unpaid: { bg: '#f1f5f9', text: '#64748b' }, partial: { bg: '#fef3c7', text: '#d97706' } };
  const pColor = paymentColors[pStatus] || paymentColors.unpaid;

  const partialBanner = paymentType === 'partial' && parseFloat(amountRemaining || 0) > 0 ? `
    <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #d97706;">
      <p style="margin: 0 0 6px 0; color: #ffffff; font-weight: 700; font-size: 15px;">⚠️ PARTIAL PAYMENT RECEIVED</p>
      <p style="margin: 0; color: #ffffff; font-size: 13px;">Paid: <strong>$${parseFloat(amountPaid || 0).toFixed(2)}</strong> &nbsp;|&nbsp; Remaining: <strong>$${parseFloat(amountRemaining || 0).toFixed(2)}</strong></p>
    </div>` : '';

  const html = `
    ${header(ctx.brand, '📋 New Order Notification')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">A new order has been ${status === 'incomplete' ? 'started' : 'updated'}.</p>
      ${partialBanner}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Order ID</td><td style="padding: 10px 0; color: #334155; font-weight: 600; text-align: right;">${ref}</td></tr>
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
    to: (await getAdminEmails()).join(', '),
    subject: `Order ${ref} - ${status === 'incomplete' ? 'New Draft' : status === 'active' ? 'Payment Confirmed' : 'Updated'} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Admin order email sent for order ${ref}`);
}

async function sendOrderConfirmationUser(email, orderDetails) {
  if (!email) return;
  const { orderId, courseName, status, planName, totalPrice, paymentType, amountPaid, amountRemaining, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);

  const isPaid = status === 'active';
  const isPartial = paymentType === 'partial' && parseFloat(amountRemaining || 0) > 0;
  const partialBanner = isPartial ? `
    <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #d97706;">
      <p style="margin: 0 0 6px 0; color: #ffffff; font-weight: 700; font-size: 15px;">⚠️ PARTIAL PAYMENT</p>
      <p style="margin: 0 0 4px 0; color: #ffffff; font-size: 13px;">Paid: <strong>$${parseFloat(amountPaid || 0).toFixed(2)}</strong></p>
      <p style="margin: 0; color: #ffffff; font-size: 13px;">Remaining: <strong>$${parseFloat(amountRemaining || 0).toFixed(2)}</strong> &mdash; Pay anytime from your dashboard.</p>
    </div>` : '';

  const html = `
    ${header(ctx.brand, isPaid ? (isPartial ? '✅ Partial Payment Received' : '✅ Payment Confirmed!') : '📝 Order Started')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">${isPaid ? (isPartial ? 'We received your partial payment. Your order is now active. Please pay the remaining balance at your convenience.' : 'Your payment has been processed and your order is now active!') : 'Your order has been started. Complete the remaining steps to proceed to payment.'}</p>
      ${partialBanner}
      <div style="background: ${isPaid ? '#f0fdf4' : '#f0f9ff'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isPaid ? '#22c55e' : '#3b82f6'}; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> ${ref}</p>
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
    subject: `${isPaid ? 'Payment Confirmed' : 'Order Started'} - Order ${ref} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ User order email sent to ${email} for order ${ref}`);
}

async function sendTutorTaskEmail(email, name, orderDetails) {
  if (!email) return;
  const { orderId, courseName, subject, planName, siteId } = orderDetails;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);

  const html = `
    ${header(ctx.brand, '🎓 New Task Assigned')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">A new task has been assigned to you. Please check your dashboard for more details.</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> ${ref}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        ${subject ? `<p style="margin: 5px 0; color: #334155;"><strong>Subject:</strong> ${subject}</p>` : ''}
        ${planName ? `<p style="margin: 5px 0; color: #334155;"><strong>Plan:</strong> ${planName}</p>` : ''}
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your Tutor Panel to start working on this task.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, {
    to: email,
    subject: `New Task Assigned: Order ${ref} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Tutor task email sent to ${email} for order ${ref}`);
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
  const ref = await formatOrderRef(orderId);

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
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> ${ref}</p>
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
    subject: `Order ${ref} Status Updated to ${newStatus.replace('_', ' ').toUpperCase()} - ${ctx.brand.name}`,
    html
  });
  if (ok) console.log(`✅ Status change email sent to ${email} for order ${ref}`);
}

// ───────────────────────── installment emails ─────────────────────────

async function sendInstallmentPlanCreated(email, details) {
  if (!email) return;
  const { orderId, username, installments, convenienceFee, siteId } = details;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);

  const rows = installments.map(i => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px; color: #334155;">Installment ${i.installment_number}</td>
      <td style="padding: 10px; color: #334155; text-align: center;">${new Date(i.due_date).toLocaleDateString()}</td>
      <td style="padding: 10px; color: #84C225; font-weight: 700; text-align: right;">$${parseFloat(i.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    ${header(ctx.brand, '📅 Installment Plan Created')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${username || 'there'}, an installment plan has been set up for Order ${ref}.</p>
      ${convenienceFee > 0 ? `<p style="color: #d97706; font-size: 14px; margin-bottom: 16px;">Convenience fee: <strong>$${parseFloat(convenienceFee).toFixed(2)}</strong></p>` : ''}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border-radius: 8px;">
        <thead><tr style="background: #0C2D64;"><th style="padding: 12px; color: #fff; text-align: left;">Installment</th><th style="padding: 12px; color: #fff; text-align: center;">Due Date</th><th style="padding: 12px; color: #fff; text-align: right;">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color: #64748b; font-size: 14px;">Pay each installment from your dashboard. You can also pay all installments at once anytime.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to: email, subject: `Installment Plan - Order ${ref} - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Installment plan email sent to ${email} for order ${ref}`);
}

async function sendInstallmentReminder(email, details) {
  const { orderId, username, installmentNumber, amount, dueDate, daysUntilDue, siteId, recipient } = details;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const to = recipient === 'admin' ? (await getAdminEmails()).join(', ') : email;
  if (!to) return;
  const ref = await formatOrderRef(orderId);

  const isOverdue = daysUntilDue < 0;
  const title = isOverdue ? '⚠️ Installment Overdue' : '⏰ Installment Reminder';
  const urgency = isOverdue ? `<strong>OVERDUE by ${Math.abs(daysUntilDue)} day(s)</strong>` :
                  daysUntilDue === 0 ? '<strong>DUE TODAY</strong>' :
                  `Due in <strong>${daysUntilDue} day(s)</strong>`;

  const html = `
    ${header(ctx.brand, title)}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">
        ${recipient === 'admin' ? `${username}'s installment is ${isOverdue ? 'overdue' : 'coming up'}.` : `Your installment is ${isOverdue ? 'overdue' : 'coming up'}.`}
      </p>
      <div style="background: ${isOverdue ? '#fee2e2' : '#fef3c7'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isOverdue ? '#dc2626' : '#d97706'}; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order:</strong> ${ref}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Installment:</strong> ${installmentNumber}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Amount:</strong> <span style="color: #84C225; font-weight: 700;">$${parseFloat(amount).toFixed(2)}</span></p>
        <p style="margin: 5px 0; color: #334155;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
        <p style="margin: 12px 0 0 0; color: ${isOverdue ? '#dc2626' : '#d97706'}; font-size: 14px;">${urgency}</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your dashboard to pay this installment.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to, subject: `${title} - Order ${ref}`, html });
  if (ok) console.log(`✅ Installment reminder sent to ${to} for order ${ref} installment ${installmentNumber}`);
}

async function sendInstallmentPaid(email, details) {
  if (!email) return;
  const { orderId, username, paidInstallments, siteId } = details;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);
  const total = paidInstallments.reduce((s, i) => s + parseFloat(i.amount), 0);

  const html = `
    ${header(ctx.brand, '✅ Installment Payment Received')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${username || 'there'}, we received your installment payment for Order ${ref}.</p>
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 20px;">
        ${paidInstallments.map(i => `<p style="margin: 5px 0; color: #334155;">Installment ${i.installment_number}: <strong>$${parseFloat(i.amount).toFixed(2)}</strong></p>`).join('')}
        <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #d1fae5; color: #16a34a; font-weight: 700; font-size: 18px;">Paid: $${total.toFixed(2)}</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Thank you for your payment!</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to: email, subject: `Payment Received - Order ${ref} - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Installment paid email sent to ${email} for order ${ref}`);
}

// Admin email when staff record a manual payment (Unpaid→Paid collection).
async function sendPaymentCollectedAdmin(details) {
  const { orderId, courseName, username, paymentType, amount, remaining, mode, invoiceNo, paymentDate, note, collectedByName, collectedByRole, siteId } = details;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);
  const isPartial = paymentType === 'partial';
  const row = (label, value) => `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0;color:#64748b;font-size:14px;">${label}</td><td style="padding:10px 0;color:#334155;text-align:right;">${value}</td></tr>`;
  const html = `
    ${header(ctx.brand, '💰 Payment Collected')}
      <p style="color:#334155;font-size:16px;margin-bottom:20px;">A ${isPartial ? 'partial' : 'full'} payment was recorded for order ${ref}.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${row('Order', `<strong>${ref}</strong>`)}
        ${row('Course', courseName || '—')}
        ${row('Customer', username || '—')}
        ${row('Payment type', `<span style="text-transform:capitalize;">${paymentType || 'full'}</span>`)}
        ${row('Amount', `<span style="color:#16a34a;font-weight:700;font-size:18px;">$${parseFloat(amount || 0).toFixed(2)}</span>`)}
        ${isPartial ? row('Remaining', `<span style="color:#d97706;font-weight:600;">$${parseFloat(remaining || 0).toFixed(2)}</span>`) : ''}
        ${row('Mode of communication', mode || '—')}
        ${row('Invoice No', invoiceNo || '—')}
        ${row('Date of payment', paymentDate || '—')}
        ${note ? row('Note', note) : ''}
        ${row('Recorded by', `${collectedByName || '—'}${collectedByRole ? ` (${collectedByRole.replace('_', ' ')})` : ''}`)}
      </table>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to: (await getAdminEmails()).join(', '), subject: `Payment collected - Order ${ref} - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Payment-collected email sent for order ${ref}`);
}

// Notify admin + sales leads when an installment plan is edited (dates/amounts).
async function sendInstallmentEditedStaff(details) {
  const { orderId, courseName, editedByName, editedByRole, changes, recipients, siteId } = details;
  const to = [...new Set((recipients || []).filter(Boolean))].join(', ');
  if (!to) return;
  const ctx = await resolveContext(siteId || await getOrderSiteId(orderId));
  const ref = await formatOrderRef(orderId);
  const rows = (changes || []).map(c => {
    const parts = [];
    if (c.prevDate !== c.newDate) parts.push(`Due date: <strong>${c.prevDate || '—'}</strong> → <strong>${c.newDate || '—'}</strong>`);
    if (c.prevAmount != null && parseFloat(c.prevAmount) !== parseFloat(c.newAmount)) parts.push(`Amount: <strong>$${parseFloat(c.prevAmount).toFixed(2)}</strong> → <strong>$${parseFloat(c.newAmount).toFixed(2)}</strong>`);
    return `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0;color:#64748b;font-size:14px;">Installment #${c.installmentNumber}</td><td style="padding:10px 0;color:#334155;text-align:right;">${parts.join('<br>')}</td></tr>`;
  }).join('');
  const html = `
    ${header(ctx.brand, '✏️ Installment Plan Edited')}
      <p style="color:#334155;font-size:16px;margin-bottom:20px;">The installment plan for order ${ref} was edited by <strong>${editedByName || 'staff'}</strong>${editedByRole ? ` (${editedByRole.replace('_', ' ')})` : ''}.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0;color:#64748b;font-size:14px;">Order</td><td style="padding:10px 0;color:#334155;font-weight:600;text-align:right;">${ref}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0;color:#64748b;font-size:14px;">Course</td><td style="padding:10px 0;color:#334155;text-align:right;">${courseName || '—'}</td></tr>
        ${rows}
      </table>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to, subject: `Installment plan edited - Order ${ref} - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Installment-edited email sent for order ${ref}`);
}

// Notify a tutor a support ticket was escalated to them.
async function sendIssueEscalatedTutor({ issueId, subject, tutorName, to }) {
  if (!to) return;
  const ctx = await resolveContext(null);
  const html = `
    ${header(ctx.brand, '🔺 Escalation Assigned to You')}
      <p style="color:#334155;font-size:16px;margin-bottom:20px;">Hi ${tutorName || 'there'}, a support ticket has been escalated to you.</p>
      <div style="background:#f0f9ff;padding:20px;border-radius:8px;border-left:4px solid #3b82f6;margin-bottom:20px;">
        <p style="margin:5px 0;color:#334155;"><strong>Ticket:</strong> #${issueId}</p>
        <p style="margin:5px 0;color:#334155;"><strong>Subject:</strong> ${subject || '—'}</p>
      </div>
      <p style="color:#64748b;font-size:14px;">Open your Tutor panel → <strong>Escalation</strong> to view and reply.</p>
    ${footer(ctx.brand)}
  `;
  const ok = await sendViaContext(ctx, { to, subject: `Escalation assigned - #${issueId} - ${ctx.brand.name}`, html });
  if (ok) console.log(`✅ Escalation email sent to tutor for issue #${issueId}`);
}

// ───────────────────── sales-task emails ─────────────────────
// Generic staff/sales task notification email. `to` may be a string or array.
async function staffTaskEmail(to, subject, title, introHtml, rows) {
  const list = Array.isArray(to) ? to.filter(Boolean) : (to ? [to] : []);
  if (!list.length) return;
  const ctx = masterContext();
  const rowsHtml = (rows || []).filter(Boolean)
    .map(r => `<p style="margin:5px 0;color:#334155;"><strong>${r.label}:</strong> ${r.value}</p>`).join('');
  const html = `
    ${header(ctx.brand, title)}
      <p style="color:#334155;font-size:15px;margin-bottom:16px;">${introHtml}</p>
      <div style="background:#f0f9ff;padding:18px;border-radius:8px;border-left:4px solid #84C225;margin-bottom:16px;">${rowsHtml}</div>
      <p style="color:#64748b;font-size:13px;">Open your panel → <strong>Dashboard</strong> to view it.</p>
    ${footer(ctx.brand)}
  `;
  await sendViaContext(ctx, { to: list.join(','), subject, html });
}

async function sendSalesTaskAssigned({ to, title, dueDate, orderRef, amount, byName }) {
  await staffTaskEmail(to, 'A task was assigned to you', 'New task assigned',
    `${byName || 'An admin'} assigned you a task on the sales dashboard.`,
    [{ label: 'Task', value: title }, dueDate && { label: 'Due', value: dueDate },
     orderRef && { label: 'Order', value: orderRef }, amount != null && { label: 'Amount', value: '$' + Number(amount).toFixed(2) }]);
}
async function sendSalesTaskGeneral({ to, title, dueDate, byName }) {
  await staffTaskEmail(to, 'New team task created', 'New team task',
    `${byName || 'An admin'} created a task for the whole sales team.`,
    [{ label: 'Task', value: title }, dueDate && { label: 'Due', value: dueDate }]);
}
async function sendSalesTaskCompleted({ to, title, byName, orderRef, category }) {
  await staffTaskEmail(to, 'A sales task was completed', 'Sales task completed',
    `${byName || 'A sales person'} marked a task as completed.`,
    [{ label: 'Task', value: title }, category && { label: 'Type', value: category }, orderRef && { label: 'Order', value: orderRef }]);
}

module.exports = { sendAccessCode, sendForgotAccessCode, sendEmailChangeCode, sendNewOrderAdmin, sendOrderConfirmationUser, sendTutorTaskEmail, sendTutorWelcomeEmail, sendSalesWelcomeEmail, sendOrderStatusChangeEmail, sendInstallmentPlanCreated, sendInstallmentReminder, sendInstallmentPaid, sendLoginDetailsUpdated, sendIssueCreated, sendIssueReplyToUser, sendIssueReplyToAdmin, sendPaymentCollectedAdmin, sendInstallmentEditedStaff, sendIssueEscalatedTutor, sendSalesTaskAssigned, sendSalesTaskGeneral, sendSalesTaskCompleted };
