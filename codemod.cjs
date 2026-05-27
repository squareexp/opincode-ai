const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const map = {
  Alert02Icon: 'Danger',
  AlertCircleIcon: 'InfoCircle',
  ArrowDown01Icon: 'ArrowDown2',
  ArrowLeft01Icon: 'ArrowLeft2',
  ArrowRight01Icon: 'ArrowRight2',
  ArrowUp01Icon: 'ArrowUp2',
  Cancel01Icon: 'CloseCircle',
  CheckmarkCircle01Icon: 'TickCircle',
  CheckmarkSquare02Icon: 'TickSquare',
  CopyIcon: 'Copy',
  Download01Icon: 'DocumentDownload',
  Edit02Icon: 'Edit2',
  File02Icon: 'DocumentText',
  FolderGitTwoIcon: 'FolderConnection',
  FolderTreeIcon: 'Folder2',
  Globe02Icon: 'Global',
  IncognitoIcon: 'Ghost',
  Loading03Icon: 'Refresh2',
  MinusSignIcon: 'Minus',
  MoreHorizontalCircle01Icon: 'MoreCircle',
  PlusSignIcon: 'Add',
  Refresh01Icon: 'Refresh2',
  Search01Icon: 'SearchNormal',
  SearchIcon: 'SearchNormal',
  ServerStack03Icon: 'Data',
  Settings01Icon: 'Setting2',
  SquareIcon: 'Stop',
  Tick02Icon: 'TickCircle',
  UnfoldMoreIcon: 'ArrowSwapVertical'
};

const ignoreIcons = ['GithubIcon']; // Keep these from hugeicons

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
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Find hugeicons imports
  const hugeiconsRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@hugeicons\/core-free-icons['"];?/g;
  let iconsToImport = new Set();
  let keepHugeIcons = [];

  let match;
  while ((match = hugeiconsRegex.exec(originalContent)) !== null) {
    const imported = match[1].split(',').map(i => i.trim()).filter(Boolean);
    imported.forEach(i => {
      if (ignoreIcons.includes(i)) {
        keepHugeIcons.push(i);
      } else if (map[i]) {
        iconsToImport.add(map[i]);
      } else {
        // Unknown icon
        keepHugeIcons.push(i);
      }
    });
  }

  if (iconsToImport.size > 0 || keepHugeIcons.length > 0 || content.includes('@hugeicons/react')) {
    // Check if we actually need to change anything
    const originalHasHuge = content.includes('HugeiconsIcon');
    
    // Remove original hugeicons/core-free-icons import
    content = content.replace(/import\s+\{([^}]+)\}\s+from\s+['"]@hugeicons\/core-free-icons['"];?\n?/g, '');
    
    // Remove HugeiconsIcon import
    content = content.replace(/import\s+\{\s*HugeiconsIcon\s*\}\s+from\s+['"]@hugeicons\/react['"];?\n?/g, '');

    // Add new imports at top
    let importStr = '';
    if (iconsToImport.size > 0) {
      importStr += `import { ${Array.from(iconsToImport).join(', ')} } from 'iconsax-react';\n`;
    }
    
    if (keepHugeIcons.length > 0) {
      importStr += `import { ${keepHugeIcons.join(', ')} } from '@hugeicons/core-free-icons';\n`;
      importStr += `import { HugeiconsIcon } from '@hugeicons/react';\n`;
    }
    
    // Insert after the first import or at top
    if (importStr && originalHasHuge) {
      if (content.includes('import')) {
        content = content.replace(/(import.*?\n)/, `$1${importStr}`);
      } else {
        content = importStr + content;
      }
    }

    // Replace JSX usages
    const usageRegex = /<HugeiconsIcon\s+icon=\{([a-zA-Z0-9_]+)\}([^>]*)\/>/g;
    content = content.replace(usageRegex, (fullMatch, iconName, propsString) => {
      if (ignoreIcons.includes(iconName) || !map[iconName]) {
        // Keep as is
        return fullMatch;
      }
      
      const newIcon = map[iconName];
      // Clean up props String
      let newProps = propsString.replace(/\s*strokeWidth=\{[^}]+\}/g, '');
      newProps = newProps.replace(/\s*strokeWidth="[^"]+"/g, '');
      
      return `<${newIcon} variant="Linear"${newProps}/>`;
    });

    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      changedFiles++;
    }
  }
});

console.log(`Updated ${changedFiles} files.`);
