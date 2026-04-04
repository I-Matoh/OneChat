import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

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
    if (!activeWorkspaceId) {
      setPages([]);
      setActivePageId(null);
      return;
    }

    let cancelled = false;
    async function loadPages() {
      try {
        const list = await apiFetch(`/workspaces/${activeWorkspaceId}/pages`);
        if (cancelled) return;
        setPages(list || []);
        if (list?.length) setActivePageId(list[0]._id);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load pages');
      }
    }
    loadPages();
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

  async function savePage(content) {
    if (!activePageId) return;
    setSaveState('Saving...');
    try {
      const updated = await apiFetch(`/workspaces/pages/${activePageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: activePage?.title || 'Untitled Page',
          content,
        }),
      });
      setPages((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setSaveState('Saved');
      setError('');
    } catch (err) {
      setSaveState('Save failed');
      setError(err.message || 'Unable to save page');
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

        <div className="workspace-table-container" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
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
            {activePage ? (
              <>
                <input
                  className="input"
                  value={activePage.title || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPages((prev) => prev.map((item) => (
                      item._id === activePage._id ? { ...item, title: value } : item
                    )));
                  }}
                  onBlur={() => savePage(activePage.content || '')}
                  placeholder="Page title"
                />
                <textarea
                  className="chat-input"
                  style={{ minHeight: 380, width: '100%', border: '1px solid var(--color-border)', borderRadius: 12, marginTop: 12, padding: 12 }}
                  value={activePage.content || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSaveState('Editing...');
                    setPages((prev) => prev.map((item) => (
                      item._id === activePage._id ? { ...item, content: value } : item
                    )));
                  }}
                  onBlur={(e) => savePage(e.target.value)}
                  placeholder="Write your notes here..."
                />
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-title">Select a page</div>
                <div className="empty-hint">Create or choose a page to start writing</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
