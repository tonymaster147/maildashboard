// Helpers for the manual payment-collection records (order_payment_collections)
// captured whenever staff record money against an order: the initial
// Unpaid→Paid, marking the remaining paid, or marking installment(s) paid.

const db = require('../config/db');

// Returns an error string if the required fields are missing, else null.
function validateCollectionFields(payment) {
  const pay = payment || {};
  if (!String(pay.mode_of_communication || '').trim()) return 'Mode of communication is required.';
  if (!String(pay.invoice_no || '').trim()) return 'Invoice number is required.';
  if (!String(pay.payment_date || '').trim()) return 'Date of payment is required.';
  return null;
}

// Insert one collection row. `amount` is server-decided (the caller passes the
// authoritative value — remaining / installment amount, not the client's).
async function recordCollection(req, { orderId, paymentType, amount, payment }) {
  const pay = payment || {};
  let collectorName = req.user.name || req.user.username || null;
  if (!collectorName) {
    if (req.user.role === 'admin') collectorName = 'Admin';
    else {
      const [[su]] = await db.query('SELECT name FROM sales_users WHERE id = ?', [req.user.id]);
      collectorName = su ? su.name : null;
    }
  }
  await db.query(
    `INSERT INTO order_payment_collections
       (order_id, payment_type, mode_of_communication, invoice_no, payment_date, amount, note, collected_by_id, collected_by_role, collected_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId, paymentType,
      String(pay.mode_of_communication || '').trim(),
      String(pay.invoice_no || '').trim(),
      String(pay.payment_date || '').trim() || null,
      amount,
      String(pay.note || '').trim() || null,
      req.user.id, req.user.role, collectorName,
    ]
  );
}

module.exports = { validateCollectionFields, recordCollection };
