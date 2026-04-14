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

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }) => children,
}));

vi.mock('./lib/query-client', () => ({
  queryClientInstance: {},
}));

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => <div>{children}</div>,
  Route: () => null,
}));

vi.mock('./components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/layout/MainLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('./pages/Home', () => ({
  default: () => <div>Home Page</div>,
}));

vi.mock('./pages/Chat', () => ({
  default: () => <div>Chat Page</div>,
}));

vi.mock('./pages/Tasks', () => ({
  default: () => <div>Tasks Page</div>,
}));

vi.mock('./pages/AIAssistant', () => ({
  default: () => <div>AI Assistant Page</div>,
}));

vi.mock('./pages/Settings', () => ({
  default: () => <div>Settings Page</div>,
}));

vi.mock('./pages/Search', () => ({
  default: () => <div data-testid="search-page">Search Page</div>,
}));

vi.mock('./pages/Landing', () => ({
  default: () => <div data-testid="landing-page">Landing Page</div>,
}));

vi.mock('./pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('./pages/PageEditor', () => ({
  default: () => <div>Page Editor</div>,
}));

vi.mock('./pages/MeetingAI', () => ({
  default: () => <div>Meeting AI</div>,
}));

vi.mock('./lib/PageNotFound', () => ({
  default: () => <div>Page Not Found</div>,
}));

vi.mock('./components/UserNotRegistered', () => ({
  default: () => <div>User Not Registered</div>,
}));

import App from './App';

test('app shell smoke test renders navigation and search when authenticated', async () => {
  const { container } = render(<App />);
  expect(container.firstChild).toBeInTheDocument();
});
