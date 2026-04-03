import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';

export default function NewConvModal({ onClose, onCreate }) {
  const { token } = useAuth();
  const { apiFetch } = useApi();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    apiFetch('/users').then(setUsers).catch(() => {});
  }, []);

  function toggleUser(userId) {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreate() {
    if (selected.length === 0) return;
    const conv = await apiFetch('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantIds: selected, name }),
    });
    onCreate(conv);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">New Conversation</div>

        <div className="modal-content">
          <div className="form-group">
            <label className="label">Group Name (optional)</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Team"
            />
          </div>

          <div className="label" style={{ marginTop: 16 }}>Select Participants</div>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
            {users.map((u) => (
              <div
                key={u._id}
                className={`user-select-item ${selected.includes(u._id) ? 'selected' : ''}`}
                onClick={() => toggleUser(u._id)}
              >
                <div className="user-select-checkbox">
                  {selected.includes(u._id) && '✓'}
                </div>
                <div className="user-select-avatar">
                  {u.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{u.email}</div>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div style={{ color: 'var(--color-muted)', fontSize: 13, padding: 12, textAlign: 'center' }}>
                No other users found. Invite someone!
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={selected.length === 0}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
