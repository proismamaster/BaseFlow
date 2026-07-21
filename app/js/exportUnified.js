// Modulo "Export" unificato: un solo pulsante/popup per tutti i formati
// (Python, JavaScript, C, C++, Java, PNG, JPG, PDF). Per il codice riusa i
// motori di traduzione esistenti (js/pythonTranslation.js, js/multiTranslation.js);
// per immagini/PDF lavora direttamente sul canvas, ritagliato al contenuto per
// evitare enormi margini vuoti (il canvas e' spesso molto piu' grande del
// disegno per lo scroll-padding, vedi resizeCanvasToFitNodes in layout.js).

const EXPORT_FORMAT_META = {
  python: { kind: 'code', ext: 'py', label: 'Python' },
  javascript: { kind: 'code', ext: 'js', label: 'JavaScript' },
  c: { kind: 'code', ext: 'c', label: 'C' },
  cpp: { kind: 'code', ext: 'cpp', label: 'C++' },
  java: { kind: 'code', ext: 'java', label: 'Java' },
  png: { kind: 'image', ext: 'png', label: 'PNG Image', mime: 'image/png' },
  jpg: { kind: 'image', ext: 'jpg', label: 'JPG Image', mime: 'image/jpeg' },
  pdf: { kind: 'pdf', ext: 'pdf', label: 'PDF Document' }
};

function currentExportFormat() {
  const sel = document.getElementById('export-format');
  return (sel && sel.value) || 'python';
}

// Bounding box (in px canvas) che contiene tutti i nodi, con un margine.
function computeContentBBox(padding) {
  padding = (typeof padding === 'number') ? padding : 40;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const list = (typeof nodi !== 'undefined' && nodi) ? nodi : [];
  for (const node of list) {
    if (!node) continue;
    const x0 = node.relX * w - node.width / 2;
    const y0 = node.relY * h - node.height / 2;
    const x1 = x0 + node.width;
    const y1 = y0 + node.height;
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x1 > maxX) maxX = x1;
    if (y1 > maxY) maxY = y1;
  }
  // P9.5 (round 15, 2026-07-13): includi anche gli ARCHI (frecce) e i loro segmenti extra
  // (bracci orizzontali / ponti di ricongiunzione) nel bounding box. Prima si consideravano
  // SOLO i nodi, quindi i bracci che sporgono a destra (if/while annidati) venivano TAGLIATI
  // nell'export PNG/JPG. Stesse coordinate px-canvas dei nodi (vedi arcHitTest in interaction.js).
  const arcs = (typeof frecce !== 'undefined' && frecce) ? frecce : [];
  const acc = function (x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  for (const f of arcs) {
    if (!f) continue;
    acc(f.inzioX, f.inzioY);
    acc(f.fineX, f.fineY);
    if (Array.isArray(f.visualExtra)) {
      for (const seg of f.visualExtra) {
        if (!seg) continue;
        acc(seg[0], seg[1]);
        acc(seg[2], seg[3]);
      }
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: w, height: h };
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w, maxX + padding);
  maxY = Math.min(h, maxY + padding);
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

// Canvas temporaneo ritagliato al contenuto, su sfondo bianco (necessario per
// JPG, che non supporta la trasparenza; utile anche per PNG/PDF piu' leggibili).
// WP-D7 (round 15-D, Ismail 2026-07-17, "l'export e' sgranato"): CAUSA -- il canvas temporaneo
// veniva creato in pixel LOGICI (1x, `bbox.width`/`bbox.height`), ma la drawImage prendeva la
// sorgente dal backing del canvas gia' supersampled (fino a un cap di 3x, vedi layout.js:55,
// `_rs = canvas.width / w`): tutta quella risoluzione extra veniva BUTTATA nel downscale verso
// una destinazione piu' piccola. Fix chirurgico: la destinazione ora usa la STESSA risoluzione
// della sorgente (bbox * _rs, non bbox 1x) -- sorgente/destinazione combaciano 1:1, nessuna
// perdita, nessuna modifica al backing/supersampling stesso (resta in layout.js, non toccato).
// `_bfLogicalWidth`/`_bfLogicalHeight` (dimensione in px CSS, "fisica") restano disponibili su
// return per chi deve posizionare/stampare l'immagine a una certa DIMENSIONE fisica (vedi
// downloadDiagramAsPdf: la pagina PDF resta alla dimensione logica, solo la densita' di pixel
// dentro aumenta -- "retina", non un foglio piu' grande).
function renderCroppedCanvas() {
  // WP-M5y: l'export COPIA dal canvas vivo (drawImage piu' sotto). Da quando il disegno culla
  // i blocchi fuori schermo, il canvas vivo contiene SOLO la parte visibile -- esportare senza
  // precauzioni avrebbe prodotto immagini e PDF con i blocchi mancanti, e per giunta in modo
  // dipendente da dove era lo scroll al momento dell'export. Qui si forza un ridisegno COMPLETO
  // (flag _bfExporting, che disattiva il culling), si copia, e si ripristina la vista normale.
  const _wasExporting = (typeof _bfExporting !== 'undefined') ? _bfExporting : false;
  try {
    if (typeof _bfExporting !== 'undefined') _bfExporting = true;
    if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
  } catch (e) {}
  const _res = _renderCroppedCanvasInner();
  try {
    if (typeof _bfExporting !== 'undefined') _bfExporting = _wasExporting;
    if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi); // torna alla vista cullata
  } catch (e) {}
  return _res;
}
function _renderCroppedCanvasInner() {
  const bbox = computeContentBBox(40);
  const _rs = (canvas.width && w) ? (canvas.width / w) : 1;
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(1, Math.round(bbox.width * _rs));
  tmp.height = Math.max(1, Math.round(bbox.height * _rs));
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  tctx.drawImage(canvas, bbox.x * _rs, bbox.y * _rs, bbox.width * _rs, bbox.height * _rs, 0, 0, tmp.width, tmp.height);
  tmp._bfLogicalWidth = bbox.width;
  tmp._bfLogicalHeight = bbox.height;
  return tmp;
}

// WP-D7: soglia (in megapixel RASTER, dopo il fix sopra) oltre la quale avvisare che l'export
// puo' essere lento/pesante -- ora che l'export e' ad alta risoluzione, un grafo enorme produce
// proporzionalmente un file enorme (prima veniva sempre schiacciato a 1x, quindi limitato "gratis").
const EXPORT_LARGE_MEGAPIXELS = 20;
function isExportContentLarge() {
  const bbox = computeContentBBox(40);
  const _rs = (typeof canvas !== 'undefined' && canvas.width && typeof w !== 'undefined' && w) ? (canvas.width / w) : 1;
  const mp = (bbox.width * _rs) * (bbox.height * _rs) / 1e6;
  return mp > EXPORT_LARGE_MEGAPIXELS;
}

function exportDateHeader() {
  const now = new Date();
  return (now.getMonth() + 1).toString().padStart(2, '0') + '/' +
    now.getDate().toString().padStart(2, '0') + '/' + now.getFullYear();
}

// MIGLIORIA (Ismail 2026-07-08): validatore pre-export. Elenca i blocchi con contenuto
// non valido/vuoto (stessa logica di nodeHasError usata per il rosso sul canvas) cosi'
// l'utente sa PRIMA di esportare che il codice generato sara' incompleto/errato.
function exportInvalidNodes() {
  if (typeof flow === 'undefined' || !flow.nodes || typeof nodeHasError !== 'function') return [];
  const bad = [];
  for (let i = 0; i < flow.nodes.length; i++) {
    if (flow.nodes[i] && nodeHasError(flow.nodes[i])) bad.push(flow.nodes[i].type);
  }
  return bad;
}
function renderExportPopup() {
  const format = currentExportFormat();
  const meta = EXPORT_FORMAT_META[format];
  const codeContainer = document.getElementById('export-code');
  const preview = document.getElementById('export-preview');
  const copyBtn = document.getElementById('copy-export-btn');

  if (meta.kind === 'code') {
    if (codeContainer) codeContainer.style.display = '';
    if (preview) preview.style.display = 'none';
    if (copyBtn) copyBtn.disabled = false;

    if (format === 'python') {
      translateFlow(); // js/pythonTranslation.js: popola 'codeLines'
      const hasCode = codeLines.some(function (l) { return l.trim() !== ''; });
      const formattedDate = exportDateHeader();
      if (hasCode) {
        if (codeLines.length > 0 && codeLines[0].startsWith('Error')) {
          codeContainer.value = '# ' + formattedDate + '\n# Code from BaseFlow\n\n# ' + codeLines[0];
        } else {
          codeContainer.value = '# ' + formattedDate + '\n# Code from BaseFlow\n' + codeLines.join('\n');
        { const _b = exportInvalidNodes(); if (_b.length) codeContainer.value = '# \u26A0 ' + ((typeof i18nFormat === 'function' && i18nFormat('export_invalid_warn', { n: _b.length, list: _b.join(', ') })) || (_b.length + ' blocco/i con contenuto non valido (' + _b.join(', ') + '): il codice potrebbe essere incompleto.')) + '\n' + codeContainer.value; }
        }
      } else {
        codeContainer.value = '# ' + ((typeof i18nText === 'function' && i18nText('export_empty')) || 'Empty flowchart');
      }
    } else {
      translateFlowMulti(format); // js/multiTranslation.js: popola 'multiCodeLines'
      const hasCode = multiCodeLines.some(function (l) { return l.trim() !== ''; });
      const formattedDate = exportDateHeader();
      // S9 P9.2 (round 15-B, Ismail 2026-07-15): tolto il riferimento a "Roadmap/PROBLEMS"
      // (file interni del repo, senza senso nel codice esportato da un utente) -- resta solo
      // data + "Code from BaseFlow", coerente con l'header Python sopra.
      const commentHeader = '// ' + formattedDate + '\n// Code from BaseFlow (' + meta.label + ' export)\n\n';
      if (hasCode) {
        if (multiCodeLines.length > 0 && multiCodeLines[0].startsWith('// Error')) {
          codeContainer.value = commentHeader + multiCodeLines[0];
        } else {
          codeContainer.value = commentHeader + multiCodeLines.join('\n');
          { const _b = exportInvalidNodes(); if (_b.length) codeContainer.value = '// \u26A0 ' + ((typeof i18nFormat === 'function' && i18nFormat('export_invalid_warn', { n: _b.length, list: _b.join(', ') })) || (_b.length + ' blocco/i con contenuto non valido (' + _b.join(', ') + '): il codice potrebbe essere incompleto.')) + '\n' + codeContainer.value; }
        }
      } else {
        codeContainer.value = '// ' + ((typeof i18nText === 'function' && i18nText('export_empty')) || 'Empty flowchart');
      }
    }
  } else if (meta.kind === 'image') {
    if (codeContainer) codeContainer.style.display = 'none';
    if (copyBtn) copyBtn.disabled = true;
    if (preview) {
      preview.style.display = '';
      const cropped = renderCroppedCanvas();
      preview.src = cropped.toDataURL(meta.mime, 0.92);
    }
  } else if (meta.kind === 'pdf') {
    if (preview) preview.style.display = 'none';
    if (codeContainer) {
      codeContainer.style.display = '';
      codeContainer.value = (typeof i18nFormat === 'function' && i18nFormat('pdf_instructions', { btn: (typeof i18nText === 'function' && i18nText('download')) || 'Download' })) || 'PDF export: click "Download" to save the diagram as a one-page PDF (cropped to content).';
    }
    if (copyBtn) copyBtn.disabled = true;
  }
  // WP-D7: tip per grafi molto grandi, valido per image/pdf (entrambi passano da
  // renderCroppedCanvas ora ad alta risoluzione) -- assente/nascosto per il codice.
  const warnEl = document.getElementById('export-large-warn');
  if (warnEl) warnEl.hidden = !(meta.kind !== 'code' && isExportContentLarge());
}

function openExportPopup() {
  const _exportPop = document.getElementById('export-popup');
  _exportPop.classList.add('active');
  document.getElementById('overlay').classList.add('active');
  renderExportPopup();
  if (typeof _bfPushOverlay === 'function') _bfPushOverlay('export-popup'); // R13-F: registro condiviso Esc
  // P2.4 (round 15-B S1): apertura = sempre in primo piano (ux.js), coerente col raise-on-click.
  if (typeof bfBringToFrontPopup === 'function') bfBringToFrontPopup(_exportPop);
}

function onExportFormatChange() {
  renderExportPopup();
}

function closeExportPopup() {
  document.getElementById('export-popup').classList.remove('active');
  document.getElementById('overlay').classList.remove('active');
  if (typeof _bfPopOverlay === 'function') _bfPopOverlay('export-popup');
}

// D2 (round 11, bonus tecnico): document.execCommand('copy') e' un'API deprecata che puo'
// fallire silenziosamente (specie fuori da un contesto "trusted" o su browser recenti).
// navigator.clipboard.writeText() e' l'API moderna -- fallback sul vecchio execCommand nel
// catch (stesso codeContainer.select()+copy di prima) per i browser/contesti senza Clipboard API.
async function copyExportOutput() {
  const format = currentExportFormat();
  const meta = EXPORT_FORMAT_META[format];
  if (meta.kind !== 'code') return;
  const codeContainer = document.getElementById('export-code');
  try {
    if (!(navigator.clipboard && navigator.clipboard.writeText)) throw new Error('Clipboard API non disponibile');
    await navigator.clipboard.writeText(codeContainer.value);
  } catch (e) {
    codeContainer.select();
    document.execCommand('copy');
  }
  if (typeof showStyledAlert === 'function') showStyledAlert(((typeof i18nText === 'function' && i18nText('export_copied')) || 'Code copied to clipboard!'));
  else alert(meta.label + ' code copied to clipboard!');
}

function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadExportOutput() {
  const format = currentExportFormat();
  const meta = EXPORT_FORMAT_META[format];
  if (meta.kind === 'code') {
    const codeContainer = document.getElementById('export-code');
    const blob = new Blob([codeContainer.value], { type: 'text/plain' });
    triggerDownload(URL.createObjectURL(blob), 'flow_code.' + meta.ext);
    // B1 (round 11): modale stilizzata invece di alert() nativo.
    {
      const fileName = 'flow_code.' + meta.ext;
      const msg = (typeof i18nFormat === 'function' && i18nFormat('export_downloaded', { label: meta.label, file: fileName })) ||
        (meta.label + ' code downloaded as ' + fileName + '!');
      if (typeof showStyledAlert === 'function') showStyledAlert(msg);
      else if (typeof alert === 'function') alert(msg);
    }
    return;
  }
  if (meta.kind === 'image') {
    const cropped = renderCroppedCanvas();
    triggerDownload(cropped.toDataURL(meta.mime, 0.92), 'flow_diagram.' + meta.ext);
    return;
  }
  if (meta.kind === 'pdf') {
    downloadDiagramAsPdf();
  }
}

// PDF a pagina singola col diagramma (ritagliato), via jsPDF. S9 P9.1 (round 15-B, Ismail
// 2026-07-15): la libreria e' ora servita LOCALMENTE (js/vendor/jspdf.umd.min.js, caricata
// in index.html PRIMA di questo file) invece che da CDN -- funziona anche offline. Il
// controllo sotto resta come guardia difensiva (mai vista fallire nei test, ma se lo script
// vendor non si carica per qualche motivo l'utente vede comunque un avviso chiaro invece di
// un errore silenzioso).
function downloadDiagramAsPdf() {
  const JsPDFCtor = (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) ||
    (typeof jsPDF !== 'undefined' ? jsPDF : null);
  if (!JsPDFCtor) {
    // B1 (round 11): modale stilizzata invece di alert() nativo.
    const msg = (typeof i18nText === 'function' && i18nText('pdf_unavailable')) || "PDF export non disponibile: la libreria PDF non si e' caricata correttamente.";
    if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true });
    else if (typeof alert === 'function') alert(msg);
    return;
  }
  const cropped = renderCroppedCanvas();
  const dataUrl = cropped.toDataURL('image/png');
  // WP-D7: la pagina PDF usa la dimensione LOGICA (px CSS, `_bfLogicalWidth/Height`), NON quella
  // del raster (ora piu' grande dopo il fix di renderCroppedCanvas) -- altrimenti il foglio
  // stampato uscirebbe 2-3x piu' grande fisicamente. L'immagine ad alta risoluzione viene
  // comunque incorporata dentro quella STESSA dimensione di stampa: piu' densita' di pixel,
  // stessa dimensione fisica del foglio -- effetto "retina", non un foglio piu' grande.
  const pageW = cropped._bfLogicalWidth || cropped.width;
  const pageH = cropped._bfLogicalHeight || cropped.height;
  const doc = new JsPDFCtor({
    orientation: pageW >= pageH ? 'l' : 'p',
    unit: 'px',
    format: [pageW, pageH]
  });
  doc.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH);
  doc.save('flow_diagram.pdf');
}
