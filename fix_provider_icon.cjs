const fs = require('fs');

const files = [
  'src/settings/sections/ModelsSection.tsx',
  'src/settings/components/ProviderKeyCard.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Example line: <HugeiconsIcon icon={ProviderIcon} strokeWidth={1.75}provider={provider.id} size={15} />
  // Example 2: <HugeiconsIcon icon={ProviderIcon} strokeWidth={1.75} provider={provider.id} size={15} />
  
  content = content.replace(/<HugeiconsIcon\s+icon=\{ProviderIcon\}\s+strokeWidth=\{1\.75\}(.*?)\/>/g, (match, p1) => {
    // Add a space before provider if missing
    let rest = p1;
    if (rest.startsWith('provider=')) {
      rest = ' ' + rest;
    }
    return `<ProviderIcon${rest}/>`;
  });

  fs.writeFileSync(file, content);
});

