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

  // Revert incorrect JSX replacements for Hugeicons
  // e.g. <Delete02Icon variant="Linear" size={14} ... />  -> <HugeiconsIcon icon={Delete02Icon} size={14} ... />
  // We identify them because they end in 'Icon' and start with capital letter.
  
  content = content.replace(/<([A-Z][a-zA-Z0-9_]+Icon)\s+variant="Linear"([^>]*)\/?>/g, (match, iconName, props) => {
    return `<HugeiconsIcon icon={${iconName}} strokeWidth={1.75}${props}/>`;
  });

  // What if variant was not "Linear"?
  content = content.replace(/<([A-Z][a-zA-Z0-9_]+Icon)\s+([^>]*)\/?>/g, (match, iconName, props) => {
    if (props.includes('icon=')) return match; // already a HugeiconsIcon? Wait, HugeiconsIcon ends in Icon.
    if (iconName === 'HugeiconsIcon') return match; // Ignore
    
    // Some props had variant="Bold"
    let newProps = props.replace(/variant="[^"]+"/g, '');
    return `<HugeiconsIcon icon={${iconName}} strokeWidth={1.75}${newProps}/>`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
  }
});
