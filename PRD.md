# OneChat PRD - Product Requirements Document

## 1. Overview

**Project Name:** OneChat  
**Type:** Full-stack Real-Time Collaboration Workspace  
**Live App:** https://one-chat-ten.vercel.app/  
**Product Vision:** Transform OneChat from an MVP collaboration demo into a Notion-style knowledge workspace with Granola-inspired AI meeting intelligence.

--- 

## 2. Target Users

- **Primary:** Small to medium teams needing unified chat + docs + task management
- **Secondary:** Remote teams requiring real-time collaboration with AI assistance
- **Tertiary:** Individual knowledge workers seeking an all-in-one workspace

---

## 3. Problem Statement

Teams currently use multiple fragmented tools:
- Slack/Discord for chat
- Notion/Confluence for docs
- Asana/Trello for tasks
- Granola/Athena for AI meeting notes

OneChat consolidates these into a single real-time workspace with built-in AI intelligence.

---

## 4. Core Features

### 4.1 Authentication & User Management
- JWT-based auth (`/auth/register`, `/auth/login`, `/auth/me`)
- User profile management
- Session handling with secure tokens

### 4.2 Real-Time Chat
- Direct and group conversations
- Typing indicators
- Message statuses (sent/delivered/seen)
- Socket.IO-based real-time messaging

### 4.3 Collaborative Documents
- Create, edit, and manage documents
- Real-time sync with revision-aware merge
- Cursor presence for collaborators
- Block-based editing structure

### 4.4 Workspace & Page Hierarchy
- Workspace creation and management
- Nested page hierarchy (parent/child pages)
- Role-based permissions (owner/admin/editor/commenter/viewer)
- Page types (doc, database, meeting notes)

### 4.5 Task Management
- Create, assign, and track tasks
- Status workflows (todo, in-progress, done)
- Due dates and priority
- Link tasks to pages or conversations

### 4.6 AI Assistant
- Chat with AI for workspace queries
- Summarize conversations and documents
- Extract action items from content
- Optional Groq provider integration

### 4.7 Presence & Notifications
- Real-time presence (online/away/offline)
- In-app notifications for mentions, updates
- Activity feed per workspace

### 4.8 Search
- Unified global search across:
  - Conversations
  - Documents
  - Workspaces
  - Pages
  - Tasks

---

## 5. Technical Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Cache/Pub-Sub | Redis (ioredis) |
| Auth | JWT + bcrypt |
| AI (optional) | Groq Chat Completions API |

---

## 6. User Stories

### Authentication
- [ ] As a user, I can register with email/password
- [ ] As a user, I can login and receive a JWT
- [ ] As a user, I can view my profile

### Workspaces
- [ ] As a user, I can create a new workspace
- [ ] As a user, I can view all my workspaces
- [ ] As a workspace owner, I can invite members with roles
- [ ] As a member, I can only access permitted workspaces

### Pages
- [ ] As a user, I can create pages within a workspace
- [ ] As a user, I can nest pages under other pages
- [ ] As a user, I can edit page content in real-time
- [ ] As a user, I can delete pages

### Chat
- [ ] As a user, I can create conversations
- [ ] As a user, I can send and receive messages in real-time
- [ ] As a user, I can see typing indicators
- [ ] As a user, I can see message read status

### Tasks
- [ ] As a user, I can create tasks in a workspace
- [ ] As a user, I can assign tasks to members
- [ ] As a user, I can update task status
- [ ] As a user, I can view tasks by workspace or assignee

### AI Features
- [ ] As a user, I can ask the AI assistant questions
- [ ] As a user, I can extract action items from documents
- [ ] As a user, I can summarize conversations

### Search
- [ ] As a user, I can search across all workspace content
- [ ] As a user, I can filter search by content type

---

## 7. API Endpoints Summary

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users`

### Chat
- `GET /chat/conversations`
- `POST /chat/conversations`
- `GET /chat/conversations/:id/messages`

### Documents
- `GET /docs`
- `POST /docs`
- `GET /docs/:id`
- `PATCH /docs/:id`

### Workspaces
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId/pages`
- `POST /workspaces/:workspaceId/pages`
- `PATCH /workspaces/pages/:pageId`
- `DELETE /workspaces/pages/:pageId`
- `GET /workspaces/:workspaceId/members`
- `POST /workspaces/:workspaceId/members`
- `PATCH /workspaces/:workspaceId/members/:memberUserId`
- `DELETE /workspaces/:workspaceId/members/:memberUserId`

### Tasks
- `GET /tasks?workspaceId=`
- `POST /tasks`
- `PATCH /tasks/:taskId`
- `DELETE /tasks/:taskId`

### AI
- `POST /ai/assistant`
- `POST /ai/extract-actions`

### Search & Activity
- `GET /search?q=`
- `GET /activity?workspaceId=`

---

## 8. Real-Time Events

### Chat
- `chat:join`, `chat:leave`
- `message:send`, `message:new`, `message:typing`
- `message:status`

### Collaboration
- `doc:join`, `doc:leave`
- `doc:update`
- `doc:sync`, `doc:ack`, `doc:sync-request`
- `doc:cursor`, `doc:cursors`

### Presence
- `presence:init`, `presence:update`
- `notification:new`

---

## 9. Non-Functional Requirements

### Performance
- P95 page load < 2.5s on broadband
- Real-time event latency < 250ms (same region)
- Zero lost edits under concurrent editing

### Security
- JWT token expiration and refresh
- Role-based access control
- Input validation and sanitization

### Reliability
- Graceful error handling
- Structured logging
- Health checks endpoints

---

## 10. Out of Scope (v1.0)

- Mobile native apps (responsive web only)
- Custom domain support
- Third-party integrations (Slack, Notion, etc.)
- Billing/subscription management
- Multi-file uploads/downloads
- Advanced analytics dashboard

---

## 11. Success Metrics

- User registration completion rate
- Daily Active Users (DAU)
- Messages sent per user per day
- Pages created per workspace
- Tasks completed per user
- AI assistant usage frequency

---

## 12. Timeline

| Phase | Focus | Estimated Duration |
| --- | --- | --- |
| 0 | Stabilize baseline | 1 week |
| 1 | Data model & workspace foundation | 1-2 weeks |
| 2 | Real editor & collaboration upgrade | 2-3 weeks |
| 3 | Chat-to-knowledge workflow | 2 weeks |
| 4 | AI capabilities | 2 weeks |
| 5 | Search, navigation, polish | 1-2 weeks |

---

*Document Version: 1.0*  
*Last Updated: 2026-04-05*
