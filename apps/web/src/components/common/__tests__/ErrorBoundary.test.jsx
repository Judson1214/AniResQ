import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const GoodChild = () => React.createElement('div', { id: 'good' }, 'Working fine');
const BadChild = () => {
  throw new Error('Test crash in component');
};

describe('ErrorBoundary Component', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Working fine')).toBeInTheDocument();
  });

  it('renders fallback alert and handles retry when an error occurs', () => {
    const onRetryMock = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary onRetry={onRetryMock} title="Custom failure title">
        <BadChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Custom failure title')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('renders custom fallback element if provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>Custom Error View</div>}>
        <BadChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Error View')).toBeInTheDocument();
    spy.mockRestore();
  });
});
