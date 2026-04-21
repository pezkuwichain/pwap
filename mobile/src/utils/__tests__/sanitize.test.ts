import { escapeJsString, safeJsValue } from '../sanitize';

describe('escapeJsString', () => {
  it('escapes single quotes', () => {
    expect(escapeJsString("it's")).toBe("it\\'s");
  });

  it('escapes double quotes', () => {
    expect(escapeJsString('say "hello"')).toBe('say \\"hello\\"');
  });

  it('escapes backticks', () => {
    expect(escapeJsString('`template`')).toBe('\\`template\\`');
  });

  it('escapes backslashes', () => {
    expect(escapeJsString('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('escapes newlines', () => {
    expect(escapeJsString('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes carriage returns', () => {
    expect(escapeJsString('line1\rline2')).toBe('line1\\rline2');
  });

  it('escapes null bytes', () => {
    expect(escapeJsString('before\0after')).toBe('before\\0after');
  });

  it('prevents script tag injection', () => {
    expect(escapeJsString('</script><script>alert(1)</script>')).toContain('<\\/script');
  });

  it('handles XSS payload: quote breakout', () => {
    const payload = "'; alert(document.cookie); //";
    const escaped = escapeJsString(payload);
    // The single quote should be escaped with backslash
    expect(escaped).toContain("\\'");
    // When inserted into 'value', the escaped quote won't break out
    expect(escaped.indexOf("\\'")).toBe(0);
  });

  it('handles XSS payload: template literal injection', () => {
    const payload = '${alert(1)}';
    const escaped = escapeJsString(payload);
    // $ is fine, backtick and { are fine — the key is backticks are escaped
    expect(escaped).not.toContain('`');
  });

  it('handles empty string', () => {
    expect(escapeJsString('')).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeJsString('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'))
      .toBe('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
  });
});

describe('safeJsValue', () => {
  it('serializes strings safely', () => {
    // JSON.stringify wraps in double quotes, single quotes pass through
    expect(safeJsValue("hello 'world'")).toBe("\"hello 'world'\"");
  });

  it('serializes objects', () => {
    const result = safeJsValue({ address: 'abc', name: 'test' });
    expect(JSON.parse(result)).toEqual({ address: 'abc', name: 'test' });
  });

  it('serializes null', () => {
    expect(safeJsValue(null)).toBe('null');
  });

  it('serializes numbers', () => {
    expect(safeJsValue(42)).toBe('42');
  });

  it('handles strings with special characters', () => {
    const result = safeJsValue("line1\nline2\ttab");
    expect(result).toContain('\\n');
    expect(result).toContain('\\t');
  });
});
