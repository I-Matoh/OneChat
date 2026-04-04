# OneChat Implementation Plan (Notion/Granola Style)

## 1) What the app does today

OneChat is a full-stack real-time collaboration app with:

- JWT auth (`/auth/register`, `/auth/login`, `/auth/me`)
- Real-time chat with Socket.IO (`message:send`, typing, sent/delivered/seen status)
- Collaborative documents with live updates (`doc:update`) and cursor presence (`doc:cursor`)
- Presence tracking (online/away/offline via heartbeat + Redis)
- In-app notifications (message, mention, doc edit)
- React app shell with three main surfaces: Home/Workspace, Chat, Documents

Current product shape is closer to a collaboration MVP with Notion-like visual direction than a true knowledge/workspace system.

## 2) Key strengths found

- Solid real-time foundation (Socket.IO rooms for `user:*`, `chat:*`, `doc:*`)
- Basic collaboration primitives exist (doc list, editor, participants, versions array)
- Notifications and presence are integrated end-to-end
- Auth/session bootstrap flow is implemented and usable

## 3) Key gaps blocking a true Notion/Granola experience

### Product gaps

- No first-class workspace/page hierarchy (nested pages, collections, backlinks)
- No structured notes model (meeting notes, action items, decisions, summaries)
- AI UX is mostly UI-only; backend endpoint `/ai/assistant` is missing
- Workspace page is mostly mock data (`mockData`, sample spaces)
- Search is local/filter-only; no global semantic or full-text search

### Collaboration/data gaps

- Document sync uses last-write-wins; no CRDT/OT conflict-safe model
- Message/doc permissions are minimal (collaborators/participants only)
- No comments, threads, mentions in docs, task objects, or reminders
- No audit trail/activity feed per workspace/doc

### Engineering gaps

- Large duplicated CSS and mixed design patterns, making UI harder to evolve
- Presence monitor uses Redis key scan (`keys`) which won’t scale well
- No validation layer (`zod`/`joi`) and weak request contracts
- Little/no tests (unit/integration/e2e) and no CI checks
- Some unused/placeholder UI (e.g., `HomeScreen.jsx`) and dead-end features

## 4) Target product direction

Build OneChat into a "collaborative notes + conversations" workspace:

- Notion-inspired structure: spaces, pages, nested docs, linked knowledge
- Granola-inspired meeting intelligence: summaries, decisions, action extraction
- Real-time multiplayer editing/chat as core differentiator

## 5) Implementation roadmap (phased)

## Phase 0 - Stabilize baseline (1 week)

- Clean unused routes/components and dead UI paths
- Split `index.css` into modular feature styles/tokens
- Add request validation and error envelope standard
- Add backend health/readiness checks and structured logging
- Add lint/format scripts + CI for build/test

**Deliverable:** stable baseline for safe feature iteration.

## Phase 1 - Data model and workspace foundation (1-2 weeks)

Introduce core entities:

- `Workspace` (name, owner, members, plan)
- `Page` (workspaceId, parentId, title, icon, cover, type, order)
- `Block` (pageId, type, content JSON, order)
- `MeetingNote` (source chat/doc, summary, decisions, actionItems)
- `Task` (workspaceId, assignee, dueDate, status, sourceRef)

Also add role-based access:

- roles: owner, admin, editor, commenter, viewer
- policy checks in middleware for page/chat/doc actions

**Deliverable:** normalized schema for Notion-style hierarchy and permissions.

## Phase 2 - Real editor and collaboration upgrade (2-3 weeks)

- Replace textarea editor with ProseMirror/Tiptap (or Lexical)
- Move from LWW updates to CRDT (Yjs + y-websocket or Socket.IO adapter)
- Add block operations: paragraph, heading, checklist, toggle, code, quote
- Add inline comments, mentions, and resolved thread state
- Persist operation history and page versions for restore

**Deliverable:** robust multiplayer block editor with low-conflict sync.

## Phase 3 - Chat-to-knowledge workflow (2 weeks)

- Enrich chat model with threads, pinned messages, attachments metadata
- Add "Create note from chat" and "Promote to task" actions
- Build unified activity timeline (chat + doc + task events)
- Add cross-links: message <-> page <-> task references

**Deliverable:** conversations become structured workspace knowledge.

## Phase 4 - AI capabilities that actually execute (2 weeks)

Implement backend AI service and endpoints:

- `POST /ai/assistant` (existing frontend expectation)
- `POST /ai/summarize/chat/:conversationId`
- `POST /ai/extract-actions/:sourceId`
- `POST /ai/rewrite/:pageId`

Guardrails:

- workspace-scoped retrieval only
- usage logging, quotas, retry/fallback handling
- explicit source citations for generated outputs

**Deliverable:** reliable AI assistant for summaries, decisions, and tasks.

## Phase 5 - Search, navigation, and polish (1-2 weeks)

- Implement global search (title/content/messages/tasks)
- Add command palette (`Cmd/Ctrl+K`) and keyboard shortcuts
- Add page tree, favorites, recent, and breadcrumb navigation
- Improve mobile responsive layout and panel behavior
- Add onboarding flow and empty states for first-time teams

**Deliverable:** polished, fast workspace UX with Notion-like navigation.

## 6) Priority engineering improvements (high impact)

1. Implement missing AI backend route(s) to remove broken UI flows.
2. Replace mock Workspace data with real APIs and persisted entities.
3. Introduce schema validation + centralized error handling.
4. Migrate editor sync from LWW to CRDT to prevent edit loss.
5. Add test pyramid:
   - unit: auth, permission checks, service functions
   - integration: chat/doc routes + socket events
   - e2e: login, create doc, real-time edit, create conversation

## 7) Suggested API additions

- `GET /workspaces`, `POST /workspaces`
- `GET /workspaces/:id/pages`, `POST /pages`, `PATCH /pages/:id`, `DELETE /pages/:id`
- `POST /pages/:id/blocks/reorder`
- `POST /tasks`, `PATCH /tasks/:id`, `GET /tasks?workspaceId=&assignee=`
- `GET /search?q=&workspaceId=`
- `GET /activity?workspaceId=&cursor=`

## 8) Suggested non-functional targets

- P95 page load < 2.5s on broadband
- Realtime event latency < 250ms (same region)
- Zero lost edits under dual-user concurrent edit test
- Test coverage baseline: 70% critical services/routes
- Error budget + observability dashboard (API errors, socket disconnects, Redis lag)

## 9) Risks and mitigations

- **Risk:** CRDT migration complexity
  - **Mitigation:** feature-flag new editor per workspace; dual-write transitional period.
- **Risk:** AI quality drift/hallucinations
  - **Mitigation:** retrieval constraints + source citation + human confirm actions.
- **Risk:** CSS refactor regressions
  - **Mitigation:** Storybook/visual snapshots before and after style modularization.

## 10) Immediate next sprint recommendation

Sprint goal: convert OneChat from MVP demo flows to durable workspace core.

Sprint scope:

- Add `Workspace` + `Page` models and CRUD APIs
- Wire Workspace UI to real backend data (remove mock spaces/company table)
- Implement `/ai/assistant` backend endpoint with basic summarization path
- Add validation middleware and standardized API errors
- Add integration tests for auth/chat/docs happy paths

Success criteria:

- A user can create workspace -> create nested page -> collaborate in real time -> generate summary -> save tasks.

## 11) Progress Update (Implemented)

- Added backend AI endpoint: `POST /ai/assistant`
- Added AI summarization service fallback in `backend/src/ai/ai.service.js`
- Added workspace domain models:
  - `backend/src/models/Workspace.js`
  - `backend/src/models/Page.js`
- Added workspace/page APIs:
  - `GET /workspaces`
  - `POST /workspaces`
  - `GET /workspaces/:workspaceId/pages`
  - `POST /workspaces/:workspaceId/pages`
  - `PATCH /workspaces/pages/:pageId`
  - `DELETE /workspaces/pages/:pageId`
- Wired new routes in server bootstrap (`backend/src/index.js`)
- Added request validation middleware for AI/workspace/page payloads (`backend/src/middleware/validate.js`)
- Replaced mock Workspace frontend with live API-driven screen (`frontend/src/pages/Workspace.jsx`)
- Connected App sidebar spaces to real workspace APIs (`frontend/src/App.jsx`)
- Added unified authenticated search endpoint (`GET /search?q=`) across conversations, documents, workspaces, and pages
- Added role-based workspace authorization checks (viewer/commenter/editor/admin/owner) for page and member operations
- Added workspace member management APIs:
  - `GET /workspaces/:workspaceId/members`
  - `POST /workspaces/:workspaceId/members`
  - `PATCH /workspaces/:workspaceId/members/:memberUserId`
  - `DELETE /workspaces/:workspaceId/members/:memberUserId`
- Added task system:
  - model: `backend/src/models/Task.js`
  - routes: `GET/POST /tasks`, `PATCH/DELETE /tasks/:taskId`
- Upgraded AI routes with Groq support (`GROQ_API_KEY`, optional `GROQ_MODEL`) and fallback mode
- Added AI action extraction endpoint with automatic task creation:
  - `POST /ai/extract-actions`
- Replaced strict LWW doc updates with revision-aware merge flow and sync/ack events:
  - server events: `doc:sync`, `doc:ack`, `doc:sync-request`
  - client sends `baseRevision` and `baseContent` to reduce overwrite conflicts
- Implemented workspace UI flows for:
  - task CRUD/status updates
  - AI task extraction from page content
  - member add/update/remove with role assignment
- Updated `README.md` with current environment setup, APIs, and realtime events
- Removed remaining runtime mock/static data usage:
  - deleted unused `frontend/src/pages/HomeScreen.jsx`
  - replaced hardcoded chat contact info with real participant metadata
- Added backend activity feed:
  - model: `backend/src/models/Activity.js`
  - routes: `GET /activity`
  - service: `backend/src/activity/activity.service.js`
  - event logging integrated in workspace/page/task/chat/document/AI flows
- Wired shell-level global search and command palette behavior (`Ctrl/Cmd+K`) to live `/search` API
- Wired right context panel to live `/activity` feed instead of local placeholders
- Implemented signup-first onboarding flow (`Login` now opens in register mode)
- Added Granola-style authenticated Home screen (`frontend/src/pages/HomeScreen.jsx`) with:
  - AI daily brief generation from activity
  - quick actions (create doc/workspace, jump to chat/docs/workspace)
  - live tasks, docs, conversations, and activity panels
- Set authenticated default landing view to Home in `frontend/src/App.jsx`

 
