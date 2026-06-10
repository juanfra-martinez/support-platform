import { HumanizePipe } from './humanize.pipe';

describe('HumanizePipe', () => {
  const pipe = new HumanizePipe();

  it('converts an enum token to a readable label', () => {
    expect(pipe.transform('IN_PROGRESS')).toBe('In progress');
  });

  it('handles a single-word token', () => {
    expect(pipe.transform('OPEN')).toBe('Open');
  });

  it('returns an empty string for nullish input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
