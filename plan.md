# OneChat Remaining Implementation Plan (Post-Audit)

Date: 2026-04-05

## 1) Audit Result Summary

The current codebase already delivers a strong v1/v1.5 baseline:
- Auth, chat, realtime docs, workspaces/pages, member roles, tasks, AI assistant/action extraction, search, activity feed, presence, notifications, command palette.

However, the plans in `IMPLEMENTATION_PLAN.md`, `PRD.md`, and `VERSION.md` are **not fully met** yet.

High-impact gaps still open:
- Editor is still textarea-based (no Tiptap/ProseMirror block editor).
- No CRDT (Yjs) sync yet; current model is revision-aware merge.
- Search does not include tasks and has no type filters/semantic mode.
- Missing AI endpoints from roadmap (`/ai/summarize/chat/:conversationId`, `/ai/rewrite/:pageId`).
- No comments/threads/mentions inside docs.
- No automated tests and no CI pipeline.
- No lint/format scripts in packages.
- Validation is custom middleware, not a robust schema layer (Zod/Joi).
- Presence uses Redis `KEYS` (not scalable; needs `SCAN`).
- Health endpoint exists, but no readiness endpoint and no structured logging stack.

## 2) Remaining Scope by Phase

## Phase A - Reliability Foundation (P0)

Goal: make current features safe to scale and easy to iterate.

Work: 
- Add standardized API error envelope and centralized error middleware.
- Replace ad-hoc validators with schema validation (Zod or Joi) for all write routes.
- Add `/ready` readiness endpoint (DB + Redis checks).
- Introduce structured logging (Pino) with request-id correlation.
- Replace Redis `KEYS presence:*` with cursor-based `SCAN` in presence service.
- Add lint/format scripts in backend/frontend (`lint`, `format`, `test`).
- Add CI workflow (lint + build + tests on PR).

Acceptance:
- All API errors follow one response shape.
- Readiness fails when DB/Redis unavailable.
- Presence monitor no longer uses `KEYS`.
- CI runs on every PR and blocks on failures.

## Phase B - Quality Gate (P0)

Goal: establish a minimal test pyramid for critical behavior.

Work:
- Unit tests: auth controller/service, workspace role checks, AI extraction fallback.
- Integration tests: auth, chat conversation creation/messages, docs CRUD, workspace/page/task APIs.
- Realtime integration tests: socket chat status flow and doc sync/ack flow.
- Frontend smoke tests for login + route shell load.

Acceptance:
- Critical-path coverage >= 70% for backend service/route layer.
- Green tests required in CI.

## Phase C - Editor V2 + Document Collaboration (P0)

Goal: deliver true Notion-like authoring.

Work:
- Replace textarea editor with Tiptap block editor.
- Support core blocks: paragraph, heading, checklist, quote, code, toggle.
- Add slash command menu (`/`) and block reordering.
- Introduce inline comments + thread model (create/reply/resolve).
- Add page/doc mentions in editor and notification hooks.

Acceptance:
- Users can create/edit/reorder blocks in UI.
- Comments and thread resolution persist to backend.
- Mentions trigger notifications.

## Phase D - CRDT Sync (P0)

Goal: remove merge-conflict UX and reduce edit loss risk.

Work:
- Add Yjs document model and Socket.IO provider/adapter.
- Migrate from revision merge events to CRDT operations.
- Keep temporary fallback flag for legacy docs during migration.
- Add concurrent-edit regression tests (2+ users).

Acceptance:
- No conflict markers inserted during concurrent edits.
- Concurrent edit tests pass with zero lost updates.

## Phase E - Workspace Knowledge Features (P1)

Goal: complete hierarchy and knowledge workflows.

Work:
- Finish nested page UX (tree view, expand/collapse, drag reorder, breadcrumbs).
- Add page metadata: `type`, `icon`, `cover` and templates.
- Add linked pages (`[[Page]]`) + backlinks.
- Add "Create note from chat" and "Promote to task" actions.
- Add chat threads/pinned messages/attachment metadata model.

Acceptance:
- Users can navigate deep page trees and backlinks.
- Chat content can be converted into pages/tasks from UI.

## Phase F - AI Endpoint Completion (P1)

Goal: align backend AI capabilities with roadmap/PRD.

Work:
- Implement `POST /ai/summarize/chat/:conversationId`.
- Implement `POST /ai/rewrite/:pageId`.
- Add workspace-scoped retrieval guardrails and source citation payloads.
- Add usage logging, quotas, retry/fallback policy surface.

Acceptance:
- All AI endpoints referenced in roadmap exist and are wired in UI.
- Responses include provider + source references when applicable.

## Phase G - Search and Navigation Completion (P1)

Goal: deliver complete discovery UX.

Work:
- Extend `/search` to include tasks.
- Add `type` filter support (`conversation|document|workspace|page|task`).
- Add pagination/cursor support for search and activity endpoints.
- Add favorites/recent/breadcrumb persistence in UI.
- Optional v2: semantic search behind feature flag.

Acceptance:
- Search results can be filtered by content type.
- Tasks appear in global search results.

## 3) Suggested Execution Order (Next 6 Sprints)

1. Sprint 1: Phase A (Reliability Foundation)
2. Sprint 2: Phase B (Quality Gate)
3. Sprint 3-4: Phase C (Editor V2)
4. Sprint 5: Phase D (CRDT)
5. Sprint 6: Phase F + Phase G baseline (AI endpoints + search filters/tasks)

Phase E can start in parallel after Sprint 3 where ownership is split by module.

## 4) Risks and Mitigations

- CRDT migration risk:
  - Mitigation: feature flag + dual path until parity is verified.
- Editor refactor risk:
  - Mitigation: keep current editor as fallback until block parity is done.
- Test rollout slowdown:
  - Mitigation: start with critical paths only and expand coverage incrementally.

## 5) Definition of Done for This Plan

- All P0 phases (A-D) complete.
- PRD user stories for auth/workspace/pages/chat/tasks/AI/search are fully test-backed.
- Version 2.0 must-have items (editor, CRDT, nested pages UX) are production-ready.