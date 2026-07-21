/*
 * Ricopia Shepherd.js da node_modules a app/js/vendor/.
 *
 * Motivo per cui Shepherd e' self-hostato e non preso da CDN: i pacchetti desktop
 * (Electron, origine app://) e Android (Capacitor, webview locale) girano senza rete
 * garantita. Una <script src="https://cdn..."> li' significa tour guidato rotto offline,
 * piu' una dipendenza da terzi nella CSP.
 *
 * IMPORTANTE: la versione va tenuta a 11.x. Il ramo 14 di Shepherd non pubblica piu' un
 * build UMD (solo ESM/CJS), quindi il classico <script src> smetterebbe di funzionare e
 * andrebbe riscritto tutto tutorial.js a moduli.
 *
 * Uso:  npm run vendor:shepherd
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'node_modules', 'shepherd.js');
const DEST = path.join(ROOT, 'app', 'js', 'vendor');

const FILES = [
  ['dist/js/shepherd.min.js', 'shepherd.min.js'],
  ['dist/css/shepherd.css', 'shepherd.css'],
  ['LICENSE', 'shepherd.LICENSE.txt']
];

async function main() {
  let version = 'sconosciuta';
  try {
    version = JSON.parse(await fs.readFile(path.join(SRC, 'package.json'), 'utf8')).version;
  } catch {
    console.error('shepherd.js non trovato in node_modules. Lancia prima: npm install');
    process.exit(1);
  }

  if (!version.startsWith('11.')) {
    console.error(
      `Versione installata: ${version}. Serve la 11.x (dalla 12 in poi non c'e' piu' il build UMD\n` +
      `che index.html carica con <script src>). Correggi la dipendenza in package.json.`
    );
    process.exit(1);
  }

  await fs.mkdir(DEST, { recursive: true });
  for (const [from, to] of FILES) {
    try {
      await fs.copyFile(path.join(SRC, from), path.join(DEST, to));
      console.log(`  ${to}`);
    } catch (err) {
      console.warn(`  saltato ${to}: ${err.message}`);
    }
  }
  console.log(`\nShepherd ${version} copiato in app/js/vendor/.`);
  console.log('Se la versione cambia, aggiorna il ?v= nei due tag in fondo a app/index.html.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
