import { describe, it, expect } from 'vitest';
import { sanitizeReturnTo, isSafeUrl } from '@/lib/utils';

describe('Session & URL Sanitization Security', () => {
  describe('sanitizeReturnTo', () => {
    it('preserves valid internal relative paths', () => {
      expect(sanitizeReturnTo('/dashboard')).toBe('/dashboard');
      expect(sanitizeReturnTo('/rescues/123')).toBe('/rescues/123');
      expect(sanitizeReturnTo('/animals?species=DOG')).toBe('/animals?species=DOG');
      expect(sanitizeReturnTo('/my-applications#tab-1')).toBe('/my-applications#tab-1');
    });

    it('falls back to default /dashboard when input is empty or null', () => {
      expect(sanitizeReturnTo(null)).toBe('/dashboard');
      expect(sanitizeReturnTo(undefined)).toBe('/dashboard');
      expect(sanitizeReturnTo('')).toBe('/dashboard');
      expect(sanitizeReturnTo('   ')).toBe('/dashboard');
    });

    it('blocks protocol-relative URLs (//evil.com)', () => {
      expect(sanitizeReturnTo('//evil.com')).toBe('/dashboard');
      expect(sanitizeReturnTo('//evil.com/phishing')).toBe('/dashboard');
      expect(sanitizeReturnTo('///evil.com')).toBe('/dashboard');
    });

    it('blocks absolute URLs with schemes (http, https, ftp)', () => {
      expect(sanitizeReturnTo('https://evil.com')).toBe('/dashboard');
      expect(sanitizeReturnTo('http://evil.com/login')).toBe('/dashboard');
      expect(sanitizeReturnTo('ftp://evil.com')).toBe('/dashboard');
    });

    it('blocks javascript: and data: pseudo-protocols', () => {
      expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeReturnTo('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
    });

    it('blocks backslash evasion attempts (/\\evil.com)', () => {
      expect(sanitizeReturnTo('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeReturnTo('\\evil.com')).toBe('/dashboard');
    });

    it('blocks path traversal outside root (/../../etc/passwd)', () => {
      expect(sanitizeReturnTo('/../../etc/passwd')).toBe('/dashboard');
      expect(sanitizeReturnTo('/rescues/../..')).toBe('/dashboard');
    });
  });

  describe('isSafeUrl', () => {
    it('allows valid safe URLs', () => {
      expect(isSafeUrl('/dashboard')).toBe(true);
      expect(isSafeUrl('https://aniresq.org')).toBe(true);
      expect(isSafeUrl('http://localhost:3000')).toBe(true);
    });

    it('rejects unsafe schemes and malicious payloads', () => {
      expect(isSafeUrl('javascript:void(0)')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isSafeUrl('//evil.com')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl(null)).toBe(false);
    });
  });
});
