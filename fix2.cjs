const fs = require('fs');
const files = [
  'src/components/ai-elements/tool.tsx',
  'src/modules/ai/components/AiChat.tsx',
  'src/modules/ai/components/AiMiniWindow.tsx',
  'src/modules/source-control/SourceControlPanel.tsx'
];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import\s*\{\s*import\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"]);/g, (match, p1, p2) => {
    return `import { ${p1} } from ${p2};`;
  });
  // Also handle Iconsax ones if they were injected wrong
  content = content.replace(/import\s*\{\s*import\s+\{([^}]+)\}\s+from\s+['"]iconsax-react['"];/g, (match, p1) => {
    return `import { ${p1} } from 'iconsax-react';`;
  });
  
  // Actually, wait, let's just use regex to remove "import {" if it is immediately followed by "import {"
  content = content.replace(/import\s*\{\s*import\s+\{/g, 'import {');
  
  fs.writeFileSync(file, content);
});
