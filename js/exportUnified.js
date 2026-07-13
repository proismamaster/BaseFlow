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
  if (!isFinite(minX)) return { x: 0, y: 0, width: w, height: h };
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w, maxX + padding);
  maxY = Math.min(h, maxY + padding);
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

// Canvas temporaneo ritagliato al contenuto, su sfondo bianco (necessario per
// JPG, che non supporta la trasparenza; utile anche per PNG/PDF piu' leggibili).
function renderCroppedCanvas() {
  const bbox = computeContentBBox(40);
  const tmp = document.createElement('canvas');
  tmp.width = bbox.width;
  tmp.height = bbox.height;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  const _rs = (canvas.width && w) ? (canvas.width / w) : 1;
  tctx.drawImage(canvas, bbox.x * _rs, bbox.y * _rs, bbox.width * _rs, bbox.height * _rs, 0, 0, bbox.width, bbox.height);
  return tmp;
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
      const commentHeader = '// ' + formattedDate + '\n// Code from BaseFlow (' + meta.label + ' export — best effort, see Roadmap/PROBLEMS for known limits)\n\n';
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
}

function openExportPopup() {
  document.getElementById('export-popup').classList.add('active');
  document.getElementById('overlay').classList.add('active');
  renderExportPopup();
  if (typeof _bfPushOverlay === 'function') _bfPushOverlay('export-popup'); // R13-F: registro condiviso Esc
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

// PDF a pagina singola col diagramma (ritagliato), via jsPDF (CDN in index.html,
// stesso pattern di Shepherd.js). Se non disponibile, avvisa invece di fallire muto.
function downloadDiagramAsPdf() {
  const JsPDFCtor = (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) ||
    (typeof jsPDF !== 'undefined' ? jsPDF : null);
  if (!JsPDFCtor) {
    // B1 (round 11): modale stilizzata invece di alert() nativo.
    const msg = (typeof i18nText === 'function' && i18nText('pdf_unavailable')) || "PDF export non disponibile: la libreria jsPDF non e' stata caricata (serve connessione a Internet).";
    if (typeof showStyledAlert === 'function') showStyledAlert(msg, { danger: true });
    else if (typeof alert === 'function') alert(msg);
    return;
  }
  const cropped = renderCroppedCanvas();
  const dataUrl = cropped.toDataURL('image/png');
  const doc = new JsPDFCtor({
    orientation: cropped.width >= cropped.height ? 'l' : 'p',
    unit: 'px',
    format: [cropped.width, cropped.height]
  });
  doc.addImage(dataUrl, 'PNG', 0, 0, cropped.width, cropped.height);
  doc.save('flow_diagram.pdf');
}
