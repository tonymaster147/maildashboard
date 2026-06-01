import { useRef, useState } from 'react';
import { FiPaperclip, FiX, FiFile, FiImage, FiDownload } from 'react-icons/fi';

export const CHAT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.md,' +
  '.png,.jpg,.jpeg,.gif,.webp';

export const CHAT_MAX_BYTES = 10 * 1024 * 1024;

export function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Paperclip button + hidden file input. Calls onPick(file) when a valid file is chosen. */
export function AttachButton({ onPick, disabled }) {
  const ref = useRef(null);
  const open = () => !disabled && ref.current?.click();
  const handle = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > CHAT_MAX_BYTES) {
      alert('File too large — 10 MB maximum.');
      return;
    }
    onPick(f);
  };
  return (
    <>
      <input ref={ref} type="file" accept={CHAT_ACCEPT} onChange={handle} style={{ display: 'none' }} />
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        title="Attach a file (max 10 MB)"
        style={{
          background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--text-muted)', padding: '0 10px', display: 'flex', alignItems: 'center'
        }}
      >
        <FiPaperclip size={20} />
      </button>
    </>
  );
}

/** Pending-file preview chip shown above the input before send. */
export function AttachPreview({ file, onRemove }) {
  if (!file) return null;
  const isImage = file.type.startsWith('image/');
  const url = isImage ? URL.createObjectURL(file) : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', background: 'var(--bg-input)',
      border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8
    }}>
      {isImage
        ? <img src={url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
        : <FiFile size={22} style={{ color: 'var(--accent)' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatBytes(file.size)}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        <FiX size={16} />
      </button>
    </div>
  );
}

/** Attachment bubble inside a chat message (image inline OR file pill). */
export function AttachmentBubble({ msg, isOwn }) {
  if (!msg.attachment_url) return null;
  const isImage = (msg.attachment_mime || '').startsWith('image/');
  if (isImage) {
    // Google Drive thumbnail endpoint is the only public URL that returns raw
    // image bytes for an <img> tag; /view and /preview return HTML viewer pages.
    const thumb = msg.attachment_drive_id
      ? `https://drive.google.com/thumbnail?id=${msg.attachment_drive_id}&sz=w600`
      : msg.attachment_url;
    return (
      <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'block', maxWidth: 260 }}>
        <img
          src={thumb}
          alt={msg.attachment_name}
          loading="lazy"
          style={{ maxWidth: 260, maxHeight: 200, borderRadius: 6, display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>{msg.attachment_name} · {formatBytes(msg.attachment_size)}</div>
      </a>
    );
  }
  // Direct-download link works for any file ≤25 MB on Drive and never relies on
  // Drive's preview pipeline, which is famously flaky with .docx / .pptx.
  const downloadUrl = msg.attachment_drive_id
    ? `https://drive.google.com/uc?export=download&id=${msg.attachment_drive_id}`
    : msg.attachment_url;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: isOwn ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)',
        borderRadius: 8, color: 'inherit',
        maxWidth: 280
      }}
    >
      <FiFile size={22} style={{ flexShrink: 0 }} />
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noreferrer"
        title="Open in Drive viewer"
        style={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.attachment_name}</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>{formatBytes(msg.attachment_size)}</div>
      </a>
      <a
        href={downloadUrl}
        download={msg.attachment_name}
        title="Download file"
        style={{ color: 'inherit', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4 }}
      >
        <FiDownload size={16} style={{ opacity: 0.85 }} />
      </a>
    </div>
  );
}
