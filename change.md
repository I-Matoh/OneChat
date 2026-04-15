# Frontend-Backend Integration Audit Report

## Executive Summary
This audit evaluates the integration between the frontend (React + Vite) and backend (Express + MongoDB + Socket.IO) for the OneChat application. The architecture follows a REST API + WebSocket pattern with JWT authentication.

---

## 1. Authentication Flow ✓

### Current Implementation
- **Frontend**: `useAuth` hook (`frontend/src/hooks/useAuth.jsx`) supports dual-mode:
  - Supabase authentication (when configured)
  - Custom JWT-based authentication
- **Backend**: JWT tokens issued via `/auth/login` and `/auth/register`

### Integration Status
| Component | Status | Notes |
|-----------|--------|-------|
| Login/Register | ✅ Working | Both Supabase and custom modes |
| Token Storage | ✅ Working | localStorage with `onechat_auth` key |
| Session Restore | ✅ Working | Validates via `/auth/me` endpoint |
| Logout | ✅ Working | Clears localStorage and disconnects socket |

---

## 2. REST API Integration ⚠️ ISSUES FOUND

### Issue #1: Missing Authorization Headers in Chat.jsx

**File**: `frontend/src/pages/Chat.jsx`

**Problem**: Lines 22, 28 use `fetch()` without Authorization header:
```javascript
// Line 22
queryFn: () => fetch(`/chat/conversations?workspaceId=${currentWorkspaceId}`).then(r => r.json()),
// Line 28
queryFn: () => fetch(`/chat/messages?conversationId=${selectedConvId}`).then(r => r.json()),
```

**Expected**: Should include `Authorization: Bearer <token>` header

---

### Issue #2: Field Name Mismatch (snake_case vs camelCase)

**Backend expects** (`backend/src/chat/chat.routes.js:85-86`):
```javascript
const { conversationId, content } = req.body;
```

**Frontend sends** (`frontend/src/pages/Chat.jsx:66-74`):
```javascript
body: JSON.stringify({
  conversation_id: selectedConvId,      // WRONG
  workspace_id: currentWorkspaceId,    // EXTRA (not needed)
  sender_email: user?.email,           // EXTRA (backend gets from JWT)
  sender_name: user?.full_name,         // EXTRA
  content: text,
  message_type: 'text',
})
```

**Impact**: Backend will reject with "conversationId is required"

---

### Issue #3: Inconsistent API Base URL Usage

**Files affected**: `Chat.jsx`

**Problem**: Uses relative paths `/chat/...` instead of `${API}/chat/...`

**Current**:
```javascript
fetch(`/chat/conversations...`)
```

**Should be**:
```javascript
const API = import.meta.env.VITE_API_URL || '';
fetch(`${API}/chat/conversations...`)
```

**Note**: When `VITE_API_URL` is a different origin (e.g., production), relative paths will fail.

---

### Issue #4: Unused API Library

**File**: `frontend/src/lib/api.js`

**Status**: Properly implemented but not used by all components

**Correct usage example** (`CreateWorkspaceModal.jsx`):
```javascript
import api from '@/lib/api';
// ...
const ws = await api.workspaces.create({ name, description, icon });
```

**Chat.jsx uses raw fetch** instead of the `api` library.

---

## 3. WebSocket Integration ✓

### Current Implementation
- **Frontend**: `useSocket.js` connects to `VITE_API_URL`
- **Backend**: `socketServer.js` uses `socketAuthMiddleware` for JWT validation

### Integration Status
| Feature | Status |
|---------|--------|
| Connection | ✅ Working |
| Authentication | ✅ Token passed via `auth.token` |
| Presence | ✅ Heartbeat and status updates |
| Chat messages | ✅ Real-time events |
| Reconnection | ✅ Configured with retry |

---

## 4. Workspace & Tasks Integration ✓

### Workspace Routes
- **Frontend**: Uses `api.workspaces.*` correctly
- **Backend**: All CRUD endpoints implemented with RBAC

### Task Routes
- **Frontend**: Uses `api.tasks.*` correctly  
- **Backend**: Full CRUD with workspace access control

---

## 5. Security Considerations

### Current Security Features
- ✅ JWT authentication (7-day expiry)
- ✅ Rate limiting on auth endpoints
- ✅ CORS configured (`CLIENT_URL`)
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- ✅ Input validation middleware
- ✅ Password hashing with bcrypt

### Recommendations
1. Add rate limiting to more endpoints
2. Implement token refresh mechanism
3. Add CSRF protection for state-changing operations

---

## 6. Change Recommendations

### Step 1: Fix Authorization Headers in Chat.jsx

**File**: `frontend/src/pages/Chat.jsx`

```javascript
// Add helper function at top of component
function getAuthHeaders() {
  const auth = JSON.parse(localStorage.getItem('onechat_auth') || '{}');
  return {
    'Content-Type': 'application/json',
    ...(auth?.token && { Authorization: `Bearer ${auth.token}` })
  };
}

// Update queries (lines 22 and 28)
const { data: conversations = [] } = useQuery({
  queryKey: ['conversations', currentWorkspaceId],
  queryFn: () => fetch(`/chat/conversations?workspaceId=${currentWorkspaceId}`, {
    headers: getAuthHeaders()
  }).then(r => r.json()),
  enabled: !!currentWorkspaceId,
});

const { data: messages = [] } = useQuery({
  queryKey: ['messages', selectedConvId],
  queryFn: () => fetch(`/chat/messages?conversationId=${selectedConvId}`, {
    headers: getAuthHeaders()
  }).then(r => r.json()),
  enabled: !!selectedConvId,
  refetchInterval: 3000,
});
```

### Step 2: Fix Field Names in sendMessage

**File**: `frontend/src/pages/Chat.jsx` (lines 63-75)

```javascript
// Replace lines 63-75 with:
await fetch(`${API}/chat/messages`, {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify({
    conversationId: selectedConvId,
    content: text,
  })
});
```

Also remove the PATCH call to `/chat/conversations/${selectedConvId}` - backend updates `updatedAt` automatically.

### Step 3: Add API Base URL Constant

**File**: `frontend/src/pages/Chat.jsx`

```javascript
import { useOutletContext } from 'react-router-dom';
// Add at component level:
const API = import.meta.env.VITE_API_URL || '';
```

### Step 4: Optionally - Migrate to API Library

Replace raw `fetch` calls with the `api` library:

```javascript
import api from '@/lib/api';

// Then replace fetch calls:
const { data: conversations = [] } = useQuery({
  queryKey: ['conversations', currentWorkspaceId],
  queryFn: () => api.conversations.list(currentWorkspaceId),
  enabled: !!currentWorkspaceId,
});
```

---

## 7. Summary

| Category | Status |
|----------|--------|
| Authentication | ✅ Working |
| REST API (Workspaces/Tasks) | ✅ Working |
| REST API (Chat) | ⚠️ Issues Found |
| WebSocket | ✅ Working |
| Security | ✅ Good |

### Priority Fixes
1. **HIGH**: Fix missing Authorization headers in Chat.jsx
2. **HIGH**: Fix field name mismatch (`conversation_id` → `conversationId`)
3. **MEDIUM**: Add API base URL for cross-origin compatibility
4. **LOW**: Migrate to shared api.js library

---

## 8. Redis Integration

### Current Implementation

The backend uses Redis (`backend/src/config/redis.js`) for:

| Component | Usage | Status |
|-----------|-------|--------|
| `getRedis()` | General purpose caching, session data | ✅ Configured |
| `getPub()` | Pub/sub for horizontal scaling | ✅ Configured |
| `getSub()` | Pub/sub subscription | ✅ Configured |

### Redis Features Used

1. **Presence tracking** - Online user status via heartbeat
2. **Real-time messaging** - Pub/sub broadcasts chat messages across instances
3. **Health checks** - `/ready` endpoint verifies Redis connectivity
4. **Optional graceful degradation** - Redis failures don't crash the app

### Environment Variables

```
REDIS_URL=redis://127.0.0.1:6379
```

### Note

Redis is already properly integrated and tested via:
- `backend/src/health` in `app.js` (line 53-75)
- `backend/src/chat/chat.handler.js` (line 106-108) - pub for message distribution
- `backend/src/websocket/socketServer.js` - real-time features

No changes needed for Redis integration.

---

*Audit conducted using @.agent\skills\backend-architect/ methodology*
