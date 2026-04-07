import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
  }),
}));

import Login from './Login';

test('login screen smoke test renders register-first auth flow', () => {
  render(<Login />);

  expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
});
