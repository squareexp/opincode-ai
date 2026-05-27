const fs = require('fs');
const execSync = require('child_process').execSync;

try {
  execSync('bun x tsc --noEmit', { stdio: 'pipe' });
} catch (e) {
  const output = e.stdout.toString() + e.stderr.toString();
  const missingImports = {};

  const lines = output.split('\n');
  lines.forEach(line => {
    const match = line.match(/(src\/.*?\.tsx?)\(\d+,\d+\): error TS2304: Cannot find name '([A-Za-z0-9_]+)'\./);
    if (match) {
      const file = match[1];
      const icon = match[2];
      if (icon.endsWith('Icon') && icon !== 'HugeiconsIcon') {
        if (!missingImports[file]) missingImports[file] = new Set();
        missingImports[file].add(icon);
      }
    }
  });

  for (const [file, icons] of Object.entries(missingImports)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Some icons are actually in our map but we didn't replace them properly because they were used as variables.
    // Let's replace the mapped ones with their Iconsax equivalents directly in the text!
    
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

    let iconsToImportIconsax = new Set();
    let iconsToImportHuge = new Set();

    icons.forEach(icon => {
      if (map[icon]) {
        // Replace in content
        const regex = new RegExp(icon, 'g');
        content = content.replace(regex, map[icon]);
        iconsToImportIconsax.add(map[icon]);
      } else {
        iconsToImportHuge.add(icon);
      }
    });

    if (iconsToImportIconsax.size > 0) {
      const isax = Array.from(iconsToImportIconsax).join(', ');
      // insert Iconsax import safely
      content = `import { ${isax} } from 'iconsax-react';\n` + content;
    }

    if (iconsToImportHuge.size > 0) {
      const hicons = Array.from(iconsToImportHuge).join(', ');
      content = `import { ${hicons} } from '@hugeicons/core-free-icons';\nimport { HugeiconsIcon } from '@hugeicons/react';\n` + content;
    }

    fs.writeFileSync(file, content);
  }
}
