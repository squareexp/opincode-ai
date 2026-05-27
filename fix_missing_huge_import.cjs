const fs = require('fs');
const files = [
  'src/components/ai-elements/context.tsx',
  'src/modules/agents/components/AgentToast.tsx'
];
files.forEach(f => {
  if (fs.existsSync(f)) {
     let content = fs.readFileSync(f, 'utf8');
     if (!content.includes('import { HugeiconsIcon }')) {
        fs.writeFileSync(f, "import { HugeiconsIcon } from '@hugeicons/react';\n" + content);
     }
  }
});
