const stripe = require('../config/stripe');
const db = require('../config/db');
const { sendNewOrderAdmin, sendOrderConfirmationUser } = require('../services/emailService');
require('dotenv').config();

/**
 * Create Stripe Checkout session
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id } = req.body;

    // Fetch the draft order
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = "incomplete"', [order_id, userId]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not in draft state' });
    }

    const order_data = orders[0];

    // Validate plan
    const [plans] = await db.query('SELECT * FROM plans WHERE id = ?', [order_data.plan_id]);
    if (plans.length === 0) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    let price = parseFloat(plans[0].price);
    let urgentFee = parseFloat(order_data.urgent_fee || 0);
    let discountAmount = parseFloat(order_data.discount_amount || 0);

    const totalAmount = Math.round((price + urgentFee - discountAmount) * 100); // Stripe uses cents

    const [users] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
    const userEmail = users.length > 0 ? users[0].email : null;

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${plans[0].name} Plan - ${order_data.course_name}`,
              description: `Draft Order #${order_id}`
            },
            unit_amount: totalAmount
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.STRIPE_CANCEL_URL}?order_id=${order_id}`,
      metadata: {
        user_id: userId.toString(),
        order_id: order_id.toString()
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

  // Mark order as active
  await db.query(
    'UPDATE orders SET status = "active" WHERE id = ?',
    [orderId]
  );

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
        paymentStatus: 'completed'
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
