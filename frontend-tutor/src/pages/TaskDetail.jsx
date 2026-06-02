import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTaskDetail, updateTutorTaskStatus, uploadWorkFiles, getPublicStatuses } from '../services/api';
import { FiArrowLeft, FiCheckCircle, FiUpload, FiMessageSquare, FiDownload } from 'react-icons/fi';

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tutorStatuses, setTutorStatuses] = useState([]);

  const fetchTask = () => { getTaskDetail(id).then(res => { setTask(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchTask(); }, [id]);
  useEffect(() => { getPublicStatuses('tutor').then(res => setTutorStatuses((res.data.statuses || []).filter(s => s.is_active))).catch(() => {}); }, []);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      await uploadWorkFiles(id, formData);
      fetchTask();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleStatusChange = async (newCode) => {
    if (!newCode || newCode === task.tutor_status_code) return;
    if (newCode === 'completed' && !confirm('Mark this task as completed? Chat will be disabled.')) return;
    setSaving(true);
    try {
      await updateTutorTaskStatus(id, newCode);
      fetchTask();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
    setSaving(false);
  };

  const isCompleted = task?.tutor_status_code === 'completed';

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;
  if (!task) return <div className="card text-center"><h3>Task not found</h3></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link to="/" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div><h2>Task {task.order_code || `#${task.id}`}</h2><p style={{ color: 'var(--text-secondary)' }}>{task.course_name}</p></div>
        {task.tutor_status_code && (
          <span
            style={{
              marginLeft: 'auto', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 999,
              background: task.tutor_status_code === 'completed' ? 'rgba(34,197,94,0.12)' : task.tutor_status_code === 'work_stopped' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
              color:      task.tutor_status_code === 'completed' ? '#16a34a'             : task.tutor_status_code === 'work_stopped' ? '#d97706'             : '#2563eb',
              border: '1px solid currentColor'
            }}
          >
            {task.tutor_status_name}
          </span>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Task Details</h4>
          {[['Type', task.order_type_name], ['Course', task.course_name || '—'], ['Subject', task.subject_name], ['Level', task.education_level_name], ['Plan', task.plan_name || '—'], ['User', task.username], ['Start', new Date(task.start_date).toLocaleDateString()], ['End', new Date(task.end_date).toLocaleDateString()], ['Weeks', task.num_weeks]].map(([l, v]) => (
            <div key={l} className="summary-row"><span className="label">{l}</span><span>{v}</span></div>
          ))}
        </div>
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Actions</h4>
          {!isCompleted && (
            <div className="form-group">
              <label className="form-label">Upload Work Files</label>
              <div className="file-upload-zone" onClick={() => document.getElementById('work-files').click()}>
                {uploading ? <div className="loading-spinner"></div> : <><FiUpload size={24} style={{ marginBottom: 8 }} /><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Click to upload files</p></>}
              </div>
              <input id="work-files" type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Work Status</label>
            <select
              className="form-input"
              value={task.tutor_status_code || ''}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={saving || isCompleted}
              style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600 }}
            >
              {!task.tutor_status_code && <option value="" disabled>Select status…</option>}
              {tutorStatuses.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            {saving && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Saving…</p>}
            {isCompleted && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>This task is completed and locked.</p>}
          </div>

          {task.chat_enabled && (
            <Link to={`/chat/${task.id}`} className="btn btn-secondary" style={{ width: '100%' }}>
              <FiMessageSquare size={16} /> Open Chat
            </Link>
          )}
          {isCompleted && (
            <div className="text-center" style={{ padding: 16, color: 'var(--success)' }}>
              <FiCheckCircle size={36} />
              <div style={{ marginTop: 6, fontWeight: 600 }}>Task Completed</div>
            </div>
          )}
        </div>
      </div>

      {task.additional_instructions && (
        <div className="card mt-2"><h4 style={{ marginBottom: 8 }}>Instructions</h4><p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{task.additional_instructions}</p></div>
      )}

      {task.files?.length > 0 && (
        <div className="card mt-2">
          <h4 style={{ marginBottom: 12 }}>Files ({task.files.length})</h4>
          <div className="file-list">
            {task.files.map(f => (
              <div key={f.id} className="file-item">
                <div><div className="file-name">{f.file_name}</div><div className="file-size">By {f.uploaded_by_role} • {new Date(f.created_at).toLocaleDateString()}</div></div>
                <a href={f.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary"><FiDownload size={14} /></a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
