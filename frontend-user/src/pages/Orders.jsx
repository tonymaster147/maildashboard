import { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiList } from 'react-icons/fi';
import { getUserOrders, getPublicStatuses } from '../services/api';
import { C } from '../theme/tokens';
import { Card, ActiveOrderCard } from '../components/ui';

const PER_PAGE = 100;

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');           // admin_status_code
  const [adminStatuses, setAdminStatuses] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: PER_PAGE };
    if (filter) params.admin_status_code = filter;
    getUserOrders(params)
      .then(res => { setOrders(res.data.orders || []); setTotal(res.data.total || 0); })
      .catch(() => { setOrders([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => {
    getPublicStatuses('admin')
      .then(res => setAdminStatuses((res.data.statuses || []).filter(s => s.is_active)))
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const paged = orders;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: 0.3 }}>
          My Orders
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, margin: '4px 0 0' }}>
          Every order you've placed — newest first.
        </p>
      </div>

      {/* Filter pill row */}
      <div className="v2-filter-pills" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <FilterPill active={filter === ''} onClick={() => { setFilter(''); setPage(1); }}>
          All
        </FilterPill>
        {adminStatuses.map(s => (
          <FilterPill
            key={s.code}
            active={filter === s.code}
            onClick={() => { setFilter(s.code); setPage(1); }}
          >
            {s.name}
          </FilterPill>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          <div className="loading-spinner" />
        </div>
      ) : orders.length === 0 ? (
        <Card style={{ padding: '50px 30px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: C.accentSoft, color: C.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <FiList size={24} />
          </div>
          <h3 style={{ marginBottom: 6, color: C.textPrimary, fontSize: 16, fontWeight: 700 }}>
            No orders found
          </h3>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
            {filter ? 'No orders with this status.' : 'You haven\'t placed any orders yet.'}
          </p>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paged.map(o => (
              <ActiveOrderCard key={o.id} order={o} detailHref={`/orders/${o.id}`} />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 14, marginTop: 24,
            }}>
              <PagerBtn disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={FiChevronLeft}>
                Prev
              </PagerBtn>
              <span style={{ fontSize: 13, color: C.textSecondary, fontWeight: 600 }}>
                Page {page} of {totalPages}
                <span style={{ color: C.textMuted, fontWeight: 500 }}> ({total} orders)</span>
              </span>
              <PagerBtn disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} iconRight={FiChevronRight}>
                Next
              </PagerBtn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        padding: '7px 14px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        cursor: 'pointer',
        textTransform: 'uppercase',
        background: active ? C.accent : '#eef2f7',
        color: active ? '#fff' : C.textSecondary,
        transition: C.transitionFast,
      }}
    >
      {children}
    </button>
  );
}

function PagerBtn({ onClick, disabled, icon: Icon, iconRight: IconRight, children }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 8,
        background: disabled ? '#eef2f7' : C.surface,
        border: `1px solid ${C.border}`,
        color: disabled ? C.textMuted : C.textPrimary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
      {IconRight && <IconRight size={14} />}
    </button>
  );
}
