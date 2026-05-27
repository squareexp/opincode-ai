const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Fix the broken import syntax:
  // import {
  // import { ArrowDown2 } from 'iconsax-react';
  // Collapsible...
  
  // Actually, some look like:
  // import * as React from 'react';
  // import { ArrowDown2 ...
  
  const regex = /(import\s+\{?)(\r?\nimport\s+\{[^}]+\}\s+from\s+['"]iconsax-react['"];\r?\n)/g;
  content = content.replace(regex, (match, g1, g2) => {
    return g2 + g1;
  });
  
  const regex2 = /(import\s+type\s+\{?)(\r?\nimport\s+\{[^}]+\}\s+from\s+['"]iconsax-react['"];\r?\n)/g;
  content = content.replace(regex2, (match, g1, g2) => {
    return g2 + g1;
  });

  const regex3 = /(import\s+\{?)(\r?\nimport\s+\{[^}]+\}\s+from\s+['"]@hugeicons\/core-free-icons['"];\r?\nimport\s+\{\s*HugeiconsIcon\s*\}\s+from\s+['"]@hugeicons\/react['"];\r?\n)/g;
  content = content.replace(regex3, (match, g1, g2) => {
    return g2 + g1;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
  }
});
