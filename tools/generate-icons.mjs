/*
 * Genera tutte le icone dei pacchetti partendo da un'unica sorgente: app/img/icon.png.
 *
 * Perche' uno script e non file committati a mano: ogni piattaforma vuole un formato
 * diverso (.ico multi-risoluzione per Windows, .icns per macOS, PNG a taglie fisse per
 * Linux e Android). Tenerli allineati a mano dopo ogni ritocco del logo e' il modo
 * sicuro per ritrovarsi l'icona vecchia su una piattaforma sola e non accorgersene.
 *
 * Uso:  npm run icons
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'app', 'img', 'icon.png');
const BUILD = path.join(ROOT, 'build');
const ICONS_DIR = path.join(BUILD, 'icons');

// Taglie richieste da electron-builder per Linux (deb/rpm/AppImage leggono questa cartella)
// e riutilizzate come base per .ico e .icns.
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

// Windows .ico: piu' di queste risoluzioni e' spreco, meno e' sgranato nella taskbar.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  try {
    await fs.access(SRC);
  } catch {
    console.error(`Sorgente mancante: ${SRC}\nServe un PNG quadrato, idealmente 1024x1024.`);
    process.exit(1);
  }

  const meta = await sharp(SRC).metadata();
  if (meta.width !== meta.height) {
    console.warn(`Attenzione: l'icona sorgente non e' quadrata (${meta.width}x${meta.height}). Verra' deformata.`);
  }
  if (meta.width < 512) {
    console.warn(`Attenzione: sorgente ${meta.width}px. Sotto i 512px le taglie grandi risultano sfocate.`);
  }

  await fs.mkdir(ICONS_DIR, { recursive: true });

  // 1) PNG a tutte le taglie (Linux + base per gli altri formati)
  for (const size of SIZES) {
    const out = path.join(ICONS_DIR, `${size}x${size}.png`);
    await sharp(SRC).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  }
  console.log(`PNG generati (${SIZES.length} taglie) in build/icons/`);

  // 2) icon.png a 512 nella root di build/ (fallback per la finestra Electron su Linux)
  await sharp(SRC).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(BUILD, 'icon.png'));

  // 3) Windows .ico
  const icoBuffers = await Promise.all(
    ICO_SIZES.map((s) => sharp(SRC).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
  );
  await fs.writeFile(path.join(BUILD, 'icon.ico'), await pngToIco(icoBuffers));
  console.log('build/icon.ico generato');

  // 4) macOS .icns
  // Il formato .icns e' un container: header "icns" + una serie di chunk, ognuno con
  // un tipo a 4 lettere che codifica la risoluzione. Lo costruiamo a mano perche'
  // "iconutil" esiste solo su macOS e questo script deve girare anche da Windows/Linux.
  const ICNS_TYPES = [
    ['icp4', 16], ['icp5', 32], ['icp6', 64],
    ['ic07', 128], ['ic08', 256], ['ic09', 512],
    ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]
  ];

  const chunks = [];
  for (const [type, size] of ICNS_TYPES) {
    const png = await sharp(SRC).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(png.length + 8, 4); // lunghezza = dati + header del chunk
    chunks.push(header, png);
  }
  const body = Buffer.concat(chunks);
  const icnsHeader = Buffer.alloc(8);
  icnsHeader.write('icns', 0, 4, 'ascii');
  icnsHeader.writeUInt32BE(body.length + 8, 4);
  await fs.writeFile(path.join(BUILD, 'icon.icns'), Buffer.concat([icnsHeader, body]));
  console.log('build/icon.icns generato');

  console.log('\nFatto. Per Android le icone le genera Capacitor: dopo "npm run android:add" usa\n"npx capacitor-assets generate --android" oppure sostituisci i mipmap in android/app/src/main/res/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
