import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTaskDetail, completeTask, uploadWorkFiles } from '../services/api';
import { FiArrowLeft, FiCheckCircle, FiUpload, FiMessageSquare, FiDownload } from 'react-icons/fi';

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchTask = () => { getTaskDetail(id).then(res => { setTask(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchTask(); }, [id]);

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

  const handleComplete = async () => {
    if (!confirm('Mark this task as completed? Chat will be disabled.')) return;
    setCompleting(true);
    try {
      await completeTask(id);
      fetchTask();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
    setCompleting(false);
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="loading-spinner"></div></div>;
  if (!task) return <div className="card text-center"><h3>Task not found</h3></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/" className="btn btn-sm btn-secondary"><FiArrowLeft size={14} /></Link>
        <div><h2>Task #{task.id}</h2><p style={{ color: 'var(--text-secondary)' }}>{task.course_name}</p></div>
        <span className={`badge-status badge-${task.status}`} style={{ marginLeft: 'auto', fontSize: 14, padding: '6px 16px' }}>{task.status}</span>
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Task Details</h4>
          {[['Type', task.order_type_name], ['Subject', task.subject_name], ['Level', task.education_level_name], ['Plan', task.plan_name], ['User', task.username], ['Start', new Date(task.start_date).toLocaleDateString()], ['End', new Date(task.end_date).toLocaleDateString()], ['Weeks', task.num_weeks]].map(([l, v]) => (
            <div key={l} className="summary-row"><span className="label">{l}</span><span>{v}</span></div>
          ))}
        </div>
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Actions</h4>
          {task.status !== 'completed' && (
            <>
              <div className="form-group">
                <label className="form-label">Upload Work Files</label>
                <div className="file-upload-zone" onClick={() => document.getElementById('work-files').click()}>
                  {uploading ? <div className="loading-spinner"></div> : <><FiUpload size={24} style={{ marginBottom: 8 }} /><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Click to upload files</p></>}
                </div>
                <input id="work-files" type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleComplete} disabled={completing}>
                {completing ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> : <><FiCheckCircle size={16} /> Mark as Completed</>}
              </button>
            </>
          )}
          {task.chat_enabled && (
            <Link to={`/chat/${task.id}`} className="btn btn-secondary mt-2" style={{ width: '100%' }}>
              <FiMessageSquare size={16} /> Open Chat
            </Link>
          )}
          {task.status === 'completed' && (
            <div className="text-center" style={{ padding: 24, color: 'var(--success)' }}>
              <FiCheckCircle size={48} /><h3 style={{ marginTop: 12 }}>Task Completed</h3>
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
