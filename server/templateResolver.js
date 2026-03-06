/**
 * Shared template resolver — built-in tokens, dynamic tokens, regexp generator.
 * Used by both the bucket and mock plugins.
 */
import { randomUUID } from 'crypto';
import {
  FIRST_NAMES, LAST_NAMES, STREET_NAMES, LOREM_SENTENCES,
  EMAIL_DOMAINS, MOBILE_PREFIXES
} from './plugins/bucket-data.js';

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// ── Helpers ────────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * Normalize Polish characters for email-safe usernames.
 */
function normalizeForEmail(str) {
  const map = { 'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
                'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z' };
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ch => map[ch] || ch);
}

// ── Built-in template token generators ─────────────────────────────────────────
/**
 * Static built-in tokens. Each value is a zero-arg generator function.
 */
export const BUILTIN_TOKENS = {
  'email': () => {
    const first = normalizeForEmail(pick(FIRST_NAMES)).toLowerCase();
    const last = normalizeForEmail(pick(LAST_NAMES)).toLowerCase();
    return `${first}.${last}@${pick(EMAIL_DOMAINS)}`;
  },
  'phoneNumber': () => {
    const prefix = pick(MOBILE_PREFIXES);
    let rest = '';
    for (let i = 0; i < 7; i++) rest += String(randInt(0, 9));
    return `48${prefix}${rest}`;
  },
  'firstName': () => pick(FIRST_NAMES),
  'lastName': () => pick(LAST_NAMES),
  'location.streetName': () => pick(STREET_NAMES),
  'location.streetNr': () => {
    const nr = randInt(1, 150);
    return Math.random() < 0.15 ? `${nr}${pick(['A','B','C'])}` : String(nr);
  },
  'location.zipCode': () => {
    const a = String(randInt(0, 99)).padStart(2, '0');
    const b = String(randInt(0, 999)).padStart(3, '0');
    return `${a}-${b}`;
  },
  'location.flatNr': () => randInt(1, 200),
  'date': () => new Date().toISOString(),
  'uuid': () => randomUUID(),
  'boolean': () => Math.random() < 0.5,
  'integer': () => randInt(1, 1000),
};

// ── Dynamic / parametric tokens ────────────────────────────────────────────────
/**
 * Resolve parametric / dynamic tokens that aren't in the static map.
 * Returns { value, matched } — if matched is false the caller should fall through.
 */
export function resolveDynamicToken(token, context) {
  // {{ integer:min:max }}
  const intMatch = token.match(/^integer:(\d+):(\d+)$/);
  if (intMatch) {
    const min = parseInt(intMatch[1], 10);
    const max = parseInt(intMatch[2], 10);
    return { value: randInt(min, max), matched: true };
  }

  // {{ headers.HeaderName }}
  if (token.startsWith('headers.') && context.req) {
    const headerName = token.slice('headers.'.length);
    const val = context.req.headers[headerName.toLowerCase()];
    return { value: val !== undefined ? val : '', matched: true };
  }

  // {{ body.fieldName }}
  if (token.startsWith('body.') && context.body) {
    const fieldName = token.slice('body.'.length);
    const val = context.body[fieldName];
    return { value: val !== undefined ? val : '', matched: true };
  }

  return { value: undefined, matched: false };
}

// ── Regexp pattern generator ───────────────────────────────────────────────────
/**
 * Expand a character class body (content between [ and ]) into a string of all
 * possible characters. Supports ranges (a-z), escape sequences (\d \w \s) and
 * negation (^).
 */
function expandCharClass(cls) {
  let chars = '';
  let i = 0;
  const negate = cls[0] === '^';
  if (negate) i = 1;

  while (i < cls.length) {
    if (cls[i] === '\\' && i + 1 < cls.length) {
      const esc = cls[i + 1];
      if (esc === 'd') chars += '0123456789';
      else if (esc === 'w') chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
      else if (esc === 's') chars += ' \t';
      else chars += esc;
      i += 2;
    } else if (i + 2 < cls.length && cls[i + 1] === '-') {
      // Range: a-z, A-Z, 0-9
      const from = cls.charCodeAt(i);
      const to = cls.charCodeAt(i + 2);
      for (let c = from; c <= to; c++) chars += String.fromCharCode(c);
      i += 3;
    } else {
      chars += cls[i];
      i++;
    }
  }

  if (negate) {
    const excluded = new Set(chars);
    chars = '';
    for (let c = 33; c <= 126; c++) {
      const ch = String.fromCharCode(c);
      if (!excluded.has(ch)) chars += ch;
    }
  }

  return chars || ALPHANUMERIC_CHARS;
}

/**
 * Parse a quantifier starting at position i in string p.
 * Returns [quantifierType, charsConsumed, resolvedCount].
 */
function parseQuantifier(p, i) {
  if (i >= p.length) return [null, 0, 1];
  if (p[i] === '{') {
    const closeIdx = p.indexOf('}', i + 1);
    if (closeIdx === -1) return [null, 0, 1];
    const inner = p.slice(i + 1, closeIdx);
    const len = closeIdx - i + 1;
    if (inner.includes(',')) {
      const parts = inner.split(',');
      const min = parseInt(parts[0].trim(), 10) || 0;
      const maxStr = parts[1].trim();
      const max = maxStr === '' ? min + 4 : (parseInt(maxStr, 10) || min);
      const count = min + Math.floor(Math.random() * (max - min + 1));
      return ['{n,m}', len, count];
    } else {
      const n = parseInt(inner.trim(), 10);
      return ['{n}', len, isNaN(n) ? 1 : n];
    }
  }
  if (p[i] === '+') return ['+', 1, 1 + Math.floor(Math.random() * 4)];
  if (p[i] === '*') return ['*', 1, Math.floor(Math.random() * 4)];
  if (p[i] === '?') return ['?', 1, Math.random() < 0.5 ? 0 : 1];
  return [null, 0, 1];
}

/**
 * Generate a random string that structurally matches the given regexp pattern.
 * Supports: character classes [abc], ranges [a-z], escape sequences \d \w \s \D \W,
 * quantifiers {n} {n,m} + * ?, anchors ^ $, groups (...) with alternation |, dot.
 * @param {string} pattern - regexp pattern string (without / delimiters)
 * @returns {string}
 */
export function generateFromPattern(pattern) {
  let result = '';
  let p = pattern;
  // Strip leading/trailing anchors
  if (p.startsWith('^')) p = p.slice(1);
  if (p.endsWith('$')) p = p.slice(0, -1);

  let i = 0;
  while (i < p.length) {
    let chars = '';
    let advance = 1;

    if (p[i] === '\\' && i + 1 < p.length) {
      const esc = p[i + 1];
      advance = 2;
      if (esc === 'd') chars = '0123456789';
      else if (esc === 'D') chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      else if (esc === 'w') chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
      else if (esc === 'W') chars = '!@#$%^&*-+=';
      else if (esc === 's') chars = ' ';
      else if (esc === 'S') chars = ALPHANUMERIC_CHARS;
      else chars = esc;
    } else if (p[i] === '[') {
      const closeIdx = p.indexOf(']', i + 1);
      if (closeIdx === -1) {
        chars = '[';
      } else {
        chars = expandCharClass(p.slice(i + 1, closeIdx));
        advance = closeIdx - i + 1;
      }
    } else if (p[i] === '(') {
      // Find matching ')' handling nested parens
      let depth = 1;
      let j = i + 1;
      while (j < p.length && depth > 0) {
        if (p[j] === '(' && p[j - 1] !== '\\') depth++;
        else if (p[j] === ')' && p[j - 1] !== '\\') depth--;
        j++;
      }
      const inner = p.slice(i + 1, j - 1);
      advance = j - i;
      const [, qLen, count] = parseQuantifier(p, i + advance);
      // Handle alternation within group
      const alternatives = inner.split('|');
      for (let k = 0; k < count; k++) {
        const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
        result += generateFromPattern(alt);
      }
      i += advance + qLen;
      continue;
    } else if (p[i] === '.') {
      chars = ALPHANUMERIC_CHARS;
    } else if (p[i] === '|') {
      // Top-level alternation: treat everything before as one branch, skip rest
      break;
    } else {
      chars = p[i];
    }

    i += advance;
    const [, qLen, count] = parseQuantifier(p, i);
    i += qLen;

    if (chars.length === 0) {
      // skip
    } else if (chars.length === 1) {
      result += chars.repeat(count);
    } else {
      for (let k = 0; k < count; k++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
  }

  return result;
}

// ── Template resolver ────────────────────────────────────────────────────────────
/**
 * Recursively resolve {{ placeholder }} tokens in a template object.
 *
 * Resolution order:
 *   1. {{ :id }}                → generated resource ID
 *   2. {{ tokenName }}          → BUILTIN_TOKENS lookup (email, firstName, date, etc.)
 *   3. {{ integer:min:max }}    → parametric integer range
 *   4. {{ headers.X }}          → request header value
 *   5. {{ body.X }}             → request body field value
 *   6. {{ regexpPattern }}      → generateFromPattern() fallback
 *
 * Non-string values are passed through unchanged.
 *
 * @param {any} templateVal - value to resolve (string, object, array, or scalar)
 * @param {{ id?: string, req?: object, body?: object }} context
 * @returns {any}
 */
export function applyTemplate(templateVal, context) {
  if (templateVal === null || templateVal === undefined) return templateVal;

  if (typeof templateVal === 'string') {
    const m = templateVal.match(/^\{\{\s*(.+?)\s*\}\}$/);
    if (m) {
      const token = m[1].trim();
      // 1. Special :id token
      if (token === ':id') return context.id;
      // 2. Static built-in tokens
      if (BUILTIN_TOKENS[token]) return BUILTIN_TOKENS[token]();
      // 3-5. Dynamic / parametric tokens
      const dyn = resolveDynamicToken(token, context);
      if (dyn.matched) return dyn.value;
      // 6. Regexp pattern fallback
      return generateFromPattern(token);
    }
    return templateVal;
  }

  if (Array.isArray(templateVal)) {
    return templateVal.map(item => applyTemplate(item, context));
  }

  if (typeof templateVal === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(templateVal)) {
      result[key] = applyTemplate(val, context);
    }
    return result;
  }

  // numbers, booleans — pass through as-is
  return templateVal;
}
