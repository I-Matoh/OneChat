Below is a **clear, production-style PRD (Product Requirements Document)** plus **high-quality “executive prompts” you can give to OpenAI Codex** to generate the system step-by-step.
This is designed to demonstrate **advanced engineering ability** in a portfolio.

---

# Real-Time Collaboration Platform — PRD

## 1. Product Overview

**Product Name:** LiveSync
**Type:** Real-Time Collaboration Platform

**Purpose:**
Enable multiple users to **chat, edit documents simultaneously, receive notifications, and see online presence in real-time.**

Target users:

* Remote teams
* Developers
* Students
* Distributed organizations

Primary goal:

Deliver **sub-100ms real-time interactions** across all collaboration features.

---

# 2. Core Features

## 2.1 Real-Time Chat

Capabilities:

* Send/receive messages instantly
* Group conversations
* Message history
* Typing indicators
* Message delivery status

Real-time requirement:

Messages appear **< 200ms latency**.

Data example:

```
Message
id
conversationId
senderId
content
timestamp
status
```

---

## 2.2 Live Document Editing

Multiple users edit the same document simultaneously.

Capabilities:

* Cursor presence
* Live typing updates
* Conflict resolution
* Auto-save
* Version history

Possible technologies:

* Operational Transformation (OT)
* CRDT

Document example:

```
Document
id
title
content
lastUpdated
collaborators[]
```

---

## 2.3 Notifications

Users receive alerts when:

* Someone sends a message
* Someone edits a document
* Someone mentions them

Types:

* In-app
* Push
* Email (optional)

---

## 2.4 User Presence

Shows who is currently online.

Status options:

* online
* away
* offline
* typing

Presence updates using **WebSocket heartbeat**.

---

# 3. System Architecture

Frontend

* React

Backend

* Node.js
* Express.js

Real-time layer

* WebSocket

Caching + Pub/Sub

* Redis

Database

* MongoDB

---

# 4. High Level Architecture Flow

```
Client (React)
     │
     │ WebSocket
     ▼
Node.js Server
     │
     ├── Redis (Pub/Sub, presence, caching)
     │
     └── MongoDB (persistent storage)
```

---

# 5. Backend Services

## Auth Service

Handles:

* registration
* login
* JWT tokens

Endpoints:

```
POST /auth/register
POST /auth/login
```

---

## Chat Service

Handles:

* send message
* receive messages
* message history

Events:

```
message:send
message:receive
message:typing
```

---

## Collaboration Service

Handles:

* document updates
* edit synchronization
* cursor positions

Events:

```
doc:update
doc:cursor
doc:join
doc:leave
```

---

## Presence Service

Tracks online users.

Redis stores:

```
presence:userId -> online
```

Heartbeat every **10 seconds**.

---

# 6. Database Schema

Users

```
{
 id
 name
 email
 passwordHash
 status
 createdAt
}
```

Messages

```
{
 id
 conversationId
 senderId
 content
 createdAt
}
```

Documents

```
{
 id
 title
 content
 collaborators
 updatedAt
}
```

Notifications

```
{
 id
 userId
 type
 message
 read
}
```

---

# 7. WebSocket Event Design

Connection

```
connect
disconnect
heartbeat
```

Chat

```
message:send
message:new
message:typing
```

Collaboration

```
doc:update
doc:cursor
doc:join
```

Presence

```
presence:update
```

---

# 8. Performance Requirements

Latency target:

```
chat: <200ms
editing: <100ms
presence: <5s update
```

Scaling approach:

* Redis Pub/Sub
* Horizontal Node scaling
* WebSocket load balancing

---

# 9. Security

Authentication

* JWT tokens
* HTTPS

Authorization

* document access permissions

Rate limiting

* Redis

---

# 10. Observability

Monitoring:

* API latency
* WebSocket connections
* message throughput

Logging:

* error logs
* message delivery metrics

---

# Executive Prompts for Codex

These are **professional prompts to generate production code**.

---

# Prompt 1 — System Setup

Prompt for OpenAI Codex:

```
You are a senior backend engineer.

Create a scalable real-time collaboration backend using:

Node.js
Express
WebSockets
Redis
MongoDB

Features:

- authentication with JWT
- WebSocket server
- Redis pub/sub for real-time messaging
- MongoDB schemas for users, messages, documents
- modular folder architecture

Output a full project structure and starter code.
```

---

# Prompt 2 — Real-Time Chat

```
Implement a WebSocket chat service.

Requirements:

- send messages
- broadcast to conversation participants
- typing indicators
- message persistence in MongoDB
- Redis pub/sub to support horizontal scaling

Use Node.js and WebSocket.
```

---

# Prompt 3 — Live Document Editing

```
Create a real-time collaborative document editing service.

Requirements:

- WebSocket updates
- multiple users editing simultaneously
- cursor tracking
- operational transformation or CRDT conflict resolution
- Redis pub/sub to sync across instances
```

---

# Prompt 4 — User Presence

```
Implement user presence tracking.

Requirements:

- WebSocket heartbeat every 10 seconds
- Redis store for online status
- broadcast presence updates to connected users
```

---

# Prompt 5 — React Frontend

```
Create a React frontend for the collaboration platform.

Features:

- chat interface
- collaborative document editor
- online user presence indicator
- WebSocket client integration
```

---

# Suggested Folder Structure

```
realtime-collab/

frontend/
backend/

backend/
 src/
  auth/
  chat/
  collaboration/
  presence/
  websocket/
  models/
  services/

frontend/
 src/
  components/
  pages/
  hooks/
  websocket/
```

---

# Optional Advanced Features (for elite portfolio)

Add later:

* document version control
* voice collaboration
* video calls
* AI summaries
* collaborative whiteboard

