// _patch_intro.js — Replaces _getLineup + createMatchIntroVideo in video_generator.js
// Usage: node _patch_intro.js

const fs   = require('fs');
const path = require('path');

const srcFile  = path.join(__dirname, 'video_generator.js');
const newFnFile = path.join(__dirname, '_new_intro_fn.js');

const src    = fs.readFileSync(srcFile, 'utf8');
const newFn  = fs.readFileSync(newFnFile, 'utf8');
const lines  = src.split('\n');

// Find start: the /** that opens the createMatchIntroVideo JSDoc
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('createMatchIntroVideo —')) {
    // Walk back to find the opening /**
    for (let j = i; j >= Math.max(0, i - 4); j--) {
      if (lines[j].trimEnd() === '/**' || lines[j].trimEnd() === '/**\r') {
        startIdx = j;
        break;
      }
    }
    if (startIdx >= 0) break;
  }
}

// Find end: the /** that opens the createShortClip JSDoc
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('createShortClip —')) {
    for (let j = i; j >= Math.max(0, i - 4); j--) {
      if (lines[j].trimEnd() === '/**' || lines[j].trimEnd() === '/**\r') {
        endIdx = j;
        break;
      }
    }
    if (endIdx >= 0) break;
  }
}

if (startIdx < 0) { console.error('ERROR: Could not find createMatchIntroVideo JSDoc start'); process.exit(1); }
if (endIdx   < 0) { console.error('ERROR: Could not find createShortClip JSDoc start');      process.exit(1); }
if (endIdx <= startIdx) { console.error('ERROR: endIdx <= startIdx:', endIdx, startIdx);      process.exit(1); }

console.log(`Replacing lines ${startIdx + 1}–${endIdx} (${endIdx - startIdx} lines) with new function...`);

const before  = lines.slice(0, startIdx);
const after   = lines.slice(endIdx);
const newLines = newFn.split('\n');

// Ensure clean separation
const result = [...before, ...newLines, '', ...after].join('\n');
fs.writeFileSync(srcFile, result, 'utf8');
console.log(`Done. Total lines: ${result.split('\n').length}`);
