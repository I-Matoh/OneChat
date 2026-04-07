import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import PageBlockEditor from '../components/PageBlockEditor';

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];
const MEMBER_ROLES = ['viewer', 'commenter', 'editor', 'admin', 'owner'];

export default function Workspace() {
  const { apiFetch } = useApi();

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [saveState, setSaveState] = useState('Saved');
  const [error, setError] = useState('');

  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractInfo, setExtractInfo] = useState('');

  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');

  const activePage = useMemo(
    () => pages.find((item) => item._id === activePageId) || null,
    [pages, activePageId]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaces() {
      try {
        const list = await apiFetch('/workspaces');
        if (cancelled) return;
        setWorkspaces(list || []);
        if (list?.length) setActiveWorkspaceId(list[0]._id);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load workspaces');
      }
    }
    loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const [list, docs] = await Promise.all([
          apiFetch('/users'),
          apiFetch('/docs').catch(() => []),
        ]);
        if (cancelled) return;
        setUsers(list || []);
        setDocuments(docs || []);
      } catch {
        // optional UI
      }
    }
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setPages([]);
      setTasks([]);
      setMembers([]);
      setActivePageId(null);
      return;
    }

    let cancelled = false;
    async function loadWorkspaceData() {
      try {
        const [pagesList, tasksList, membersList] = await Promise.all([
          apiFetch(`/workspaces/${activeWorkspaceId}/pages`),
          apiFetch(`/tasks?workspaceId=${activeWorkspaceId}`),
          apiFetch(`/workspaces/${activeWorkspaceId}/members`),
        ]);
        if (cancelled) return;
        setPages(pagesList || []);
        setTasks(tasksList || []);
        setMembers(membersList || []);
        if (pagesList?.length) {
          setActivePageId((prev) => prev || pagesList[0]._id);
        } else {
          setActivePageId(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load workspace data');
      }
    }
    loadWorkspaceData();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, apiFetch]);

  async function createWorkspace() {
    if (!workspaceName.trim()) return;
    try {
      const created = await apiFetch('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      setWorkspaces((prev) => [created, ...prev]);
      setActiveWorkspaceId(created._id);
      setWorkspaceName('');
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to create workspace');
    }
  }

  async function createPage() {
    if (!activeWorkspaceId) return;
    try {
      const created = await apiFetch(`/workspaces/${activeWorkspaceId}/pages`, {
        method: 'POST',
        body: JSON.stringify({ title: pageTitle.trim() || 'Untitled Page' }),
      });
      setPages((prev) => [created, ...prev]);
      setActivePageId(created._id);
      setPageTitle('');
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to create page');
    }
  }

  async function savePage(nextPage = activePage) {
    if (!activePageId || !nextPage) return null;
    setSaveState('Saving...');
    try {
      const updated = await apiFetch(`/workspaces/pages/${activePageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: nextPage.title || 'Untitled Page',
          content: nextPage.content || '',
          blocks: nextPage.blocks || [],
        }),
      });
      setPages((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setSaveState('Saved');
      setError('');
      return updated;
    } catch (err) {
      setSaveState('Save failed');
      setError(err.message || 'Unable to save page');
      return null;
    }
  }

  async function createTask() {
    if (!activeWorkspaceId || !taskTitle.trim()) return;
    try {
      const created = await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          title: taskTitle.trim(),
          status: 'todo',
          sourceType: 'manual',
          sourceId: activePageId || '',
        }),
      });
      setTasks((prev) => [created, ...prev]);
      setTaskTitle('');
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to create task');
    }
  }

  async function updateTaskStatus(taskId, status) {
    try {
      const updated = await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
    } catch (err) {
      setError(err.message || 'Unable to update task');
    }
  }

  async function extractTasksFromPage() {
    if (!activeWorkspaceId || !activePage?.content?.trim()) return;
    setExtracting(true);
    setExtractInfo('');
    try {
      const result = await apiFetch('/ai/extract-actions', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          text: activePage.content,
          createTasks: true,
          sourceType: 'page',
          sourceId: activePage._id,
        }),
      });
      if (result.createdTasks?.length) {
        setTasks((prev) => [...result.createdTasks, ...prev]);
      }
      setExtractInfo(`Extracted ${result.actions?.length || 0} actions via ${result.provider}`);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to extract tasks');
    } finally {
      setExtracting(false);
    }
  }

  async function addMember() {
    if (!activeWorkspaceId || !memberUserId) return;
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: memberUserId, role: memberRole }),
      });
      const next = await apiFetch(`/workspaces/${activeWorkspaceId}/members`);
      setMembers(next || []);
      setMemberUserId('');
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to add member');
    }
  }

  async function changeMemberRole(userId, role) {
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      const next = await apiFetch(`/workspaces/${activeWorkspaceId}/members`);
      setMembers(next || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to update member role');
    }
  }

  async function removeMember(userId) {
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}/members/${userId}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((item) => item.userId !== userId));
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to remove member');
    }
  }

  async function createCommentThread(payload) {
    if (!activePageId) return null;
    try {
      const updated = await apiFetch(`/workspaces/pages/${activePageId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPages((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setError('');
      return updated;
    } catch (err) {
      setError(err.message || 'Unable to create comment thread');
      return null;
    }
  }

  async function replyToCommentThread({ threadId, message }) {
    if (!activePageId) return null;
    try {
      const updated = await apiFetch(`/workspaces/pages/${activePageId}/comments/${threadId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setPages((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setError('');
      return updated;
    } catch (err) {
      setError(err.message || 'Unable to reply to thread');
      return null;
    }
  }

  async function toggleCommentThread({ threadId, resolved }) {
    if (!activePageId) return null;
    try {
      const updated = await apiFetch(`/workspaces/pages/${activePageId}/comments/${threadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved }),
      });
      setPages((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setError('');
      return updated;
    } catch (err) {
      setError(err.message || 'Unable to update thread');
      return null;
    }
  }

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-header">
          <div className="workspace-logo">
            <span className="workspace-logo-icon">O</span>
            <span className="workspace-logo-text">Workspaces</span>
          </div>
        </div>

        <div className="workspace-input-section">
          <div className="workspace-input-wrapper">
            <input
              type="text"
              className="workspace-input"
              placeholder="New workspace name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
            <button className="workspace-input-btn" onClick={createWorkspace}>
              Create
            </button>
          </div>
        </div>

        <div className="workspace-section">
          <div className="workspace-section-header">
            <span>Your Workspaces</span>
          </div>
          <div className="workspace-section-items">
            {workspaces.map((workspace) => (
              <button
                key={workspace._id}
                className={`workspace-section-item ${activeWorkspaceId === workspace._id ? 'active' : ''}`}
                onClick={() => setActiveWorkspaceId(workspace._id)}
              >
                <FolderIcon />
                <span>{workspace.name}</span>
              </button>
            ))}
            {workspaces.length === 0 && (
              <div className="workspace-section-item">Create your first workspace</div>
            )}
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <h1 className="workspace-title">
              {workspaces.find((item) => item._id === activeWorkspaceId)?.name || 'Workspace'}
            </h1>
            <p className="workspace-subtitle">{saveState}</p>
          </div>
        </header>

        {error && (
          <div style={{ color: 'var(--color-error)', marginBottom: 12 }}>{error}</div>
        )}

        <div className="workspace-input-section">
          <div className="workspace-input-wrapper">
            <input
              type="text"
              className="workspace-input"
              placeholder="New page title"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
            />
            <button className="workspace-input-btn" onClick={createPage} disabled={!activeWorkspaceId}>
              Add Page
            </button>
          </div>
        </div>

        <div className="workspace-table-container" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: 12 }}>
          <div className="workspace-section-items">
            {pages.map((item) => (
              <button
                key={item._id}
                className={`workspace-section-item ${activePageId === item._id ? 'active' : ''}`}
                onClick={() => setActivePageId(item._id)}
              >
                <FolderIcon />
                <span>{item.title || 'Untitled Page'}</span>
              </button>
            ))}
            {pages.length === 0 && (
              <div className="workspace-section-item">No pages in this workspace yet</div>
            )}
          </div>

          <div className="workspace-table" style={{ display: 'block', padding: 12 }}>
            <PageBlockEditor
              page={activePage}
              pages={pages}
              documents={documents}
              members={members}
              saveState={saveState}
              extracting={extracting}
              extractInfo={extractInfo}
              onPageChange={(nextPage) => {
                setSaveState('Editing...');
                setPages((prev) => prev.map((item) => (
                  item._id === nextPage._id ? { ...item, ...nextPage } : item
                )));
              }}
              onSave={savePage}
              onExtractTasks={extractTasksFromPage}
              onCreateThread={createCommentThread}
              onReplyThread={replyToCommentThread}
              onResolveThread={toggleCommentThread}
            />
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div className="workspace-table" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Tasks</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="New task"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
                <button className="btn btn-primary" onClick={createTask}>Add</button>
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 220, overflowY: 'auto' }}>
                {tasks.map((task) => (
                  <div key={task._id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{task.title}</div>
                    <div style={{ marginTop: 6 }}>
                      <select
                        className="input"
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task._id, e.target.value)}
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>No tasks yet</div>
                )}
              </div>
            </div>

            <div className="workspace-table" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Members</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <select
                  className="input"
                  value={memberUserId}
                  onChange={(e) => setMemberUserId(e.target.value)}
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>{user.name} ({user.email})</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                >
                  {MEMBER_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={addMember} disabled={!memberUserId}>Add Member</button>
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 220, overflowY: 'auto' }}>
                {members.map((member) => (
                  <div key={member.userId} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{member.user?.name || member.userId}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
                      {member.user?.email || ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        className="input"
                        value={member.role}
                        onChange={(e) => changeMemberRole(member.userId, e.target.value)}
                      >
                        {MEMBER_ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <button className="btn btn-ghost" onClick={() => removeMember(member.userId)}>Remove</button>
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>No members yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
