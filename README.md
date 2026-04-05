# OneChat - Real-Time Collaboration Workspace

OneChat is a full-stack collaboration app with chat, live documents, workspace pages, task workflows, and AI-assisted action extraction.

## Live App

https://one-chat-ten.vercel.app/

## Core Features
 
- JWT auth (`/auth/register`, `/auth/login`, `/auth/me`)
- Real-time chat with typing + message statuses
- Collaborative docs with revision-aware realtime sync events
- Workspace + page management
- Role-based permissions (`owner/admin/editor/commenter/viewer`)
- Task management API and UI
- AI assistant + AI action extraction with optional Groq provider
- Presence + notification system

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Cache / Pub-Sub | Redis (ioredis) |
| Auth | JWT + bcrypt |
| AI (optional) | Groq Chat Completions API |

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=your_mongo_uri
REDIS_URL=your_redis_url
JWT_SECRET=your_very_long_jwt_secret_min_32_chars

# Optional AI provider
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
```

If `GROQ_API_KEY` is missing, AI routes use a local fallback summarizer/extractor.

## Quick Start

### 1. Infrastructure

- Start MongoDB + Redis (local or cloud).
- Optional local Docker:

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`.

### 3. Frontend

```bash
cd frontend
npm install 
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API Overview

### Auth and Core

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users`
- `GET /health`

### Chat

- `GET /chat/conversations`
- `POST /chat/conversations`
- `GET /chat/conversations/:id/messages`

### Docs

- `GET /docs`
- `POST /docs`
- `GET /docs/:id`
- `PATCH /docs/:id`

### Workspaces and Pages

- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId/pages`
- `POST /workspaces/:workspaceId/pages`
- `PATCH /workspaces/pages/:pageId`
- `DELETE /workspaces/pages/:pageId`

### Workspace Members / Roles

- `GET /workspaces/:workspaceId/members`
- `POST /workspaces/:workspaceId/members`
- `PATCH /workspaces/:workspaceId/members/:memberUserId`
- `DELETE /workspaces/:workspaceId/members/:memberUserId`

### Tasks

- `GET /tasks?workspaceId=...`
- `POST /tasks`
- `PATCH /tasks/:taskId`
- `DELETE /tasks/:taskId`

### AI

- `POST /ai/assistant`
- `POST /ai/extract-actions`

### Search

- `GET /search?q=...`

## Real-Time Events

### Chat

- `chat:join`, `chat:leave`
- `message:send`, `message:new`, `message:typing`
- `message:status`

### Collaboration

- `doc:join`, `doc:leave`
- `doc:update`
- `doc:sync`, `doc:ack`, `doc:sync-request`
- `doc:cursor`, `doc:cursors`

### Presence and Notifications

- `presence:init`, `presence:update`
- `notification:new`

## Project Structure

```text
OneChat/
  backend/src/
    ai/
    auth/
    chat/
    collaboration/
    notifications/
    presence/
    search/
    tasks/
    workspace/
    websocket/
    middleware/
    models/
  frontend/src/
    pages/
    components/
    hooks/
```

## Current Roadmap

See [IMPLEMENTATION_PLAN.md](c:/Users/ADMIN/OneChat/IMPLEMENTATION_PLAN.md).
