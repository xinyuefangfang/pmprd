import { readFile, writeFile } from 'node:fs/promises';

const mode = process.argv[2];
if (!['annotated', 'baseline'].includes(mode)) throw new Error('Choose annotated or baseline');
for (const file of ['prd.md', 'dev-spec.md']) {
  const content = mode === 'baseline' ? '' : await readFile(new URL(`../examples/annotated/${file}`, import.meta.url));
  await writeFile(new URL(`../requirements/product/${file}`, import.meta.url), content);
}
console.log(`Demo documents: ${mode}`);
