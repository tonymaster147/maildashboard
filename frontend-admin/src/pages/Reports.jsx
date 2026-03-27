import { useState, useEffect } from 'react';
import { FiDownload, FiFilter, FiRefreshCw } from 'react-icons/fi';
import api from '../services/api';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [tutors, setTutors] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '', // Payment Status
    order_status: '', // Project Status
    user_id: '',
    tutor_id: '',
    start_date: '',
    end_date: ''
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await api.get(`/admin/reports?${queryParams.toString()}`);
      setReports(response.data.data);
      if (response.data.meta) {
        setUsers(response.data.meta.users);
        setTutors(response.data.meta.tutors);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []); // Initial load

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = (e) => {
    e.preventDefault();
    fetchReports();
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      order_status: '',
      user_id: '',
      tutor_id: '',
      start_date: '',
      end_date: ''
    });
    // Will fetch inside useEffect if we wanted, but let's just force fetch
    setTimeout(() => {
      fetchReports();
    }, 100);
  };

  const exportToCSV = () => {
    if (reports.length === 0) {
      alert("No data to export");
      return;
    }

    // Define CSV headers mapping to the object keys
    const headers = [
      { label: 'Order ID', key: 'order_id' },
      { label: 'Project Name', key: 'project_name' },
      { label: 'Order Status', key: 'order_status' },
      { label: 'Payment Status', key: 'payment_status' },
      { label: 'Amount ($)', key: 'amount' },
      { label: 'Date', key: 'order_created_date' },
      { label: 'User', key: 'user_name' },
      { label: 'User Email', key: 'user_email' },
      { label: 'Assigned Tutors', key: 'assigned_tutors' },
      { label: 'Order Type', key: 'order_type' },
      { label: 'Subject', key: 'subject' },
      { label: 'Plan', key: 'plan' },
    ];

    // Build CSV string
    const csvRows = [];
    
    // Header row
    csvRows.push(headers.map(h => `"${h.label}"`).join(','));

    // Data rows
    reports.forEach(row => {
      const values = headers.map(header => {
        let val = row[header.key];
        
        // Format dates
        if (header.key === 'order_created_date' && val) {
          val = new Date(val).toLocaleDateString();
        }
        
        // Format nulls or undefined
        if (val === null || val === undefined) {
          val = '';
        }
        
        // Escape quotes
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admin_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Platform Reports</h2>
          <p className="text-secondary">Generate and export detailed data reports.</p>
        </div>
        <button className="btn btn-primary" onClick={exportToCSV} disabled={reports.length === 0 || loading}>
          <FiDownload /> Export CSV
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={applyFilters} style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '1.5rem', 
          alignItems: 'end' 
        }}>
          
          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Search Project / ID</label>
            <input 
              type="text" 
              className="form-input" 
              name="search" 
              placeholder="Search..." 
              value={filters.search} 
              onChange={handleFilterChange} 
            />
          </div>

          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Project Status</label>
            <select className="form-select" name="order_status" value={filters.order_status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Payment Status</label>
            <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="unpaid">Unpaid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>User</label>
            <select className="form-select" name="user_id" value={filters.user_id} onChange={handleFilterChange}>
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>

          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Assigned Tutor</label>
            <select className="form-select" name="tutor_id" value={filters.tutor_id} onChange={handleFilterChange}>
              <option value="">All Tutors</option>
              {tutors.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Start Date</label>
            <input 
              type="date" 
              className="form-input" 
              name="start_date" 
              value={filters.start_date} 
              onChange={handleFilterChange} 
            />
          </div>

          <div className="form-group mb-0">
            <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>End Date</label>
            <input 
              type="date" 
              className="form-input" 
              name="end_date" 
              value={filters.end_date} 
              onChange={handleFilterChange} 
            />
          </div>

          <div className="form-group mb-0" style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-secondary" style={{ flex: 1 }}>
              <FiFilter /> Filter
            </button>
            <button type="button" className="btn" onClick={resetFilters} title="Reset Filters" style={{ background: '#f1f5f9', color: '#64748b' }}>
              <FiRefreshCw />
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>No records found matching the criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project Name</th>
                  <th>Date</th>
                  <th>User</th>
                  <th>Payment</th>
                  <th>Tutor(s)</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => (
                  <tr key={row.order_id}>
                    <td>#{row.order_id}</td>
                    <td>{row.project_name}</td>
                    <td>{new Date(row.order_created_date).toLocaleDateString()}</td>
                    <td>
                      <div>{row.user_name}</div>
                      <div className="text-secondary" style={{ fontSize: '0.8rem' }}>{row.user_email}</div>
                    </td>
                    <td>
                      <span className={`badge ${row.payment_status === 'completed' ? 'success' : 'warning'}`}>
                        {row.payment_status}
                      </span>
                    </td>
                    <td>{row.assigned_tutors || <span className="text-secondary">Unassigned</span>}</td>
                    <td>${Number(row.amount).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        row.order_status === 'completed' ? 'success' : 
                        row.order_status === 'active' ? 'primary' : 'warning'
                      }`}>
                        {row.order_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
