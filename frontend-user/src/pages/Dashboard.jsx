import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiPlus } from 'react-icons/fi';
import { getUserOrders } from '../services/api';
import { usePageMeta } from '../hooks/usePageMeta';
import { C } from '../theme/tokens';
import {
  Card,
  SubmitAssignmentBanner,
  ActiveOrderCard,
  LoginDetailsCard,
  StudentVoiceCard,
  BlogCard,
  ServicesCard,
} from '../components/ui';

const MAX_ACTIVE_ON_DASHBOARD = 3;

export default function Dashboard() {
  usePageMeta('dashboard');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    getUserOrders()
      .then(res => setOrders(res.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const activeOrders = orders.filter(o => ['active', 'in_progress'].includes(o.status));
  const shown = activeOrders.slice(0, MAX_ACTIVE_ON_DASHBOARD);
  const overflowCount = Math.max(0, activeOrders.length - MAX_ACTIVE_ON_DASHBOARD);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <SubmitAssignmentBanner />

      <div className="v2-dash-grid" style={{ marginTop: 22 }}>
        {/* ── Left column: Active Orders ── */}
        <div>
          <div className="v2-dash-row-with-cta">
            <h2 className="v2-dash-section-title" style={{ margin: 0 }}>MY ACTIVE ORDERS</h2>
            {activeOrders.length > MAX_ACTIVE_ON_DASHBOARD && (
              <Link to="/orders" className="v2-show-all-btn">
                SHOW ALL{overflowCount > 0 ? ` (${activeOrders.length})` : ''} <FiArrowRight size={12} />
              </Link>
            )}
          </div>

          {activeOrders.length === 0 ? (
            <EmptyState
              hasAnyOrder={orders.length > 0}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shown.map(o => <ActiveOrderCard key={o.id} order={o} />)}
            </div>
          )}
        </div>

        {/* ── Right rail: Login Details + Student Voice (fills the rail) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <LoginDetailsCard orders={orders} onChanged={fetchOrders} />
          <StudentVoiceCard />
        </div>
      </div>

      {/* ── Blog (full-width banner) + Services (full-width strip) ── */}
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BlogCard />
        <ServicesCard />
      </div>
    </div>
  );
}

function EmptyState({ hasAnyOrder }) {
  return (
    <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: C.accentSoft, color: C.accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <FiPlus size={28} />
      </div>
      <h3 style={{ marginBottom: 8, color: C.textPrimary, fontSize: 16, fontWeight: 700 }}>
        {hasAnyOrder ? 'No active orders right now' : 'Your first order is one click away'}
      </h3>
      <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 18 }}>
        {hasAnyOrder
          ? 'Past orders are still available in My Orders.'
          : 'Tell us what you need help with — our tutors take it from there.'}
      </p>
      <Link to="/new-order" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: C.accent, color: '#fff', textDecoration: 'none',
        padding: '11px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
      }}>
        <FiPlus size={16} /> START A NEW ORDER
      </Link>
    </Card>
  );
}
