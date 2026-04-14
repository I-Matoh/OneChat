import { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Save, Trash2, Sparkles, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import AIPageModal from '@/components/pages/AIPageModal';

const PAGE_ICONS = ['📄', '📝', '🗒️', '📋', '📊', '🗃️', '🔖', '💡', '🎯', '🧠', '📅', '🗓️'];

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
};

export default function PageEditor() {
  const { pageId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, currentWorkspaceId } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = pageId === 'new';

  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('📄');
  const [pageType, setPageType] = useState('doc');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const { data: page } = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => api.pages.get(pageId),
    enabled: !isNew && !!pageId,
  });

  useEffect(() => {
    if (page) {
      setTitle(page.title || 'Untitled');
      setContent(page.content || '');
      setIcon(page.icon || '📄');
      setPageType(page.pageType || 'doc');
    }
  }, [page]);

  const save = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    if (isNew) {
      const newPage = await api.pages.create(currentWorkspaceId, {
        title: title || 'Untitled',
        content,
        icon,
      });
      queryClient.invalidateQueries({ queryKey: ['pages', currentWorkspaceId] });
      navigate(`/pages/${newPage._id}?w=${currentWorkspaceId}`, { replace: true });
    } else {
      await api.pages.update(pageId, {
        title: title || 'Untitled',
        content,
        icon,
      });
      queryClient.invalidateQueries({ queryKey: ['pages', currentWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
    }
    setLastSaved(new Date());
    setSaving(false);
  }, [pageId, title, content, icon, pageType, currentWorkspaceId, isNew]);

  const handleDelete = async () => {
    if (!confirm('Delete this page?')) return;
    await api.pages.update(pageId, { isArchived: true });
    queryClient.invalidateQueries({ queryKey: ['pages', currentWorkspaceId] });
    navigate(`/?w=${currentWorkspaceId}`);
  };

  useEffect(() => {
    if (isNew) return;
    const timer = setTimeout(() => { if (page) save(); }, 2000);
    return () => clearTimeout(timer);
  }, [content, title]);

  const typeLabels = { doc: '📝 Doc', database: '🗄️ Database', meeting_notes: '🎙️ Meeting Notes' };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAI(true)} className="gap-1.5 text-primary">
          <Sparkles className="w-3.5 h-3.5" /> AI
        </Button>
        {!isNew && (
          <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="text-4xl hover:bg-muted rounded-lg p-1 transition-colors"
              >
                {icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl p-2 flex flex-wrap gap-1 z-10 w-48">
                  {PAGE_ICONS.map(i => (
                    <button
                      key={i}
                      onClick={() => { setIcon(i); setShowIconPicker(false); }}
                      className="text-xl p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      {i}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              {Object.entries(typeLabels).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setPageType(type)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    pageType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full text-4xl font-cal font-bold text-foreground bg-transparent border-0 outline-none placeholder:text-muted-foreground/40 mb-6"
          />

          <div className="prose-editor">
            <ReactQuill
              value={content}
              onChange={setContent}
              modules={modules}
              placeholder="Start writing something amazing..."
              className="min-h-[400px]"
            />
          </div>
        </div>
      </div>

      {showAI && (
        <AIPageModal
          pageTitle={title}
          pageContent={content}
          onClose={() => setShowAI(false)}
          onInsert={(text) => { setContent(prev => prev + `<p>${text}</p>`); setShowAI(false); }}
        />
      )}
    </div>
  );
}
