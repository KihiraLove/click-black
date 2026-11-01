import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const destination = new URL('dist/', root);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of ['index.html', 'styles.css', 'favicon.svg', 'src', '.nojekyll']) {
  await cp(new URL(file, root), new URL(file, destination), { recursive: true });
}
console.log('Static site built in dist/ — no dependencies or server required.');
