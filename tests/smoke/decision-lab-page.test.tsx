import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DecisionLabPage from '../../app/decision-lab/page';
import PoliciesPage from '../../app/policies/page';

afterEach(() => {
  cleanup();
});

describe('Decision Lab and Policies pages smoke test', () => {
  it('renders Decision Lab page with metrics and simulator', async () => {
    const page = await DecisionLabPage();
    render(page);

    expect(screen.getByRole('heading', { name: 'Decision Lab' })).toBeInTheDocument();
    expect(screen.getByText('策略模拟器 (Zero-cost Policy Simulator)')).toBeInTheDocument();
    expect(screen.getByText(/Pre-evaluated Baseline|Live Measured/)).toBeInTheDocument();
  });

  it('renders Policies page with version management', async () => {
    const page = await PoliciesPage();
    render(page);

    expect(screen.getByRole('heading', { name: 'Policy Repository' })).toBeInTheDocument();
    expect(screen.getByText(/当前生效/)).toBeInTheDocument();
  });
});
