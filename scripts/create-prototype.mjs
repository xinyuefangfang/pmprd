import { cp, lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = process.argv[2];
if (!destination || process.argv.length !== 3) {
  console.error('Usage: node create-prototype.mjs <new-directory>');
  process.exit(1);
}
const target = path.resolve(destination);
try {
  await lstat(target);
  console.error(`Destination already exists; nothing changed: ${target}`);
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const source = fileURLToPath(new URL('../assets/template/', import.meta.url));
await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true, errorOnExist: true, force: false });
console.log(`Created prototype: ${target}`);
console.log('Next: npm install, then npm run dev -- --host 127.0.0.1 --port 7790');
