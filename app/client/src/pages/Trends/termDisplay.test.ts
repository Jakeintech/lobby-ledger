import { describe, expect, it } from 'vitest';
import { termDisplay } from './termDisplay';

describe('termDisplay', () => {
  it('capitalises acronyms and brand names', () => {
    expect(termDisplay('ndaa')).toBe('NDAA');
    expect(termDisplay('tiktok')).toBe('TikTok');
    expect(termDisplay('340b')).toBe('340B');
  });

  it('leaves ordinary phrases as Gold spells them', () => {
    expect(termDisplay('tax credit')).toBe('tax credit');
    expect(termDisplay('one big beautiful bill')).toBe('one big beautiful bill');
  });

  it('fixes an acronym inside a phrase', () => {
    expect(termDisplay('pfas cleanup')).toBe('PFAS cleanup');
  });
});
