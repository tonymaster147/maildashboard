const stripe = require('../config/stripe');
const db = require('../config/db');
const { sendNewOrderAdmin, sendOrderConfirmationUser } = require('../services/emailService');
require('dotenv').config();

/**
 * Create Stripe Checkout session
 */
const PARTIAL_PAYMENT_AMOUNT = 150;

function isPartialEligible(order, orderTypeName) {
  if (!orderTypeName || !orderTypeName.toLowerCase().includes('online class')) return false;
  if (!order.start_date || !order.end_date) return false;
  const start = new Date(order.start_date);
  const end = new Date(order.end_date);
  const days = (end - start) / (1000 * 60 * 60 * 24);
  return days >= 45;
}

exports.checkPartialEligibility = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id } = req.query;
    const [orders] = await db.query(
      `SELECT o.*, ot.name as order_type_name FROM orders o
       JOIN order_types ot ON o.order_type_id = ot.id
       WHERE o.id = ? AND o.user_id = ?`, [order_id, userId]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const eligible = isPartialEligible(orders[0], orders[0].order_type_name);
    res.json({ eligible, partial_amount: PARTIAL_PAYMENT_AMOUNT, total_price: orders[0].total_price });
  } catch (error) {
    console.error('Partial eligibility error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id, payment_type } = req.body;

    // Fetch the draft order
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = "incomplete"', [order_id, userId]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not in draft state' });
    }

    const order_data = orders[0];

    // Use stored price from the draft order (already calculated during order form)
    let price = parseFloat(order_data.price || 0);
    let urgentFee = parseFloat(order_data.urgent_fee || 0);
    let discountAmount = parseFloat(order_data.discount_amount || 0);

    // Fallback: if price is 0 and plan_id exists, use legacy plan pricing
    if (price === 0 && order_data.plan_id) {
      const [plans] = await db.query('SELECT price FROM plans WHERE id = ?', [order_data.plan_id]);
      if (plans.length > 0) {
        price = parseFloat(plans[0].price);
      }
    }

    const fullTotal = price + urgentFee - discountAmount;

    // Determine if partial payment is being requested
    let isPartial = false;
    if (payment_type === 'partial') {
      const [orderType] = await db.query('SELECT name FROM order_types WHERE id = ?', [order_data.order_type_id]);
      const orderTypeName = orderType.length > 0 ? orderType[0].name : '';
      if (isPartialEligible(order_data, orderTypeName) && fullTotal > PARTIAL_PAYMENT_AMOUNT) {
        isPartial = true;
      }
    }

    const chargeAmount = isPartial ? PARTIAL_PAYMENT_AMOUNT : fullTotal;
    const totalAmount = Math.round(chargeAmount * 100); // Stripe uses cents

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    const [users] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
    const userEmail = users.length > 0 ? users[0].email : null;

    // Build product name from order type
    const [orderType] = await db.query('SELECT name FROM order_types WHERE id = ?', [order_data.order_type_id]);
    const productName = orderType.length > 0 ? orderType[0].name : 'Order';

    // Resolve redirect base from order source_url, fallback to env
    const sourceBase = order_data.source_url ? order_data.source_url.replace(/\/$/, '') : null;
    const successUrl = sourceBase
      ? `${sourceBase}/payment/success?session_id={CHECKOUT_SESSION_ID}`
      : `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = sourceBase
      ? `${sourceBase}/payment/cancel?order_id=${order_id}`
      : `${process.env.STRIPE_CANCEL_URL}?order_id=${order_id}`;

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${productName} - ${order_data.course_name}${isPartial ? ' (Partial Payment)' : ''}`,
              description: isPartial ? `Order #${order_id} - Partial Payment $${PARTIAL_PAYMENT_AMOUNT} of $${fullTotal.toFixed(2)}` : `Order #${order_id}`
            },
            unit_amount: totalAmount
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId.toString(),
        order_id: order_id.toString(),
        payment_type: isPartial ? 'partial' : 'full',
        full_total: fullTotal.toFixed(2),
        charge_amount: chargeAmount.toFixed(2)
      }
    };

    if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store pending payment
    await db.query(
      'INSERT INTO payments (order_id, user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)',
      [order_id, userId, session.id, totalAmount / 100, 'pending']
    );

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe session error:', error);
    res.status(500).json({ error: 'Payment session creation failed' });
  }
};

/**
 * Extracted fulfillment logic
 */
const fulfillOrder = async (session, io) => {
  // Update payment status
  await db.query(
    'UPDATE payments SET stripe_payment_id = ?, status = "completed" WHERE stripe_session_id = ?',
    [session.payment_intent, session.id]
  );

  const orderId = parseInt(session.metadata.order_id);
  const paymentType = session.metadata.payment_type || 'full';
  const chargeAmount = parseFloat(session.metadata.charge_amount || '0');
  const fullTotal = parseFloat(session.metadata.full_total || '0');

  // Check if this is paying remaining balance on an already-active order
  const isRemainingPayment = session.metadata.remaining_payment === 'true';

  if (isRemainingPayment) {
    // Add to amount_paid, reduce remaining
    await db.query(
      `UPDATE orders
       SET amount_paid = amount_paid + ?,
           amount_remaining = GREATEST(amount_remaining - ?, 0),
           payment_type = CASE WHEN amount_remaining - ? <= 0 THEN 'full' ELSE 'partial' END
       WHERE id = ?`,
      [chargeAmount, chargeAmount, chargeAmount, orderId]
    );
  } else {
    // First payment for this order
    const amountRemaining = paymentType === 'partial' ? Math.max(fullTotal - chargeAmount, 0) : 0;
    await db.query(
      'UPDATE orders SET status = "active", payment_type = ?, amount_paid = ?, amount_remaining = ? WHERE id = ?',
      [paymentType, chargeAmount, amountRemaining, orderId]
    );
  }

  // Create notification
  await db.query(
    'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
    ['admin', 'new_order', `New paid order #${orderId}`, orderId, 'order']
  );

  // Emit live notification to admin/sales panels
  if (io) {
    io.to('admin_monitor').emit('newOrderNotification', { orderId });
  }

  // Send payment confirmation emails
  try {
    const [orderData] = await db.query(
      `SELECT o.*, u.username, u.email, ot.name as order_type_name, s.name as subject_name, el.name as education_level_name, p.name as plan_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN order_types ot ON o.order_type_id = ot.id
       LEFT JOIN subjects s ON o.subject_id = s.id
       LEFT JOIN education_levels el ON o.education_level_id = el.id
       LEFT JOIN plans p ON o.plan_id = p.id
       WHERE o.id = ?`, [orderId]
    );
    if (orderData.length > 0) {
      const od = orderData[0];
      const details = {
        orderId,
        courseName: od.course_name,
        username: od.username,
        orderType: od.order_type_name,
        subject: od.subject_name,
        educationLevel: od.education_level_name,
        planName: od.plan_name,
        totalPrice: od.total_price,
        sourceUrl: od.source_url,
        status: 'active',
        paymentStatus: od.payment_type === 'partial' ? 'partial' : 'completed',
        paymentType: od.payment_type,
        amountPaid: od.amount_paid,
        amountRemaining: od.amount_remaining
      };
      sendNewOrderAdmin(details).catch(e => console.error('Admin payment email error:', e));
      if (od.email) {
        sendOrderConfirmationUser(od.email, details).catch(e => console.error('User payment email error:', e));
      }
    }
  } catch (emailErr) {
    console.error('Payment email error:', emailErr);
  }
  
  return orderId;
};

/**
 * Stripe Webhook handler
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const io = req.app.get('io');
      await fulfillOrder(session, io);
    } catch (error) {
      console.error('Order creation from webhook failed:', error);
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    if (intent.metadata && intent.metadata.order_id) {
      try {
        const io = req.app.get('io');
        await fulfillOrder({ id: intent.id, payment_intent: intent.id, metadata: intent.metadata }, io);
      } catch (error) {
        console.error('PaymentIntent fulfillment failed:', error);
      }
    }
  }

  res.json({ received: true });
};

/**
 * Get payment history for user
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const [payments] = await db.query(
      `SELECT p.*, o.course_name, o.status as order_status 
       FROM payments p 
       LEFT JOIN orders o ON p.order_id = o.id 
       WHERE p.user_id = ? 
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json(payments);
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create PaymentIntent for embedded checkout (Stripe Elements)
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id, payment_type } = req.body;

    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = "incomplete"', [order_id, userId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found or not in draft state' });

    const order_data = orders[0];
    let price = parseFloat(order_data.price || 0);
    const urgentFee = parseFloat(order_data.urgent_fee || 0);
    const discountAmount = parseFloat(order_data.discount_amount || 0);

    if (price === 0 && order_data.plan_id) {
      const [plans] = await db.query('SELECT price FROM plans WHERE id = ?', [order_data.plan_id]);
      if (plans.length > 0) price = parseFloat(plans[0].price);
    }

    const fullTotal = price + urgentFee - discountAmount;

    let isPartial = false;
    if (payment_type === 'partial') {
      const [orderType] = await db.query('SELECT name FROM order_types WHERE id = ?', [order_data.order_type_id]);
      const orderTypeName = orderType.length > 0 ? orderType[0].name : '';
      if (isPartialEligible(order_data, orderTypeName) && fullTotal > PARTIAL_PAYMENT_AMOUNT) {
        isPartial = true;
      }
    }

    const chargeAmount = isPartial ? PARTIAL_PAYMENT_AMOUNT : fullTotal;
    const amountCents = Math.round(chargeAmount * 100);

    if (amountCents <= 0) return res.status(400).json({ error: 'Invalid order total' });

    const [orderType] = await db.query('SELECT name FROM order_types WHERE id = ?', [order_data.order_type_id]);
    const typeName = orderType.length > 0 ? orderType[0].name : 'Tutoring service';
    const description = `${typeName} - ${order_data.course_name || 'Order'} (#${order_id})${isPartial ? ' - Partial' : ''}`;

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      description,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: userId.toString(),
        order_id: order_id.toString(),
        payment_type: isPartial ? 'partial' : 'full',
        full_total: fullTotal.toFixed(2),
        charge_amount: chargeAmount.toFixed(2)
      }
    });

    await db.query(
      'INSERT INTO payments (order_id, user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)',
      [order_id, userId, intent.id, chargeAmount, 'pending']
    );

    res.json({
      client_secret: intent.client_secret,
      amount: chargeAmount,
      full_total: fullTotal,
      is_partial: isPartial
    });
  } catch (error) {
    console.error('PaymentIntent error:', error);
    res.status(500).json({ error: 'Payment setup failed' });
  }
};

/**
 * Create PaymentIntent for remaining balance (embedded)
 */
exports.createRemainingPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id } = req.body;

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? AND payment_type = "partial" AND amount_remaining > 0',
      [order_id, userId]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'No outstanding balance' });

    const order = orders[0];
    const remaining = parseFloat(order.amount_remaining);
    const amountCents = Math.round(remaining * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      description: `Remaining Balance - Order #${order_id}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: userId.toString(),
        order_id: order_id.toString(),
        payment_type: 'remaining',
        remaining_payment: 'true',
        charge_amount: remaining.toFixed(2),
        full_total: order.total_price.toString()
      }
    });

    await db.query(
      'INSERT INTO payments (order_id, user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)',
      [order_id, userId, intent.id, remaining, 'pending']
    );

    res.json({ client_secret: intent.client_secret, amount: remaining });
  } catch (error) {
    console.error('Remaining PaymentIntent error:', error);
    res.status(500).json({ error: 'Payment setup failed' });
  }
};

/**
 * Fulfill order from a PaymentIntent (after client-side confirmation)
 * Mirrors fulfillOrder logic but takes a PaymentIntent shape
 */
exports.fulfillPaymentIntent = async (req, res) => {
  try {
    const { payment_intent_id } = req.body;
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not succeeded yet' });
    }

    // Build a session-like shape for fulfillOrder
    const sessionLike = {
      id: intent.id,
      payment_intent: intent.id,
      metadata: intent.metadata
    };

    const io = req.app.get('io');
    const orderId = await fulfillOrder(sessionLike, io);
    res.json({ success: true, order_id: orderId });
  } catch (error) {
    console.error('Fulfill PaymentIntent error:', error);
    res.status(500).json({ error: 'Fulfillment failed' });
  }
};

/**
 * User pays remaining balance on a partial-paid order (legacy hosted checkout)
 */
exports.payRemainingBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id } = req.body;

    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? AND payment_type = "partial" AND amount_remaining > 0',
      [order_id, userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'No outstanding balance for this order' });
    }

    const order = orders[0];
    const remaining = parseFloat(order.amount_remaining);
    const totalAmount = Math.round(remaining * 100);

    const [users] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
    const userEmail = users.length > 0 ? users[0].email : null;

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Remaining Balance - Order #${order_id}`,
            description: `Final payment of $${remaining.toFixed(2)}`
          },
          unit_amount: totalAmount
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: order.source_url ? `${order.source_url.replace(/\/$/, '')}/payment/success?session_id={CHECKOUT_SESSION_ID}` : `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: order.source_url ? `${order.source_url.replace(/\/$/, '')}/payment/cancel?order_id=${order_id}` : `${process.env.STRIPE_CANCEL_URL}?order_id=${order_id}`,
      metadata: {
        user_id: userId.toString(),
        order_id: order_id.toString(),
        payment_type: 'remaining',
        remaining_payment: 'true',
        charge_amount: remaining.toFixed(2),
        full_total: order.total_price.toString()
      }
    };

    if (userEmail) sessionParams.customer_email = userEmail;

    const session = await stripe.checkout.sessions.create(sessionParams);

    await db.query(
      'INSERT INTO payments (order_id, user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)',
      [order_id, userId, session.id, remaining, 'pending']
    );

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Pay remaining error:', error);
    res.status(500).json({ error: 'Payment session creation failed' });
  }
};

/**
 * Admin marks remaining balance as paid (offline payment)
 */
exports.markRemainingPaid = async (req, res) => {
  try {
    const { order_id } = req.params;
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND payment_type = "partial" AND amount_remaining > 0',
      [order_id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'No outstanding balance' });
    }
    const order = orders[0];
    const remaining = parseFloat(order.amount_remaining);

    await db.query(
      `UPDATE orders
       SET amount_paid = amount_paid + ?, amount_remaining = 0, payment_type = 'full'
       WHERE id = ?`,
      [remaining, order_id]
    );

    // Log offline payment
    await db.query(
      'INSERT INTO payments (order_id, user_id, amount, status, stripe_session_id) VALUES (?, ?, ?, ?, ?)',
      [order_id, order.user_id, remaining, 'completed', `offline-${Date.now()}`]
    );

    res.json({ message: 'Remaining balance marked as paid', amount: remaining });
  } catch (error) {
    console.error('Mark remaining paid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Verify payment session (for success page)
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { session_id } = req.query;

    const [payments] = await db.query(
      'SELECT p.*, o.id as order_id FROM payments p LEFT JOIN orders o ON p.order_id = o.id WHERE p.stripe_session_id = ?',
      [session_id]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    let payment = payments[0];
    
    // Fallback: If local testing and webhook didn't fire, check Stripe explicitly
    if (payment.status === 'pending') {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status === 'paid') {
          console.log(`[Verify] Payment verified via Stripe API. Fulfilling order locally...`);
          const newOrderId = await fulfillOrder(session);
          payment.status = 'completed';
          payment.order_id = newOrderId;
        }
      } catch (stripeErr) {
        console.error('Stripe retrieval error:', stripeErr.message);
      }
    }

    res.json(payment);
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
