// Fails when code uses physical left/right styles instead of logical ones (RTL support).
// Tailwind: use ps/pe, ms/me, start/end, text-start/end, border-s/e, rounded-s/e.
// CSS: use margin-inline-start, inset-inline-end, text-align: start, ...
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TW =
  /(?<=["'`\s{:])-?(?:[a-z-]+:)*(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-[lr]|rounded-(?:tl|tr|bl|br)|scroll-[mp][lr])-[\w[\].\-/%]+|(?<=["'`\s{:])(?:[a-z-]+:)*(?:text-left|text-right|float-left|float-right|border-[lr]|rounded-[lr])(?=["'`\s}])/g;
const CSS =
  /\b(?:margin|padding|border)-(?:left|right)\b|(?<![\w-])(?:left|right)\s*:|text-align:\s*(?:left|right)|float:\s*(?:left|right)/g;

const problems = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) scan(path, TW);
    else if (name.endsWith('.css')) scan(path, CSS);
  }
}
function scan(path, re) {
  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const m of line.matchAll(re)) problems.push(`${path}:${i + 1}: ${m[0].trim()}`);
    });
}
walk('src');
if (problems.length) {
  console.error(
    'Physical left/right styles found (use logical properties for RTL):\n' + problems.join('\n'),
  );
  process.exit(1);
}
console.log('logical-css: ok');
