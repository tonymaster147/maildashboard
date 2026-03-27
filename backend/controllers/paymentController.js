const stripe = require('../config/stripe');
const db = require('../config/db');
require('dotenv').config();

/**
 * Create Stripe Checkout session
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_data } = req.body;

    // Validate plan
    const [plans] = await db.query('SELECT * FROM plans WHERE id = ?', [order_data.plan_id]);
    if (plans.length === 0) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    let price = parseFloat(plans[0].price);
    let urgentFee = parseFloat(order_data.urgent_fee || 0);
    let discountAmount = 0;

    // Apply coupon if provided
    if (order_data.coupon_code) {
      const [coupons] = await db.query(
        'SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)',
        [order_data.coupon_code]
      );
      if (coupons.length > 0) {
        discountAmount = (price * coupons[0].discount_percent) / 100;
      }
    }

    const totalAmount = Math.round((price + urgentFee - discountAmount) * 100); // Stripe uses cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${plans[0].name} Plan - ${order_data.course_name}`,
              description: `Order Type: ${order_data.order_type_name || 'Service'}`
            },
            unit_amount: totalAmount
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      metadata: {
        user_id: userId.toString(),
        order_data: JSON.stringify(order_data)
      }
    });

    // Store pending payment
    await db.query(
      'INSERT INTO payments (user_id, stripe_session_id, amount, status) VALUES (?, ?, ?, ?)',
      [userId, session.id, totalAmount / 100, 'pending']
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
const fulfillOrder = async (session) => {
  // Update payment status
  await db.query(
    'UPDATE payments SET stripe_payment_id = ?, status = "completed" WHERE stripe_session_id = ?',
    [session.payment_intent, session.id]
  );

  // Create order from metadata
  const orderData = JSON.parse(session.metadata.order_data);
  const userId = parseInt(session.metadata.user_id);

  // Get plan price
  const [plans] = await db.query('SELECT price FROM plans WHERE id = ?', [orderData.plan_id]);
  const price = parseFloat(plans[0].price);
  const urgentFee = parseFloat(orderData.urgent_fee || 0);
  let discountAmount = 0;
  let couponId = null;

  if (orderData.coupon_code) {
    const [coupons] = await db.query(
      'SELECT * FROM coupons WHERE code = ? AND is_active = 1',
      [orderData.coupon_code]
    );
    if (coupons.length > 0) {
      couponId = coupons[0].id;
      discountAmount = (price * coupons[0].discount_percent) / 100;
      await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
    }
  }

  const totalPrice = price + urgentFee - discountAmount;

  const [orderResult] = await db.query(
    `INSERT INTO orders (user_id, order_type_id, course_name, subject_id, education_level_id, plan_id, price, urgent_fee, total_price, additional_instructions, school_url, school_username, school_password, start_date, end_date, num_weeks, coupon_id, discount_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [userId, orderData.order_type_id, orderData.course_name, orderData.subject_id, orderData.education_level_id, orderData.plan_id, price, urgentFee, totalPrice, orderData.additional_instructions || null, orderData.school_url || null, orderData.school_username || null, orderData.school_password || null, orderData.start_date, orderData.end_date, orderData.num_weeks || 0, couponId, discountAmount]
  );

  // Link payment to order
  await db.query('UPDATE payments SET order_id = ? WHERE stripe_session_id = ?', [orderResult.insertId, session.id]);

  // Create notification
  await db.query(
    'INSERT INTO notifications (role, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?)',
    ['admin', 'new_order', `New paid order #${orderResult.insertId}`, orderResult.insertId, 'order']
  );

  // Handle file associations if any
  if (orderData.temp_file_ids && orderData.temp_file_ids.length > 0) {
    for (const fileId of orderData.temp_file_ids) {
      await db.query('UPDATE files SET order_id = ? WHERE id = ?', [orderResult.insertId, fileId]);
    }
  }
  
  return orderResult.insertId;
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
      await fulfillOrder(session);
    } catch (error) {
      console.error('Order creation from webhook failed:', error);
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
