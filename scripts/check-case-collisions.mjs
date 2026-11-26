// Fails when two tracked files in the same folder have names that differ only by letter case
// (ignoring a .ts/.tsx/.js/.jsx extension), e.g. `whatNow.ts` and `WhatNow.tsx`. Such pairs
// work on Linux but break imports on Windows and macOS, where file names are case-insensitive.
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const seen = new Map();
const problems = [];
for (const file of files) {
  const key = file.toLowerCase().replace(/\.(tsx?|jsx?)$/, '');
  const other = seen.get(key);
  if (other && other !== file) problems.push(`${other}  <->  ${file}`);
  else seen.set(key, file);
}
if (problems.length) {
  console.error('case-collisions: these files clash on case-insensitive file systems:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('case-collisions: ok');
