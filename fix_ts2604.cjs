const fs = require('fs');
const execSync = require('child_process').execSync;

let output = '';
try {
  execSync('bun x tsc --noEmit', { stdio: 'pipe' });
} catch (e) {
  output = e.stdout.toString() + e.stderr.toString();
}

const lines = output.split('\n');
const filesToEdit = {};

lines.forEach(line => {
  const match = line.match(/(src\/.*?\.tsx?)\((\d+),\d+\): error (TS2604|TS2786): .*?'([^']+)'/);
  if (match) {
    const file = match[1];
    const lineNum = parseInt(match[2]) - 1;
    const err = match[3];
    const iconName = match[4]; // e.g. 'Icon', 'meta.icon', 's.icon'
    
    if (!filesToEdit[file]) {
      filesToEdit[file] = fs.readFileSync(file, 'utf8').split('\n');
    }
    
    let fileLines = filesToEdit[file];

    // the line probably looks like: `<Icon variant="Linear"` or `<meta.icon `
    // we replace `<IconName ` with `<HugeiconsIcon icon={IconName} strokeWidth={1.75} `
    // we also need to make sure the closing tag is fixed if it's not self closing.
    // However, all these are just self closing usually, but if it has variant="Linear", we can strip variant="Linear"
    
    // First, let's ensure HugeiconsIcon is imported
    if (!fileLines.some(l => l.includes('HugeiconsIcon'))) {
      fileLines.unshift(`import { HugeiconsIcon } from '@hugeicons/react';`);
    }

    const lineText = fileLines[lineNum];
    // We only replace the exact match. It's safer to use regex on the line
    const regex = new RegExp(`<${iconName.replace('.', '\\.')}\\b`);
    if (regex.test(lineText)) {
       fileLines[lineNum] = lineText.replace(regex, `<HugeiconsIcon icon={${iconName}} strokeWidth={1.75}`);
       // remove variant="Linear" if it's there
       fileLines[lineNum] = fileLines[lineNum].replace(/variant="Linear"/g, '');
    }
  }
});

for (const [file, lines] of Object.entries(filesToEdit)) {
  fs.writeFileSync(file, lines.join('\n'));
}

