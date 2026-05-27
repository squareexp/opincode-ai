const fs = require('fs');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = require('path').join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Find all import { ... } from 'iconsax-react' and merge them
  const iconsaxImports = [];
  const regex = /import\s+\{([^}]+)\}\s+from\s+['"]iconsax-react['"];/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    match[1].split(',').forEach(i => iconsaxImports.push(i.trim()));
  }

  if (iconsaxImports.length > 0) {
    const uniqueIconsax = Array.from(new Set(iconsaxImports.filter(Boolean)));
    content = content.replace(regex, '');
    content = `import { ${uniqueIconsax.join(', ')} } from 'iconsax-react';\n` + content;
  }
  
  // Clean up duplicate HugeiconsIcon imports
  content = content.replace(/import\s+\{\s*HugeiconsIcon\s*\}\s+from\s+['"]@hugeicons\/react['"];\r?\n/g, '');
  if (original.includes('HugeiconsIcon') && !content.includes("from '@hugeicons/react'")) {
     content = `import { HugeiconsIcon } from '@hugeicons/react';\n` + content;
  }
  
  // Fix types
  content = content.replace(/Parameters<typeof\s+HugeiconsIcon>\[0\]\["icon"\]/g, 'any');
  content = content.replace(/IconSvgObject/g, 'any');
  content = content.replace(/IconSvgElement/g, 'any');
  
  // Fix `<HugeiconsIcon icon={item.icon} size={14} ...` where item.icon is now an iconsax component
  // We can just find `<HugeiconsIcon icon=\{([a-zA-Z0-9_\.]+)\}` and replace with `<$1`
  content = content.replace(/<HugeiconsIcon\s+icon=\{([a-zA-Z0-9_\.]+)\}([^>]+)\/>/g, (m, iconName, props) => {
    if (iconName === 'GithubIcon' || iconName.includes('Hugeicons')) return m;
    // Remove strokeWidth
    let newProps = props.replace(/\s*strokeWidth=\{[^}]+\}/g, '');
    newProps = newProps.replace(/\s*strokeWidth="[^"]+"/g, '');
    return `<${iconName} variant="Linear"${newProps}/>`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
  }
});
