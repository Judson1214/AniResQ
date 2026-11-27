import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

const GoodChild = () => React.createElement('div', { id: 'good' }, 'Working fine');

describe('ErrorBoundary Component', () => {
  it('renders children when no error is thrown', () => {
    const instance = new ErrorBoundary({ children: React.createElement(GoodChild) });
    expect(instance.state.hasError).toBe(false);
  });

  it('updates state via getDerivedStateFromError when a child component fails', () => {
    const testError = new Error('Test crash');
    const newState = ErrorBoundary.getDerivedStateFromError(testError);

    expect(newState.hasError).toBe(true);
    expect(newState.error).toBe(testError);
  });

  it('calls onRetry callback when handleRetry is triggered', () => {
    const onRetryMock = vi.fn();
    const instance = new ErrorBoundary({ children: React.createElement(GoodChild), onRetry: onRetryMock });

    instance.handleRetry();
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });
});
