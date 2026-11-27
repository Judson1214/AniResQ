import { describe, it, expect } from 'vitest';
import { validateFile } from '../storage.service';

describe('Client-Side Storage File Validation', () => {
  it('accepts valid JPEG, PNG, and WebP files under 5MB', () => {
    const validJpeg = new File(['a'.repeat(1024)], 'photo.jpg', { type: 'image/jpeg' });
    const validPng = new File(['b'.repeat(1024)], 'photo.png', { type: 'image/png' });
    const validWebp = new File(['c'.repeat(1024)], 'photo.webp', { type: 'image/webp' });

    expect(() => validateFile(validJpeg)).not.toThrow();
    expect(() => validateFile(validPng)).not.toThrow();
    expect(() => validateFile(validWebp)).not.toThrow();
  });

  it('rejects files exceeding the 5MB size limit', () => {
    // 5MB + 1 byte
    const oversizedFile = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversizedFile, 'size', { value: 5 * 1024 * 1024 + 1 });

    expect(() => validateFile(oversizedFile)).toThrow(/exceeds maximum allowed size of 5MB/);
  });

  it('rejects disallowed file MIME types', () => {
    const exeFile = new File(['malicious'], 'payload.exe', { type: 'application/x-msdownload' });
    const htmlFile = new File(['<h1>XSS</h1>'], 'index.html', { type: 'text/html' });
    const svgFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });

    expect(() => validateFile(exeFile)).toThrow(/invalid format/);
    expect(() => validateFile(htmlFile)).toThrow(/invalid format/);
    expect(() => validateFile(svgFile)).toThrow(/invalid format/);
  });

  it('allows custom allowedTypes such as PDF for identification documents', () => {
    const pdfDoc = new File(['%PDF-1.4'], 'id_card.pdf', { type: 'application/pdf' });

    // Fails under default image-only rules
    expect(() => validateFile(pdfDoc)).toThrow(/invalid format/);

    // Passes when application/pdf is explicitly allowed
    expect(() => validateFile(pdfDoc, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    })).not.toThrow();
  });
});
