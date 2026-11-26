import { describe, expect, it } from 'vitest';
import { focusPath, parseFocusSearch } from './routing';

describe('focus start links', () => {
  it('builds /focus?step=<id>[&minutes=<n>]', () => {
    expect(focusPath({ stepId: 'abc' })).toBe('/focus?step=abc');
    expect(focusPath({ stepId: 'abc', minutes: 5 })).toBe('/focus?step=abc&minutes=5');
  });

  it('round-trips through the parser, with string or URLSearchParams', () => {
    const path = focusPath({ stepId: '6f1c2a', minutes: 25 });
    const search = path.slice(path.indexOf('?'));
    expect(parseFocusSearch(search)).toEqual({ stepId: '6f1c2a', minutes: 25 });
    expect(parseFocusSearch(new URLSearchParams(search))).toEqual({
      stepId: '6f1c2a',
      minutes: 25,
    });
  });

  it('encodes odd ids safely', () => {
    const path = focusPath({ stepId: 'a b&c' });
    expect(parseFocusSearch(path.slice(path.indexOf('?'))).stepId).toBe('a b&c');
  });

  it('returns nulls for missing or invalid values', () => {
    expect(parseFocusSearch('')).toEqual({ stepId: null, minutes: null });
    expect(parseFocusSearch('?step=&minutes=10')).toEqual({ stepId: null, minutes: 10 });
    for (const m of ['0', '-5', '2.5', 'abc', '241', '']) {
      expect(parseFocusSearch(`?step=x&minutes=${m}`).minutes).toBeNull();
    }
    expect(parseFocusSearch('?step=x&minutes=240').minutes).toBe(240);
  });
});
