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

walk('./src').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace "// @ts-ignore" when it breaks JSX tags.
  // We can just remove ALL "// @ts-ignore" added recently!
  // Since I added them via autofix, I can just remove them all. They aren't necessary if the types are 'any' now.
  content = content.replace(/\/\/\s*@ts-ignore\n/g, '');

  if (content !== original) {
    fs.writeFileSync(file, content);
  }
});
