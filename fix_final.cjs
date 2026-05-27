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

  content = content.replace(/typeof\s+[A-Za-z0-9_]+2/g, 'any'); // like typeof Setting2 -> any
  content = content.replace(/typeof\s+Icon/g, 'any'); // typeof Icon -> any
  
  if (content !== original) fs.writeFileSync(file, content);
});

