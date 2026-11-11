import { constants, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const paths = ['.env', 'apps/web/.env', 'apps/api/.env'];

for (const path of paths) {
  const destination = new URL(`../${path}`, import.meta.url);

  try {
    await copyFile(new URL(`${destination.href}.example`), destination, constants.COPYFILE_EXCL);
    console.log(`Criado: ${fileURLToPath(destination)}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Mantido: ${fileURLToPath(destination)}`);
  }
}
