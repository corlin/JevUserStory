import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import HomePage from '../../app/page';

it('identifies the app as a simulated ResolveOps workspace', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { name: 'ResolveOps' })).toBeVisible();
  expect(screen.getByText('模拟商业数据')).toBeVisible();
  expect(screen.queryByText('Gateway connected')).not.toBeInTheDocument();
});
