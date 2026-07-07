// Record an offline/manual payment collection against an order and flip it off
// "Unpaid" — the shared engine used when a sales person completes an unpaid /
// partial payment task. Mirrors the Admin "Unpaid → Paid" flow in
// adminController.updateOrderStatus, reusing the same audit + status helpers.

const db = require('../config/db');
const statuses = require('../utils/statuses');
const { recordCollection } = require('./paymentCollections');
const { notifyUser } = require('./notifyUser');

const round2 = (v) => Math.round(v * 100) / 100;
const err = (msg, status) => { const e = new Error(msg); e.status = status; return e; };

// { orderId, payment:{ amount, mode_of_communication, invoice_no, payment_date, note } }
// Payment type (full/partial) is DERIVED from the amount vs. the balance, so the
// caller can't record an inconsistent state.
async function collectOrderPayment(req, io, { orderId, payment }) {
  const [[o]] = await db.query(
    `SELECT o.*, ast.code AS admin_code FROM orders o
       JOIN admin_statuses ast ON o.admin_status_id = ast.id WHERE o.id = ?`, [orderId]);
  if (!o) throw err('Order not found', 404);
  if (req.salesCutoff && new Date(o.created_at) < req.salesCutoff) throw err('This order is outside your access window.', 403);

  const currentlyUnpaid = o.admin_code === 'unpaid';
  const currentlyPartial = /^paid_partial/.test(o.admin_code);
  if (!currentlyUnpaid && !currentlyPartial) throw err('This order is not awaiting payment.', 400);

  const pay = payment || {};
  const mode = String(pay.mode_of_communication || '').trim();
  const invoiceNo = String(pay.invoice_no || '').trim();
  const payDate = String(pay.payment_date || '').trim();
  const note = String(pay.note || '').trim();
  const amount = parseFloat(pay.amount);
  const total = parseFloat(o.total_price);
  const alreadyPaid = parseFloat(o.amount_paid) || 0;
  const balance = round2(Math.max(0, total - alreadyPaid));

  if (!mode) throw err('Mode of communication is required.', 400);
  if (!invoiceNo) throw err('Invoice number is required.', 400);
  if (!payDate) throw err('Date of payment is required.', 400);
  if (!Number.isFinite(amount) || amount <= 0) throw err('A valid payment amount is required.', 400);
  if (amount > balance + 0.001) throw err(`Amount cannot exceed the outstanding balance ($${balance.toFixed(2)}).`, 400);

  const amountPaid = round2(alreadyPaid + amount);
  const amountRemaining = round2(Math.max(0, total - amountPaid));
  const paymentType = amountRemaining > 0 ? 'partial' : 'full';
  const newCode = amountRemaining > 0 ? 'paid_partial_unassigned' : 'paid_full_unassigned';
  const newAdminId = await statuses.adminId(newCode);

  await db.query(
    `UPDATE orders SET payment_type = ?, amount_paid = ?, amount_remaining = ?, admin_status_id = ?,
            status = IF(status = 'incomplete', 'active', status)
       WHERE id = ?`,
    [paymentType, amountPaid, amountRemaining, newAdminId, orderId]);

  // This single collection event books just the amount collected now.
  await recordCollection(req, {
    orderId, paymentType, amount: round2(amount),
    payment: { mode_of_communication: mode, invoice_no: invoiceNo, payment_date: payDate, note },
  });
  await db.query('INSERT INTO payments (order_id, user_id, amount, status) VALUES (?, ?, ?, ?)',
    [orderId, o.user_id, round2(amount), 'completed']);

  // Confirm to the student's bell (best-effort).
  try {
    const ref = await require('../utils/orderCode').formatOrderRef(orderId);
    await notifyUser(io, o.user_id, {
      type: 'payment_received',
      message: `Payment of $${round2(amount).toFixed(2)} recorded for order ${ref}${amountRemaining > 0 ? ` — balance $${amountRemaining.toFixed(2)}` : ' — fully paid'}`,
      referenceId: Number(orderId), referenceType: 'order',
    });
  } catch (e) { console.error('collectOrderPayment student notify failed:', e.message); }

  return { orderId, paymentType, amountCollected: round2(amount), amountPaid, amountRemaining, admin_code: newCode };
}

module.exports = { collectOrderPayment };
