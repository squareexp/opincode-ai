const fs = require('fs');

const file = 'src/modules/ai/components/AiStatusBarControls.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<icon variant="Linear"([^>]+)\/>/g, '<HugeiconsIcon icon={icon} strokeWidth={1.75}$1/>');
content = content.replace(/<icon variant="Linear"/g, '<HugeiconsIcon icon={icon} strokeWidth={1.75}');
content = content.replace(/<\/icon>/g, '</HugeiconsIcon>');

fs.writeFileSync(file, content);
