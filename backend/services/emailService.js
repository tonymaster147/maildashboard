const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const ADMIN_EMAIL = 'faruqui.a4u@gmail.com';
const FROM = process.env.EMAIL_FROM || 'noreply@tutoringplatform.com';

const header = (title) => `
  <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #0C2D64, #1a4a8a); padding: 32px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${title}</h1>
    </div>
    <div style="padding: 32px 30px;">
`;

const footer = `
    </div>
    <div style="background: #f8fafc; padding: 16px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} EduPro Tutoring Platform</p>
    </div>
  </div>
`;

/**
 * Send access code to user after signup
 */
async function sendAccessCode(email, username, accessCode) {
  if (!email) return;
  
  const html = `
    ${header('Welcome to EduPro!')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Your account has been created successfully.</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #84C225; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Username:</strong> ${username}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Access Code:</strong> <span style="background: #84C225; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 18px; letter-spacing: 2px;">${accessCode}</span></p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Please save your access code securely. You will need it to log in.</p>
      <p style="color: #64748b; font-size: 14px;">If you did not create this account, please ignore this email.</p>
    ${footer}
  `;

  try {
    await transporter.sendMail({ from: FROM, to: email, subject: 'Your Account Access Code - EduPro', html });
    console.log(`✅ Access code email sent to ${email}`);
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
  }
}

/**
 * Send new access code after forgot request
 */
async function sendForgotAccessCode(email, username, newAccessCode) {
  if (!email) return;

  const html = `
    ${header('Access Code Reset')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">We received a request to reset your access code. Here are your updated credentials:</p>
      <div style="background: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Username:</strong> ${username}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>New Access Code:</strong> <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 18px; letter-spacing: 2px;">${newAccessCode}</span></p>
      </div>
      <p style="color: #ef4444; font-size: 14px; font-weight: 500;">⚠️ Your previous access code has been invalidated.</p>
      <p style="color: #64748b; font-size: 14px;">If you did not request this, please contact support immediately.</p>
    ${footer}
  `;

  try {
    await transporter.sendMail({ from: FROM, to: email, subject: 'Access Code Reset - EduPro', html });
    console.log(`✅ Forgot access code email sent to ${email}`);
  } catch (error) {
    console.error('❌ Forgot access code email failed:', error.message);
  }
}

/**
 * Send order notification to admin (on every step)
 */
async function sendNewOrderAdmin(orderDetails) {
  const { orderId, courseName, username, orderType, subject, educationLevel, status, sourceUrl, planName, totalPrice } = orderDetails;

  const html = `
    ${header('📋 New Order Notification')}
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
        <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Status</td><td style="padding: 10px 0; text-align: right;"><span style="background: ${status === 'active' ? '#dcfce7' : '#fef3c7'}; color: ${status === 'active' ? '#16a34a' : '#d97706'}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${status}</span></td></tr>
      </table>
    ${footer}
  `;

  try {
    await transporter.sendMail({ from: FROM, to: ADMIN_EMAIL, subject: `Order #${orderId} - ${status === 'incomplete' ? 'New Draft' : status === 'active' ? 'Payment Confirmed' : 'Updated'} - EduPro`, html });
    console.log(`✅ Admin order email sent for order #${orderId}`);
  } catch (error) {
    console.error('❌ Admin order email failed:', error.message);
  }
}

/**
 * Send order confirmation to user (step 1 + after payment)
 */
async function sendOrderConfirmationUser(email, orderDetails) {
  if (!email) return;
  const { orderId, courseName, status, planName, totalPrice } = orderDetails;

  const isPaid = status === 'active';

  const html = `
    ${header(isPaid ? '✅ Payment Confirmed!' : '📝 Order Started')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">${isPaid ? 'Your payment has been processed and your order is now active!' : 'Your order has been started. Complete the remaining steps to proceed to payment.'}</p>
      <div style="background: ${isPaid ? '#f0fdf4' : '#f0f9ff'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${isPaid ? '#22c55e' : '#3b82f6'}; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        ${planName ? `<p style="margin: 5px 0; color: #334155;"><strong>Plan:</strong> ${planName}</p>` : ''}
        ${totalPrice ? `<p style="margin: 5px 0; color: #334155;"><strong>Total:</strong> <span style="color: #84C225; font-weight: 700; font-size: 18px;">$${parseFloat(totalPrice).toFixed(2)}</span></p>` : ''}
        <p style="margin: 5px 0; color: #334155;"><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: 600; color: ${isPaid ? '#16a34a' : '#d97706'};">${status}</span></p>
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your dashboard to view or manage your order.</p>
    ${footer}
  `;

  try {
    await transporter.sendMail({ from: FROM, to: email, subject: `${isPaid ? 'Payment Confirmed' : 'Order Started'} - Order #${orderId} - EduPro`, html });
    console.log(`✅ User order email sent to ${email} for order #${orderId}`);
  } catch (error) {
    console.error('❌ User order email failed:', error.message);
  }
}

/**
 * Send task assignment notification to tutor
 */
async function sendTutorTaskEmail(email, name, orderDetails) {
  if (!email) return;
  const { orderId, courseName, subject, planName } = orderDetails;

  const html = `
    ${header('🎓 New Task Assigned')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">A new task has been assigned to you. Please check your dashboard for more details.</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Course:</strong> ${courseName || 'N/A'}</p>
        ${subject ? `<p style="margin: 5px 0; color: #334155;"><strong>Subject:</strong> ${subject}</p>` : ''}
        ${planName ? `<p style="margin: 5px 0; color: #334155;"><strong>Plan:</strong> ${planName}</p>` : ''}
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your Tutor Panel to start working on this task.</p>
    ${footer}
  `;

  try {
    await transporter.sendMail({ from: FROM, to: email, subject: `New Task Assigned: Order #${orderId} - EduPro`, html });
    console.log(`✅ Tutor task email sent to ${email} for order #${orderId}`);
  } catch (error) {
    console.error('❌ Tutor task email failed:', error.message);
  }
}

/**
 * Send welcome email to new tutor with credentials
 */
async function sendTutorWelcomeEmail(email, name, password) {
  if (!email) return;

  const html = `
    ${header('Welcome to EduPro Tutors!')}
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
      <p style="color: #334155; font-size: 16px; margin-bottom: 20px;">An administrator has just created a Tutor account for you. Here are your login credentials:</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin-bottom: 20px;">
        <p style="margin: 5px 0; color: #334155;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0; color: #334155;"><strong>Password:</strong> <span style="background: #8b5cf6; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 16px; letter-spacing: 1px;">${password}</span></p>
      </div>
      <p style="color: #ef4444; font-size: 14px; font-weight: 500;">⚠️ Please keep your credentials secure and log into the Tutor Portal to see your tasks.</p>
    ${footer}
  `;

  try {
    await transporter.sendMail({ from: FROM, to: email, subject: 'Your Tutor Account Credentials - EduPro', html });
    console.log(`✅ Tutor welcome email sent to ${email}`);
  } catch (error) {
    console.error('❌ Tutor welcome email failed:', error.message);
  }
}

module.exports = { sendAccessCode, sendForgotAccessCode, sendNewOrderAdmin, sendOrderConfirmationUser, sendTutorTaskEmail, sendTutorWelcomeEmail };
