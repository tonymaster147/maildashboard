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

/**
 * Send access code to user after signup
 */
async function sendAccessCode(email, username, accessCode) {
  if (!email) return;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@tutoringplatform.com',
    to: email,
    subject: 'Your Account Access Code - Tutoring Platform',
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0C2D64; border-radius: 12px; overflow: hidden;">
        <div style="padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0 0 10px;">Welcome to Tutoring Platform</h1>
          <p style="color: #a0b4d0; font-size: 16px;">Your account has been created successfully!</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 12px 12px 0 0;">
          <h2 style="color: #0C2D64; margin: 0 0 20px;">Account Details</h2>
          <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 5px 0; color: #333;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Access Code:</strong> <span style="background: #84C225; color: white; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 18px;">${accessCode}</span></p>
          </div>
          <p style="color: #666; font-size: 14px;">Please keep your access code safe. You will need it to log in to your account.</p>
          <p style="color: #666; font-size: 14px;">If you did not create this account, please ignore this email.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Access code email sent to ${email}`);
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
  }
}

/**
 * Send order notification
 */
async function sendOrderNotification(email, orderId, status) {
  if (!email) return;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@tutoringplatform.com',
    to: email,
    subject: `Order #${orderId} - Status Update`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0C2D64; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Order Update</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 12px 12px;">
          <p style="color: #333; font-size: 16px;">Your order <strong>#${orderId}</strong> status has been updated to:</p>
          <p style="background: #84C225; color: white; display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; text-transform: uppercase;">${status}</p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">Log in to your dashboard to view more details.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('❌ Order notification email failed:', error.message);
  }
}

module.exports = { sendAccessCode, sendOrderNotification };
