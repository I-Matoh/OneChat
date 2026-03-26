# OneChat — Real-Time Collaboration Platform




try it here!!!

https://one-chat-ten.vercel.app/ 






A full-stack real-time collaboration app for remote teams, developers, and students.

## Features

- **Real-Time Chat** — instant messaging with typing indicators and delivery status
- **Live Document Editing** — collaborative editor with cursor presence
- **User Presence** — online/away/offline with WebSocket heartbeat
- **Notifications** — in-app alerts for messages, edits, and mentions
- **JWT Authentication** — secure registration and login

## Tech Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Frontend        | React 18, Vite, Socket.IO Client |
| Backend         | Node.js, Express, Socket.IO      |
| Database        | MongoDB (Mongoose)               |
| Cache / Pub-Sub | Redis (ioredis)                  |
| Auth            | JWT + bcrypt                     |

## Quick Start

### 1. Start MongoDB & Redis

- **Cloud (Current):** Update `MONGO_URI` and `REDIS_URL` in `backend/.env`.
- **Docker:** Run `docker-compose up -d` for local development.

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

## Project Structure

```
OneChat/
├── backend/
│   └── src/
│       ├── auth/           # Registration, login, JWT
│       ├── chat/           # Messaging, conversations
│       ├── collaboration/  # Document editing
│       ├── presence/       # Online status tracking
│       ├── notifications/  # In-app alerts
│       ├── websocket/      # Socket.IO server
│       ├── models/         # Mongoose schemas
│       ├── middleware/     # Auth, rate-limiter
│       └── config/         # DB, Redis connections
├── frontend/
│   └── src/
│       ├── pages/          # Login, Chat, Editor
│       ├── components/     # PresenceSidebar, NotificationBell
│       └── hooks/          # useSocket, useAuth, useApi
└── docker-compose.yml
```
