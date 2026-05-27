const fs = require('fs');
const files = [
  'src/components/ai-elements/tool.tsx',
  'src/modules/ai/components/AiChat.tsx',
  'src/modules/ai/components/AiMiniWindow.tsx',
  'src/modules/source-control/SourceControlPanel.tsx',
  'src/components/ai-elements/reasoning.tsx',
  'src/components/ai-elements/snippet.tsx',
  'src/modules/explorer/TreeRow.tsx',
  'src/modules/preview/PreviewPane.tsx',
  'src/modules/shortcuts/ShortcutsDialog.tsx',
  'src/modules/statusbar/WorkspaceEnvSelector.tsx',
  'src/settings/sections/GeneralSection.tsx'
];
files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // If we see lines starting with spaces followed by a component name and ending with a comma, 
    // and no "import {" right before them, we need to add "import {" 
    // Just looking for `  Collapsible,\n` or similar that is dangling.
    
    // Instead of regex hacking, I'll just restore "import {" before the first indented identifier.
    const regex = /(import\s+\{\s*HugeiconsIcon\s*\}\s+from\s+['"]@hugeicons\/react['"];\r?\n)(\s+[A-Z][a-zA-Z0-9_]*,\r?\n)/g;
    content = content.replace(regex, "$1import {\n$2");
    
    // Sometimes it's right after iconsax import if hugeicons was fully removed
    const regex2 = /(import\s+\{[^}]+\}\s+from\s+['"]iconsax-react['"];\r?\n)(\s+[A-Z][a-zA-Z0-9_]*,\r?\n)/g;
    content = content.replace(regex2, "$1import {\n$2");
    
    // Another variation
    const regex3 = /(import\s+\{\s*HugeiconsIcon\s*\}\s+from\s+['"]@hugeicons\/react['"];\r?\n)(\s*[a-z][a-zA-Z0-9_]*,\r?\n)/gi;
    content = content.replace(regex3, "$1import {\n$2");

    const regex4 = /(import\s+\{[^}]+\}\s+from\s+['"]iconsax-react['"];\r?\n)(\s*[a-z][a-zA-Z0-9_]*,\r?\n)/gi;
    content = content.replace(regex4, "$1import {\n$2");

    fs.writeFileSync(file, content);
  }
});
