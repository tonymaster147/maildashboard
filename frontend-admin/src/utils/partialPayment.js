// Mirrors backend paymentController.isPartialEligible so the panel can gate the
// "Paid - Partial" option before calling the API. Partial is only allowed for
// Online Class orders with total >= $455 (or a 45+ day span).
export const PARTIAL_PAYMENT_AMOUNT = 150;
export const PARTIAL_PRICE_THRESHOLD = 455;

export function isPartialEligible(order) {
  const typeName = (order?.order_type_name || '').toLowerCase();
  if (!typeName.includes('online class')) return false;
  const total = parseFloat(order?.total_price || 0);
  if (total <= PARTIAL_PAYMENT_AMOUNT) return false; // total must exceed the upfront
  if (total >= PARTIAL_PRICE_THRESHOLD) return true;
  if (!order?.start_date || !order?.end_date) return false;
  const days = (new Date(order.end_date) - new Date(order.start_date)) / (1000 * 60 * 60 * 24);
  return days >= 45;
}
