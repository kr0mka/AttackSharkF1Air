import { copyFile, cp, mkdir } from 'node:fs/promises';

// Publish only runtime files. Research material, tests, local captures and
// optional browser dependencies never belong in the Pages artifact.
await mkdir('dist', { recursive: true });
for (const file of ['index.html', '.nojekyll', 'LICENSE']) await copyFile(file, `dist/${file}`);
await cp('src', 'dist/src', { recursive: true });
console.log('Static Pages artifact staged in dist/');
