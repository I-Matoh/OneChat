import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
  }),
}));

vi.mock('../components/ui/animated-sign-in', () => ({
  default: function MockAnimatedSignIn({ initialMode }) {
    return (
      <div data-testid="animated-sign-in">
        <h1>{initialMode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
        <button>{initialMode === 'register' ? 'Create account' : 'Sign in'}</button>
        <label htmlFor="email">Email Address</label>
        <input id="email" type="email" name="email" />
      </div>
    );
  },
}));

import Login from './Login';

test('login screen smoke test renders register-first auth flow', () => {
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Login />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
});
