// utils/json5Compat.js
// Minimal JSON5 parser covering features used in data-template.json5:
//   - /* ... */ block comments
//   - // line comments
//   - Trailing commas before } or ]

function extractDesc(text) {
  const m = text.match(/\/\*([\s\S]*?)\*\//);
  return m ? m[1].trim() : '';
}

function parse(text) {
  let s = text;
  // Strip block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments (not inside strings — good enough for this data format)
  s = s.replace(/\/\/[^\n\r]*/g, '');
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(s);
}

module.exports = { parse, extractDesc };
