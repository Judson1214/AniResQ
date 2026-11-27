import { describe, it, expect } from 'vitest';
import { validateFile, uploadMultipleFiles } from '../storage.service';

const createJpegFile = (name = 'photo.jpg', extraBytes = []) => {
  return new File([new Uint8Array([0xFF, 0xD8, 0xFF, ...extraBytes])], name, { type: 'image/jpeg' });
};

const createPngFile = (name = 'photo.png') => {
  return new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D])], name, { type: 'image/png' });
};

const createWebpFile = (name = 'photo.webp') => {
  return new File([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])], name, { type: 'image/webp' });
};

const createPdfFile = (name = 'id_card.pdf') => {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC7, 0xEC])], name, { type: 'application/pdf' });
};

describe('Client-Side Storage File Validation', () => {
  it('accepts valid JPEG, PNG, and WebP files under 5MB', async () => {
    const validJpeg = createJpegFile('photo.jpg', new Array(100).fill(1));
    const validPng = createPngFile('photo.png');
    const validWebp = createWebpFile('photo.webp');

    await expect(validateFile(validJpeg)).resolves.toBe(true);
    await expect(validateFile(validPng)).resolves.toBe(true);
    await expect(validateFile(validWebp)).resolves.toBe(true);
  });

  it('rejects zero-byte empty files', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    await expect(validateFile(emptyFile)).rejects.toThrow(/empty \(0 bytes\)/);
  });

  it('rejects files exceeding the 5MB size limit', async () => {
    const oversizedFile = createJpegFile('huge.jpg');
    Object.defineProperty(oversizedFile, 'size', { value: 5 * 1024 * 1024 + 1 });

    await expect(validateFile(oversizedFile)).rejects.toThrow(/exceeds maximum allowed size of 5MB/);
  });

  it('rejects disallowed file MIME types', async () => {
    const exeFile = new File([new Uint8Array([0x4D, 0x5A])], 'payload.exe', { type: 'application/x-msdownload' });
    const htmlFile = new File(['<h1>XSS</h1>'], 'index.html', { type: 'text/html' });
    const svgFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });

    await expect(validateFile(exeFile)).rejects.toThrow(/invalid format/);
    await expect(validateFile(htmlFile)).rejects.toThrow(/invalid format/);
    await expect(validateFile(svgFile)).rejects.toThrow(/invalid format/);
  });

  it('rejects double extensions like photo.php.jpg', async () => {
    const doubleExtFile = createJpegFile('photo.php.jpg');
    await expect(validateFile(doubleExtFile)).rejects.toThrow(/multiple extensions/);

    const evilPng = createPngFile('trojan.exe.png');
    await expect(validateFile(evilPng)).rejects.toThrow(/multiple extensions/);
  });

  it('rejects files without an extension', async () => {
    const noExt = createJpegFile('photofile');
    await expect(validateFile(noExt)).rejects.toThrow(/missing a file extension/);
  });

  it('rejects extension mismatching the declared MIME type', async () => {
    const mismatched = new File([new Uint8Array([0xFF, 0xD8, 0xFF])], 'photo.png', { type: 'image/jpeg' });
    await expect(validateFile(mismatched)).rejects.toThrow(/does not match declared MIME type/);
  });

  it('rejects files with invalid magic bytes / header signatures', async () => {
    // Declared JPEG but text bytes
    const fakeJpeg = new File(['fake-text-header-not-jpeg'], 'fake.jpg', { type: 'image/jpeg' });
    await expect(validateFile(fakeJpeg)).rejects.toThrow(/valid JPEG header signatures/);

    // Declared PNG but JPEG bytes
    const fakePng = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0x00])], 'fake.png', { type: 'image/png' });
    await expect(validateFile(fakePng)).rejects.toThrow(/valid PNG header signatures/);

    // Declared WEBP but random bytes
    const fakeWebp = new File([new Uint8Array(12).fill(0)], 'fake.webp', { type: 'image/webp' });
    await expect(validateFile(fakeWebp)).rejects.toThrow(/valid WEBP header signatures/);

    // Declared PDF but random bytes
    const fakePdf = new File(['not-a-pdf'], 'fake.pdf', { type: 'application/pdf' });
    await expect(validateFile(fakePdf, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    })).rejects.toThrow(/valid PDF header signatures/);
  });

  it('allows custom allowedTypes such as PDF for identification documents when signature matches', async () => {
    const pdfDoc = createPdfFile('id_card.pdf');

    // Fails under default image-only rules
    await expect(validateFile(pdfDoc)).rejects.toThrow(/invalid format/);

    // Passes when application/pdf is explicitly allowed
    await expect(validateFile(pdfDoc, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    })).resolves.toBe(true);
  });

  it('caps file uploads to a maximum of 5 files', async () => {
    const files = [
      createJpegFile('f1.jpg'),
      createJpegFile('f2.jpg'),
      createJpegFile('f3.jpg'),
      createJpegFile('f4.jpg'),
      createJpegFile('f5.jpg'),
      createJpegFile('f6.jpg'),
    ];

    await expect(uploadMultipleFiles('test', files)).rejects.toThrow(/Maximum 5 files allowed per upload/);
  });
});
