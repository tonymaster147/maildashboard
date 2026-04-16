const db = require('../config/db');

/**
 * Calculate price based on order_type + education_level + quantity
 * POST /api/orders/calculate-price
 */
exports.calculatePrice = async (req, res) => {
  try {
    const { order_type_id, education_level_id, quantity, num_weeks, num_pages, is_urgent, coupon_code, plan_tier } = req.body;

    if (!order_type_id) {
      return res.status(400).json({ error: 'order_type_id is required' });
    }

    // Support both old single-quantity API and new separate weeks/pages API
    const weeks = num_weeks || quantity || 0;
    const pages = num_pages || quantity || 0;

    // Find matching pricing rule (specific level first, then NULL level fallback)
    // Match range_type against the appropriate quantity
    const selectedTier = plan_tier || 'essential';

    const [rules] = await db.query(
      `SELECT pr.*, ot.name as order_type_name
       FROM pricing_rules pr
       JOIN order_types ot ON pr.order_type_id = ot.id
       WHERE pr.order_type_id = ?
         AND (pr.education_level_id = ? OR pr.education_level_id IS NULL)
         AND pr.plan_tier = ?
         AND pr.is_active = 1
         AND ot.name != '_urgent_surcharge'
         AND (
           pr.range_type = 'flat'
           OR (pr.range_type = 'weeks' AND pr.from_range <= ? AND pr.to_range >= ?)
           OR (pr.range_type = 'pages' AND pr.from_range <= ? AND pr.to_range >= ?)
         )
       ORDER BY pr.education_level_id IS NULL ASC
       LIMIT 1`,
      [order_type_id, education_level_id || null, selectedTier, weeks, weeks, pages, pages]
    );

    if (rules.length === 0) {
      return res.status(400).json({ error: 'No pricing available for this combination' });
    }

    const rule = rules[0];
    let unitPrice = parseFloat(rule.price);

    // For flat-priced types (Quiz, Exam, Test, Discussion), multiply by quantity
    let flatQuantity = 1;
    if (rule.range_type === 'flat') {
      const qty = parseInt(num_pages) || parseInt(quantity) || 1;
      flatQuantity = Math.max(qty, 1);
    }
    let basePrice = unitPrice * flatQuantity;

    // Urgent fee lookup
    let urgentFee = 0;
    if (is_urgent) {
      const [urgentRules] = await db.query(
        `SELECT pr.price FROM pricing_rules pr
         JOIN order_types ot ON pr.order_type_id = ot.id
         WHERE ot.name = '_urgent_surcharge' AND pr.is_active = 1
         LIMIT 1`
      );
      urgentFee = urgentRules.length > 0 ? parseFloat(urgentRules[0].price) : 75;
    }

    // Coupon validation
    let discountAmount = 0;
    let discountPercent = 0;
    if (coupon_code) {
      const [coupons] = await db.query(
        `SELECT * FROM coupons WHERE code = ? AND is_active = 1
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
        [coupon_code]
      );
      if (coupons.length > 0) {
        discountPercent = parseFloat(coupons[0].discount_percent);
        discountAmount = (basePrice * discountPercent) / 100;
      }
    }

    const totalPrice = basePrice + urgentFee - discountAmount;

    res.json({
      base_price: parseFloat(basePrice.toFixed(2)),
      unit_price: unitPrice,
      flat_quantity: flatQuantity,
      urgent_fee: urgentFee,
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      discount_percent: discountPercent,
      total_price: parseFloat(totalPrice.toFixed(2)),
      pricing_rule_id: rule.id,
      range_type: rule.range_type,
      plan_tier: rule.plan_tier
    });
  } catch (error) {
    console.error('Calculate price error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all pricing rules (admin)
 */
exports.getPricingRules = async (req, res) => {
  try {
    const [rules] = await db.query(
      `SELECT pr.*, ot.name as order_type_name, el.name as education_level_name
       FROM pricing_rules pr
       JOIN order_types ot ON pr.order_type_id = ot.id
       LEFT JOIN education_levels el ON pr.education_level_id = el.id
       WHERE ot.name != '_urgent_surcharge'
       ORDER BY ot.name, el.name, pr.from_range`
    );

    // Also return the urgent fee
    const [urgentRows] = await db.query(
      `SELECT pr.price FROM pricing_rules pr
       JOIN order_types ot ON pr.order_type_id = ot.id
       WHERE ot.name = '_urgent_surcharge' AND pr.is_active = 1
       LIMIT 1`
    );
    const urgentFee = urgentRows.length > 0 ? parseFloat(urgentRows[0].price) : 75;

    res.json({ rules, urgentFee });
  } catch (error) {
    console.error('Get pricing rules error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create a pricing rule (admin)
 */
exports.createPricingRule = async (req, res) => {
  try {
    const { order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier } = req.body;

    if (!order_type_id || !range_type || price === undefined) {
      return res.status(400).json({ error: 'order_type_id, range_type, and price are required' });
    }

    const tier = plan_tier || 'essential';

    // Check for overlapping ranges
    if (range_type !== 'flat' && from_range != null && to_range != null) {
      const [overlaps] = await db.query(
        `SELECT id FROM pricing_rules
         WHERE order_type_id = ? AND is_active = 1
           AND (education_level_id <=> ?)
           AND plan_tier = ?
           AND from_range <= ? AND to_range >= ?`,
        [order_type_id, education_level_id || null, tier, to_range, from_range]
      );
      if (overlaps.length > 0) {
        return res.status(400).json({ error: 'Overlapping range exists for this combination' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO pricing_rules (order_type_id, education_level_id, range_type, from_range, to_range, price, plan_tier)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [order_type_id, education_level_id || null, range_type,
       range_type === 'flat' ? null : from_range,
       range_type === 'flat' ? null : to_range,
       price, tier]
    );

    res.status(201).json({ id: result.insertId, message: 'Pricing rule created' });
  } catch (error) {
    console.error('Create pricing rule error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update a pricing rule (admin)
 */
exports.updatePricingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, from_range, to_range, is_active } = req.body;

    const updates = [];
    const params = [];

    if (price !== undefined) { updates.push('price = ?'); params.push(price); }
    if (from_range !== undefined) { updates.push('from_range = ?'); params.push(from_range); }
    if (to_range !== undefined) { updates.push('to_range = ?'); params.push(to_range); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.query(`UPDATE pricing_rules SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Pricing rule updated' });
  } catch (error) {
    console.error('Update pricing rule error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete a pricing rule (admin)
 */
exports.deletePricingRule = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any orders reference this rule
    const [orders] = await db.query('SELECT id FROM orders WHERE pricing_rule_id = ? LIMIT 1', [id]);
    if (orders.length > 0) {
      // Soft delete — orders reference it
      await db.query('UPDATE pricing_rules SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Pricing rule deactivated (referenced by existing orders)' });
    }

    await db.query('DELETE FROM pricing_rules WHERE id = ?', [id]);
    res.json({ message: 'Pricing rule deleted' });
  } catch (error) {
    console.error('Delete pricing rule error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update the urgent fee (admin)
 */
exports.updateUrgentFee = async (req, res) => {
  try {
    const { price } = req.body;
    if (price === undefined) return res.status(400).json({ error: 'price is required' });

    await db.query(
      `UPDATE pricing_rules pr
       JOIN order_types ot ON pr.order_type_id = ot.id
       SET pr.price = ?
       WHERE ot.name = '_urgent_surcharge'`,
      [price]
    );

    res.json({ message: 'Urgent fee updated' });
  } catch (error) {
    console.error('Update urgent fee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
