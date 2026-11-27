import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  truncateText,
  sanitizeReturnTo,
  isSafeUrl,
} from '@/lib/utils';

describe('lib/utils helper functions and security sanitizers', () => {
  describe('sanitizeReturnTo security validation', () => {
    it('accepts safe relative paths', () => {
      expect(sanitizeReturnTo('/dashboard')).toBe('/dashboard');
      expect(sanitizeReturnTo('/rescues/123')).toBe('/rescues/123');
      expect(sanitizeReturnTo('/animals?species=DOG&page=2')).toBe('/animals?species=DOG&page=2');
      expect(sanitizeReturnTo('/profile#settings')).toBe('/profile#settings');
    });

    it('rejects hostile inputs and defaults safely to /dashboard', () => {
      // Protocol-relative URL attempts
      expect(sanitizeReturnTo('//evil.com')).toBe('/dashboard');
      expect(sanitizeReturnTo('//attacker.org/steal')).toBe('/dashboard');

      // Backslash URL attempts
      expect(sanitizeReturnTo('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeReturnTo('/\\/evil.com')).toBe('/dashboard');

      // Scheme injection (javascript:, data:, etc.)
      expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeReturnTo('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');

      // Path traversal attempts
      expect(sanitizeReturnTo('/../admin')).toBe('/dashboard');
      expect(sanitizeReturnTo('/rescues/../../etc/passwd')).toBe('/dashboard');
      expect(sanitizeReturnTo('/%2e%2e/evil')).toBe('/dashboard');
      expect(sanitizeReturnTo('/%2E%2E/evil')).toBe('/dashboard');

      // Absolute external URLs
      expect(sanitizeReturnTo('https://evil.com')).toBe('/dashboard');
      expect(sanitizeReturnTo('http://evil.com/phish')).toBe('/dashboard');

      // Empty, null, undefined, or non-string
      expect(sanitizeReturnTo('')).toBe('/dashboard');
      expect(sanitizeReturnTo('   ')).toBe('/dashboard');
      expect(sanitizeReturnTo(null)).toBe('/dashboard');
      expect(sanitizeReturnTo(undefined)).toBe('/dashboard');
      expect(sanitizeReturnTo(12345)).toBe('/dashboard');
      expect(sanitizeReturnTo({})).toBe('/dashboard');
    });
  });

  describe('isSafeUrl security validation', () => {
    it('approves safe relative and trusted URLs', () => {
      expect(isSafeUrl('/dashboard')).toBe(true);
      expect(isSafeUrl('/api/health')).toBe(true);
      expect(isSafeUrl('https://aniresq.org/about')).toBe(true);
      expect(isSafeUrl('https://example.com/photo.jpg')).toBe(true);
      expect(isSafeUrl('mailto:support@aniresq.com')).toBe(true);
      expect(isSafeUrl('http://localhost:5173/test')).toBe(true);
      expect(isSafeUrl('http://127.0.0.1:8000/api/docs')).toBe(true);
    });

    it('rejects hostile and insecure URLs', () => {
      expect(isSafeUrl('//evil.com')).toBe(false);
      expect(isSafeUrl('/\\evil.com')).toBe(false);
      expect(isSafeUrl('http://insecure-remote.com')).toBe(false);
      expect(isSafeUrl('javascript:alert(document.cookie)')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl(null)).toBe(false);
      expect(isSafeUrl(undefined)).toBe(false);
      expect(isSafeUrl({ url: 'https://evil.com' })).toBe(false);
    });
  });

  describe('formatting utilities', () => {
    it('cn combines and deduplicates tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'bg-blue-500')).toBe('px-2 py-1 bg-blue-500');
      expect(cn('p-4', 'p-2')).toBe('p-2');
      expect(cn('text-red-500', false && 'hidden', undefined, 'font-bold')).toBe('text-red-500 font-bold');
    });

    it('formatDate and formatDateTime format dates consistently', () => {
      const fixedDate = new Date('2026-06-15T10:30:00Z');
      expect(formatDate(fixedDate)).toContain('2026');
      expect(formatDateTime(fixedDate)).toContain('2026');
    });

    it('formatRelativeTime returns accurate human-readable intervals', () => {
      const now = Date.now();
      expect(formatRelativeTime(new Date(now - 30 * 1000))).toBe('Just now');
      expect(formatRelativeTime(new Date(now - 5 * 60 * 1000))).toBe('5m ago');
      expect(formatRelativeTime(new Date(now - 3 * 3600 * 1000))).toBe('3h ago');
      expect(formatRelativeTime(new Date(now - 2 * 86400 * 1000))).toBe('2d ago');
      expect(formatRelativeTime(new Date(now - 30 * 86400 * 1000))).toContain('202');
    });

    it('truncateText trims long strings with ellipsis', () => {
      expect(truncateText('Short text', 20)).toBe('Short text');
      expect(truncateText('This is a very long descriptive paragraph that should be truncated', 15)).toBe('This is a very...');
    });
  });
});
