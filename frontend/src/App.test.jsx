import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Ada' },
    token: 'token-1',
    loading: false,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('./hooks/useApi', () => ({
  useApi: () => ({
    apiFetch: vi.fn(async (url) => {
      if (url === '/chat/conversations') return [];
      if (url === '/docs') return [];
      if (url === '/workspaces') return [{ _id: 'ws-1', name: 'Product' }];
      if (url.startsWith('/activity')) return [];
      if (url.startsWith('/search')) {
        return { results: { workspaces: [], pages: [], documents: [], conversations: [] } };
      }
      return [];
    }),
  }),
}));

vi.mock('./hooks/useSocket', () => ({
  useSocket: () => ({ connected: true }),
  useSocketEvent: () => {},
  getSocket: () => ({ on: vi.fn(), off: vi.fn() }),
}));

vi.mock('./pages/HomeScreen', () => ({
  default: () => <div>Home Screen Stub</div>,
}));

vi.mock('./pages/Chat', () => ({
  default: () => <div>Chat Stub</div>,
}));

vi.mock('./pages/Editor', () => ({
  default: () => <div>Editor Stub</div>,
}));

vi.mock('./pages/Workspace', () => ({
  default: () => <div>Workspace Stub</div>,
}));

vi.mock('./components/NotificationBell', () => ({
  default: () => <div>Notifications</div>,
}));

vi.mock('./components/NewConvModal', () => ({
  default: () => <div>New Conversation Modal</div>,
}));

import { AppShell } from './App';

test('app shell smoke test renders navigation and search when authenticated', async () => {
  render(<AppShell />);

  expect(screen.getByText(/onechat/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /messages/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /channels/i })).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/search conversations, files, or people/i)).toBeInTheDocument();
  expect(await screen.findByText(/home screen stub/i)).toBeInTheDocument();
});
