import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../hooks/useApi';

export default function HomeScreen({
  user,
  workspaces,
  documents,
  conversations,
  activities,
  onOpenWorkspace,
  onOpenDocs,
  onOpenChat,
  onCreateDocument,
  onCreateWorkspace,
  onOpenConversation,
  onOpenDocument,
}) {
  const { apiFetch } = useApi();
  const [tasks, setTasks] = useState([]);
  const [dailyPrompt, setDailyPrompt] = useState('');
  const [dailySummary, setDailySummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [meetingNotesInput, setMeetingNotesInput] = useState('');
  const [capturingMeeting, setCapturingMeeting] = useState(false);
  const [meetingCaptureError, setMeetingCaptureError] = useState('');
  const [meetingTimeline, setMeetingTimeline] = useState([]);
  const [conversionStatusByKey, setConversionStatusByKey] = useState({});
  const meetingInputRef = useRef(null);

  const firstWorkspaceId = workspaces?.[0]?._id || null;

  useEffect(() => {
    if (!firstWorkspaceId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/tasks?workspaceId=${firstWorkspaceId}`)
      .then((list) => {
        if (!cancelled) setTasks(list || []);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [firstWorkspaceId, apiFetch]);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'done'), [tasks]);
  const hasDailySummary = dailySummary.trim().length > 0 && !dailySummary.startsWith('No activity') && !dailySummary.startsWith('Unable');

  useEffect(() => {
    if (!firstWorkspaceId) {
      setMeetingTimeline([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`onechat:meetingTimeline:${firstWorkspaceId}`);
      if (!raw) {
        setMeetingTimeline([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setMeetingTimeline(Array.isArray(parsed) ? parsed : []);
    } catch {
      setMeetingTimeline([]);
    }
  }, [firstWorkspaceId]);

  useEffect(() => {
    if (!firstWorkspaceId) return;
    try {
      window.localStorage.setItem(`onechat:meetingTimeline:${firstWorkspaceId}`, JSON.stringify(meetingTimeline.slice(0, 20)));
    } catch {
      // Ignore persistence errors in private browsing or restricted contexts.
    }
  }, [firstWorkspaceId, meetingTimeline]);

  useEffect(() => {
    function onFocusMeetingCapture() {
      meetingInputRef.current?.focus();
    }
    window.addEventListener('home:focusMeetingCapture', onFocusMeetingCapture);
    return () => window.removeEventListener('home:focusMeetingCapture', onFocusMeetingCapture);
  }, []);

  async function summarizeDay() {
    const baseText = activities
      .slice(0, 25)
      .map((item) => `- ${item.message}`)
      .join('\n');
    if (!baseText.trim()) {
      setDailySummary('No activity yet to summarize.');
      return;
    }
    setSummarizing(true);
    try {
      const prompt = `${dailyPrompt || 'Summarize my day and highlight blockers and next actions.'}\n\n${baseText}`;
      const result = await apiFetch('/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ prompt, contextType: 'activity' }),
      });
      setDailySummary(result?.text || 'No summary generated.');
    } catch {
      setDailySummary('Unable to generate summary right now.');
    } finally {
      setSummarizing(false);
    }
  }

  async function convertTextToTasks({ text, sourceType, sourceId, statusKey }) {
    if (!text.trim()) return;
    if (!firstWorkspaceId) {
      setConversionStatusByKey((prev) => ({ ...prev, [statusKey]: 'Create or open a workspace first.' }));
      return;
    }

    setConversionStatusByKey((prev) => ({ ...prev, [statusKey]: 'Creating tasks...' }));
    try {
      const result = await apiFetch('/ai/extract-actions', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: firstWorkspaceId,
          text,
          createTasks: true,
          sourceType,
          sourceId,
        }),
      });
      const createdTasks = result?.createdTasks || [];
      setTasks((prev) => [...createdTasks, ...prev]);
      setConversionStatusByKey((prev) => ({
        ...prev,
        [statusKey]: createdTasks.length > 0
          ? `Created ${createdTasks.length} task${createdTasks.length > 1 ? 's' : ''}.`
          : 'No actionable tasks found.',
      }));
    } catch {
      setConversionStatusByKey((prev) => ({ ...prev, [statusKey]: 'Task conversion failed. Try again.' }));
    }
  }

  async function captureMeetingNotes() {
    if (!meetingNotesInput.trim()) {
      setMeetingCaptureError('Add meeting notes first.');
      return;
    }
    setMeetingCaptureError('');
    setCapturingMeeting(true);
    try {
      const prompt = [
        'Convert these raw meeting notes into a concise executive summary.',
        'Return plain text in this format:',
        'Summary:',
        '- ...',
        'Decisions:',
        '- ...',
        'Next steps:',
        '- ...',
        '',
        meetingNotesInput.trim(),
      ].join('\n');
      const result = await apiFetch('/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ prompt, contextType: 'meeting_notes' }),
      });

      const nextBlock = {
        id: `meeting-${Date.now()}`,
        createdAt: new Date().toISOString(),
        notes: meetingNotesInput.trim(),
        summary: (result?.text || 'No summary generated.').trim(),
      };
      setMeetingTimeline((prev) => [nextBlock, ...prev].slice(0, 20));
      setMeetingNotesInput('');
    } catch {
      setMeetingCaptureError('Unable to summarize meeting notes right now.');
    } finally {
      setCapturingMeeting(false);
    }
  }

  return (
    <section className="relative flex min-h-full flex-col px-12 pb-12">
      <div className="mb-12 mt-4">
        <h2 className="mb-3 font-headline text-5xl font-semibold tracking-tight italic text-[#1a1a1a]">Welcome back, {user?.name || 'Curator'}.</h2>
        <p className="max-w-lg text-base font-light tracking-wide text-[#64748b]/70">Organize your thoughts and connections in one seamless, intentional interface.</p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onCreateDocument}>New Doc</button>
        <button className="btn btn-secondary" onClick={onCreateWorkspace}>New Workspace</button>
        <button className="btn btn-secondary" onClick={onOpenWorkspace}>Open Workspace</button>
        <button className="btn btn-secondary" onClick={onOpenChat}>Open Chat</button>
        <button className="btn btn-secondary" onClick={onOpenDocs}>Open Docs</button>
      </div>

      <div className="grid flex-1 grid-cols-12 gap-10">
        <div className="col-span-12 rounded-2xl border border-slate-100/50 bg-white p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] lg:col-span-8">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/70">Daily AI Brief</div>
          <textarea
            className="w-full rounded-xl border border-slate-100 bg-white p-3 text-sm outline-none focus:border-slate-200 focus:ring-4 focus:ring-black/5"
            value={dailyPrompt}
            onChange={(e) => setDailyPrompt(e.target.value)}
            placeholder="Optional focus: highlight priorities, blockers, and next actions..."
            rows={3}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={summarizeDay} disabled={summarizing}>
              {summarizing ? 'Generating...' : 'Generate Brief'}
            </button>
            <button
              className="btn btn-secondary"
              disabled={!hasDailySummary}
              onClick={() => convertTextToTasks({
                text: dailySummary,
                sourceType: 'daily_summary',
                sourceId: `daily-${new Date().toISOString().slice(0, 10)}`,
                statusKey: 'daily-summary',
              })}
            >
              Convert Summary to Tasks
            </button>
          </div>
          {conversionStatusByKey['daily-summary'] && <p className="mt-2 text-xs text-[#64748b]">{conversionStatusByKey['daily-summary']}</p>}
          {dailySummary && (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-[#1a1a1a]">{dailySummary}</pre>
          )}
        </div>

        <div className="col-span-12 flex flex-col gap-10 lg:col-span-4">
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)]">
            <div className="mb-8 flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/60">Activity Pulse</h4>
              <span className="h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
            </div>
            <div className="space-y-3 max-h-[220px] overflow-auto">
              {activities.slice(0, 6).map((item) => (
                <div key={item._id} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-sm">{item.message}</div>
                  <div className="mt-1 text-xs text-[#64748b]">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
              ))}
              {activities.length === 0 && <div className="text-sm text-[#64748b]">No activity yet.</div>}
            </div>
            <div className="mt-auto border-t border-slate-50 pt-8">
              <p className="font-headline text-[12px] italic text-[#64748b]/40">"Simplicity is the ultimate sophistication."</p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-[#64748b]/30">— Leonardo da Vinci</p>
            </div>
          </div>

          <div className="group flex cursor-pointer items-center gap-5 rounded-2xl border border-slate-100 bg-white p-6 transition-all duration-500 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-[#64748b] transition-all group-hover:text-[#1a1a1a]">
              <span className="material-symbols-outlined">bookmark</span>
            </div>
            <div className="flex-1">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#64748b]/40">Pinned Resource</p>
              <p className="text-sm font-medium text-[#1a1a1a] transition-transform group-hover:translate-x-1">Project Curations 2024</p>
            </div>
            <span className="material-symbols-outlined text-slate-300 transition-colors group-hover:text-[#1a1a1a]">north_east</span>
          </div>
        </div>

        <div className="col-span-12 rounded-2xl border border-slate-100 bg-white p-6 lg:col-span-7">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/70">Meeting Note Capture</div>
          <textarea
            ref={meetingInputRef}
            className="w-full rounded-xl border border-slate-100 bg-white p-3 text-sm outline-none focus:border-slate-200 focus:ring-4 focus:ring-black/5"
            value={meetingNotesInput}
            onChange={(e) => setMeetingNotesInput(e.target.value)}
            placeholder="Paste quick meeting notes, decisions, owners, and deadlines..."
            rows={5}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" disabled={capturingMeeting} onClick={captureMeetingNotes}>
              {capturingMeeting ? 'Summarizing...' : 'Capture + Auto-Summarize'}
            </button>
            <span className="text-xs text-[#64748b]">Cmd/Ctrl+K, then run "Focus Meeting Capture"</span>
          </div>
          {meetingCaptureError && <p className="mt-2 text-xs text-red-500">{meetingCaptureError}</p>}
        </div>

        <div className="col-span-12 rounded-2xl border border-slate-100 bg-white p-6 lg:col-span-5">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/70">Open Tasks</div>
          <div className="space-y-2 max-h-[260px] overflow-auto">
            {openTasks.slice(0, 10).map((task) => (
              <div key={task._id} className="rounded-lg border border-slate-100 p-3">
                <div className="text-sm font-semibold">{task.title}</div>
                <div className="text-xs text-[#64748b]">{task.status}</div>
              </div>
            ))}
            {openTasks.length === 0 && <div className="text-sm text-[#64748b]">No open tasks.</div>}
          </div>
        </div>

        <div className="col-span-12 rounded-2xl border border-slate-100 bg-white p-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/70">Meeting Timeline Blocks</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[430px] overflow-auto pr-1">
            {meetingTimeline.map((block) => (
              <div key={block.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#64748b]">Meeting Snapshot</span>
                  <span className="text-xs text-[#64748b]">{new Date(block.createdAt).toLocaleString()}</span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-sm">{block.summary}</pre>
                <button
                  className="btn btn-secondary mt-3"
                  onClick={() => convertTextToTasks({
                    text: block.summary,
                    sourceType: 'meeting_summary',
                    sourceId: block.id,
                    statusKey: block.id,
                  })}
                >
                  Convert Summary to Tasks
                </button>
                {conversionStatusByKey[block.id] && (
                  <p className="mt-2 text-xs text-[#64748b]">{conversionStatusByKey[block.id]}</p>
                )}
              </div>
            ))}
            {meetingTimeline.length === 0 && (
              <div className="text-sm text-[#64748b]">No meeting timeline blocks yet.</div>
            )}
          </div>
        </div>

        <div className="col-span-12 rounded-2xl border border-slate-100 bg-white p-6 lg:col-span-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/70">Recent Documents</div>
          <div className="space-y-2">
            {documents.slice(0, 6).map((doc) => (
              <button key={doc._id} className="workspace-section-item w-full text-left" onClick={() => onOpenDocument(doc._id)}>
                <span>{doc.title || 'Untitled Document'}</span>
              </button>
            ))}
            {documents.length === 0 && <div className="text-sm text-[#64748b]">No documents yet.</div>}
          </div>
        </div>

        <div className="col-span-12 rounded-2xl border border-slate-100 bg-white p-6 lg:col-span-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]/70">Recent Conversations</div>
          <div className="space-y-2">
            {conversations.slice(0, 6).map((conv) => (
              <button key={conv._id} className="workspace-section-item w-full text-left" onClick={() => onOpenConversation(conv._id)}>
                <span>{conv.name || 'Conversation'}</span>
              </button>
            ))}
            {conversations.length === 0 && <div className="text-sm text-[#64748b]">No conversations yet.</div>}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-8 right-8 hidden md:block">
        <div className="group flex items-center gap-4 rounded-2xl border border-slate-200/50 bg-white/80 px-5 py-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] backdrop-blur-xl transition-all hover:bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]/70">Command</span>
          <div className="flex gap-1.5">
            <kbd className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold">Cmd</kbd>
            <kbd className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold">K</kbd>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]/70">to search</span>
        </div>
      </div>
    </section>
  );
}
