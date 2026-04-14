# OneChat Version 2.0 - Improvements & Notion-Like Features

## Current State Summary (v1.0)

OneChat v1.0 provides a functional MVP with:
- JWT authentication
- Real-time chat with Socket.IO
- Collaborative documents with revision-aware sync
- Workspace/page management
- Role-based permissions
- Task management
- AI assistant (basic)
- Presence and notifications

---

## 1. Critical Improvements

### 1.1 Editor Upgrade (High Priority)
**Current:** Basic textarea-based editor  
**Recommended:**
- Integrate **Tiptap** or **ProseMirror** for block-based editing
- Support block types: paragraph, heading (H1-H3), checklist, toggle, code, quote, callout, image
- Add slash commands (`/` menu) for quick block insertion
- Implement drag-and-drop block reordering

### 1.2 CRDT Real-Time Sync (High Priority)
**Current:** Last-write-wins with revision-aware merge  
**Recommended:**
- Implement **Yjs** for conflict-free collaborative editing
- Use `y-websocket` or custom Socket.IO adapter
- Benefits: no edit conflicts, offline support, automatic merge

### 1.3 Nested Page Hierarchy (High Priority)
**Current:** Flat page structure  
**Recommended:**
- Add `parentId` field to Page model for tree structure
- Support unlimited nesting levels
- Add page icons and covers (Notion-style)
- Implement page templates

### 1.4 Comments & Threads (Medium Priority)
**Current:** No commenting system  
**Recommended:**
- Inline comments on document blocks
- Thread replies
- @mentions with notifications
- Resolve/reopen comment threads

---

## 2. Notion-Like Features

### 2.1 Database Pages
| Feature | Description |
| --- | --- |
| Database tables | Create pages as databases with custom properties |
| Property types | Text, number, date, select, multi-select, checkbox, relation, formula |
| Views | Table, board (Kanban), gallery, calendar, list views |
| Filtering | Filter by any property |
| Sorting | Sort by any property |
| Relations | Link records between databases |

**Implementation:**
```javascript
// Page model extension
{
  type: 'doc' | 'database',
  database: {
    properties: {
      fieldName: { type: 'text' | 'number' | 'date' | 'select' | ... }
    },
    views: [
      { id, name, type, filter, sort }
    ],
    rows: [{ id, fields: { ... } }]
  }
}
```

### 2.2 Linked Knowledge
| Feature | Description |
| --- | --- |
| [[Page Links]] | Create links to other pages with autocomplete |
| Backlinks | Show all pages that link to current page |
| Page mentions | Reference pages in chat, tasks, comments |
| Quick finder | `[[` to search and link pages instantly |

### 2.3 Rich Media Support
| Feature | Description |
| --- | --- |
| Image upload | Drag-drop, paste, embed URLs |
| Video embed | YouTube, Vimeo support |
| Code blocks | Syntax highlighting with language selection |
| Tables | Markdown table syntax or block-based |
| LaTeX/Math | KaTeX or MathJax for math equations |

### 2.4 Templates
| Feature | Description |
| --- | --- |
| Page templates | Pre-defined page structures |
| Template gallery | Starter templates (meeting notes, project tracker, wiki) |
| Quick create | `Ctrl+Alt+N` for template picker |

---

## 3. Granola/AI Features

### 3.1 Meeting Intelligence
| Feature | Description |
| --- | --- |
| Meeting notes template | Structured meeting capture (agenda, attendees, notes, action items) |
| AI summarization | Auto-summarize meeting after completion |
| Decision tracking | Mark decisions and link to meeting |
| Action extraction | Auto-create tasks from meeting notes |

### 3.2 AI Writing Assistant
| Feature | Description |
| --- | --- |
| AI expand | Generate content from bullet points |
| AI rewrite | Improve writing clarity/style |
| AI summarize | Condense long documents |
| AI find actions | Extract tasks from any content |
| AI Q&A | Ask questions about workspace content |

### 3.3 Smart Search
| Feature | Description |
| --- | --- |
| Semantic search | Understand intent, not just keywords |
| AI-powered answers | Direct answers from knowledge base |
| Search filters | Filter by type, date, author, workspace |
| Recent searches | Quick access to past queries |

---

## 4. Collaboration Enhancements

### 4.1 Multiplayer Features
| Feature | Description |
| --- | --- |
| Real-time cursors | See where others are editing |
| Selection highlights | See what others have selected |
| User presence indicators | Show who is viewing/editing |
| Follow mode | Lock view to another user's cursor |

### 4.2 Permissions & Sharing
| Feature | Description |
| --- | --- |
| Public sharing | Share pages via public link |
| Guest access | External collaborators without account |
| Workspace-level roles | owner/admin/editor/commenter/viewer |
| Page-level overrides | Override workspace role per page |

### 4.3 Version History
| Feature | Description |
| --- | --- |
| Version snapshots | Auto-save versions periodically |
| Version timeline | Visual history timeline |
| Restore versions | Revert to any previous version |
| Compare versions | Side-by-side diff view |

---

## 5. User Experience Improvements

### 5.1 Navigation & Organization
| Feature | Description |
| --- | --- |
| Sidebar navigation | Collapsible sidebar with workspace tree |
| Favorites | Star frequently used pages |
| Recent | Quick access to recently viewed |
| Breadcrumbs | Navigate page hierarchy |
| Command palette | `Ctrl+K` for quick actions |

### 5.2 Keyboard Shortcuts
| Shortcut | Action |
| --- | --- |
| `Ctrl+S` | Save/ sync |
| `Ctrl+Shift+L` | Toggle sidebar |
| `Ctrl+[` | Navigate back |
| `Ctrl+]` | Navigate forward |
| `Ctrl+Shift+K` | Quick search |
| `/` | Open slash command menu |

### 5.3 Notifications & Activity
| Feature | Description |
| --- | --- |
| Activity feed | Stream of workspace changes |
| @mentions | Tag users in any content |
| Email notifications | Optional email digests |
| Notification preferences | Customize by type |

---

## 6. Technical Improvements

### 6.1 Code Quality
| Improvement | Description |
| --- | --- |
| Zod validation | Add request body validation |
| Error standardization | Unified error response format |
| Structured logging | Pino/Winston for logging |
| Rate limiting | Protect API endpoints |

### 6.2 Testing
| Test Level | Coverage Target |
| --- | --- |
| Unit tests | Auth, permissions, services (70%) |
| Integration | API routes, socket events |
| E2E | Login, create doc, collaborate |

### 6.3 Performance
| Optimization | Description |
| --- | --- |
| Redis optimization | Replace KEYS with SCAN for presence |
| Pagination | Cursor-based for large lists |
| Optimistic updates | Immediate UI feedback |
| Code splitting | Lazy load routes |

## 7. Feature Priority Matrix

| Feature | Priority | Effort | Impact |
| --- | --- | --- | --- |
| Tiptap Editor | P0 | M | High |
| Yjs CRDT | P0 | L | High |
| Nested Pages | P0 | S | High |
| Database Tables | P1 | L | Medium |
| Comments | P1 | M | Medium |
| Templates | P1 | S | Medium |
| AI Expand/Rewrite | P1 | M | Medium |
| Version History | P2 | M | Medium |
| Linked Knowledge | P2 | M | Low |
| Public Sharing | P2 | L | Low |

*Effort: S=Small, M=Medium, L=Large*  
*Impact: Low, Medium, High*

---

## 8. Migration Path

### Phase 1: Editor Foundation
1. Integrate Tiptap editor
2. Add slash commands and block types
3. Migrate existing documents to new format

### Phase 2: Real-Time Sync
1. Add Yjs provider over Socket.IO
2. Implement awareness protocol (cursors)
3. Handle offline/online sync

### Phase 3: Knowledge Features
1. Database tables with views
2. Linked pages with backlinks
3. Templates system
 
### Phase 4: AI Enhancement
1. Streaming AI responses
2. Expand/rewrite/summarize
3. Smart search

---

## 9. Backward Compatibility

All v1.0 features must remain functional:
- Existing chat messages preserved
- Current workspace/page structure maintained
- API contracts unchanged (extend only)
- JWT auth continues to work

---

## 10. Version 2.0 Roadmap

| Month | Focus |
| --- | --- |
| Month 1 | Tiptap editor, block types, slash commands |
| Month 2 | Yjs CRDT, cursors, presence |
| Month 3 | Nested pages, database tables, templates |
| Month 4 | Comments, mentions, version history |
| Month 5 | AI enhancements, smart search |
| Month 6 | Polish, performance, mobile responsive |

---

*Document Version: 2.0*  
*Last Updated: 2026-04-05*
