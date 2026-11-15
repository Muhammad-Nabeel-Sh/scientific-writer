import { describe, expect, it } from 'vitest';
import { detectDir } from '$lib/bidi';
import { renderDocument } from '$lib/markdown';

describe('detectDir', () => {
  it('uses the first strong letter', () => {
    expect(detectDir('مرحبا')).toBe('rtl');
    expect(detectDir('Hello')).toBe('ltr');
    expect(detectDir('123 — مرحبا')).toBe('rtl');
    expect(detectDir('123 — Hello')).toBe('ltr');
    expect(detectDir('Hello مرحبا')).toBe('ltr');
    expect(detectDir('مرحبا Hello')).toBe('rtl');
  });

  it('ignores digits, punctuation, marks and empty text', () => {
    expect(detectDir('12345')).toBe('ltr');
    expect(detectDir('١٢٣٤٥')).toBe('ltr');
    expect(detectDir('— … !')).toBe('ltr');
    expect(detectDir('')).toBe('ltr');
  });

  it('recognizes Arabic presentation forms and Arabic math letters', () => {
    expect(detectDir('ﻻ')).toBe('rtl');
    expect(detectDir('\u{1EE00}')).toBe('rtl');
  });
});

describe('list and table direction', () => {
  it('uses the first strong item/cell for lists', () => {
    expect(renderDocument('- عنصر\n- آخر').html).toContain('<ul dir="rtl">');
    expect(renderDocument('- item\n- another').html).toContain('<ul dir="ltr">');
    expect(renderDocument('- English\n- عنصر').html).toContain('<ul dir="ltr">');
    expect(renderDocument('- عنصر\n- English').html).toContain('<ul dir="rtl">');
  });

  it('uses the first strong cell for tables', () => {
    const en = renderDocument('| English | عنصر |\n|---|---|\n| a | ب |').html;
    expect(en).toContain('<table dir="ltr">');
    const ar = renderDocument('| عنصر | English |\n|---|---|\n| ب | a |').html;
    expect(ar).toContain('<table dir="rtl">');
  });
});
