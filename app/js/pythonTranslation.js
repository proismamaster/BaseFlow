let tabsCount = 0;
let codeLines = [];
const indend = '    ';
let index=0;
function addLine(code){
    codeLines.push(indend.repeat(tabsCount) + code);
}

// R13-M: converte la sintassi di condizione/espressione di BaseFlow (grammatica di
// safeEval.js: && || true false, oltre a numeri/confronti/parentesi gia' validi anche in
// Python) nell'equivalente Python -- prima le condizioni con && || true/false non
// arrivavano MAI a un If/While/Assign/Print REALMENTE esportato perche' l'esecuzione
// in-app le rifiutava (checkCondition rigettava questi operatori); ora che funzionano
// in-app (R13-M), l'export deve smettere di copiarle VERBATIM: "if x && y:" e' un
// SyntaxError in Python (servono "and"/"or"/"True"/"False"). Sostituzione token-aware:
// le stringhe quotate passano intatte (mai toccate dentro gli apici), true/false
// diventano True/False SOLO come parole intere.
// AGGIORNAMENTO 2026-07-19: il limite noto R13-M (ternario ?: e Math.* non riscritti) è stato
// RISOLTO — vedi il transpiler pyExpr/pyStmt/pyCond più sotto (ternario -> (a if c else b),
// Math.* -> math.*/builtin/inline, import automatici). pyCondSyntax resta come FALLBACK
// token-level, usato solo se pyExpr non riesce a parsare: comportamento storico invariato.
function pyCondSyntax(expr) {
    const s = String(expr);
    let out = '';
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'") {
            const quote = ch; let j = i + 1, lit = ch;
            while (j < s.length) {
                lit += s[j];
                if (s[j] === '\\' && j + 1 < s.length) { lit += s[j + 1]; j += 2; continue; }
                if (s[j] === quote) { j++; break; }
                j++;
            }
            out += lit; i = j; continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i, id = ''; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
            out += (id === 'true') ? 'True' : (id === 'false') ? 'False' : id;
            i = j; continue;
        }
        if (s.substr(i, 2) === '&&') { out += ' and '; i += 2; continue; }
        if (s.substr(i, 2) === '||') { out += ' or '; i += 2; continue; }
        out += ch; i++;
    }
    return out.replace(/ {2,}/g, ' '); // collassa gli spazi doppi introdotti da ' and '/' or '
}

// ============================================================================
// 2026-07-19 (Ismail, "il resto non chiuso"): transpiler espressione -> Python che RISOLVE
// il limite noto R13-M (ternario ?: e Math.* non riscritti). Parser a discesa ricorsiva
// sulla STESSA grammatica di safeEval.js, ma invece di VALUTARE EMETTE codice Python:
//   - cond ? a : b          -> (a if cond else b)      (Python non ha l'operatore ?:)
//   - && || !               -> and / or / not
//   - true/false/null       -> True / False / None
//   - Math.PI / Math.E      -> math.pi / math.e        (import math)
//   - Math.sqrt/floor/ceil/sin/cos/tan/log/exp/trunc/pow -> math.*  (import math; pow->builtin)
//   - Math.abs/max/min/round -> builtin (nessun import)
//   - Math.random()         -> random.random()         (import random)
//   - Math.sign(x)/cbrt(x)  -> ((x>0)-(x<0)) / (x)**(1/3)  (equivalenti, nessun import)
// Gli import necessari sono raccolti in _pyNeedMath/_pyNeedRandom e messi in cima in
// translateFlow. Se il parse fallisce per QUALSIASI motivo, si ricade su pyCondSyntax (il
// vecchio comportamento token-level): l'export non è MAI peggio di prima.
let _pyNeedMath = false, _pyNeedRandom = false;
const _PY_MATH_MODULE = { sqrt:1, floor:1, ceil:1, sin:1, cos:1, tan:1, log:1, exp:1, trunc:1 };
const _PY_BUILTIN = { abs:1, max:1, min:1, round:1, pow:1 };
function _pyTokenize(src) {
  const s = String(src), t = []; let i = 0;
  const two = ['===','!==','==','!=','<=','>=','&&','||'];
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '"' || ch === "'") {
      let q = ch, j = i + 1, lit = ch;
      while (j < s.length) { lit += s[j]; if (s[j] === '\\' && j + 1 < s.length) { lit += s[j+1]; j += 2; continue; } if (s[j] === q) { j++; break; } j++; }
      if (lit[lit.length-1] !== q) throw new Error('stringa non chiusa');
      t.push({ t: 'str', v: lit }); i = j; continue;
    }
    if ((ch >= '0' && ch <= '9') || (ch === '.' && s[i+1] >= '0' && s[i+1] <= '9')) {
      let j = i, num = ''; while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) { num += s[j]; j++; }
      t.push({ t: 'num', v: num }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i, id = ''; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
      t.push({ t: 'id', v: id }); i = j; continue;
    }
    const three = s.substr(i, 3);
    if (three === '===' || three === '!==') { t.push({ t: 'op', v: three }); i += 3; continue; }
    const twoc = s.substr(i, 2);
    if (two.indexOf(twoc) !== -1) { t.push({ t: 'op', v: twoc }); i += 2; continue; }
    if ('+-*/%<>!()?:,.'.includes(ch)) { t.push({ t: 'op', v: ch }); i++; continue; }
    throw new Error('carattere non ammesso: ' + ch);
  }
  t.push({ t: 'eof' }); return t;
}
function _PyParser(tk) { this.k = tk; this.p = 0; }
_PyParser.prototype.peek = function () { return this.k[this.p]; };
_PyParser.prototype.next = function () { return this.k[this.p++]; };
_PyParser.prototype.eat = function (v) { const x = this.k[this.p]; if (x.t === 'op' && x.v === v) { this.p++; return true; } return false; };
_PyParser.prototype.expect = function (v) { if (!this.eat(v)) throw new Error("atteso '" + v + "'"); };
_PyParser.prototype.parse = function () { const r = this.ternary(); if (this.peek().t !== 'eof') throw new Error('token in eccesso'); return r; };
_PyParser.prototype.ternary = function () { const c = this.or(); if (this.eat('?')) { const a = this.ternary(); this.expect(':'); const b = this.ternary(); return '(' + a + ' if ' + c + ' else ' + b + ')'; } return c; };
_PyParser.prototype.or = function () { let l = this.and(); while (this.peek().t === 'op' && this.peek().v === '||') { this.next(); l = '(' + l + ' or ' + this.and() + ')'; } return l; };
_PyParser.prototype.and = function () { let l = this.eq(); while (this.peek().t === 'op' && this.peek().v === '&&') { this.next(); l = '(' + l + ' and ' + this.eq() + ')'; } return l; };
_PyParser.prototype.eq = function () { let l = this.rel(); while (this.peek().t === 'op' && ['==','!=','===','!=='].indexOf(this.peek().v) !== -1) { const o = this.next().v; const r = this.rel(); l = l + (o === '===' ? ' == ' : o === '!==' ? ' != ' : ' ' + o + ' ') + r; } return l; };
_PyParser.prototype.rel = function () { let l = this.add(); while (this.peek().t === 'op' && ['<','>','<=','>='].indexOf(this.peek().v) !== -1) { const o = this.next().v; l = l + ' ' + o + ' ' + this.add(); } return l; };
_PyParser.prototype.add = function () { let l = this.mul(); while (this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) { const o = this.next().v; l = l + ' ' + o + ' ' + this.mul(); } return l; };
_PyParser.prototype.mul = function () { let l = this.unary(); while (this.peek().t === 'op' && ['*','/','%'].indexOf(this.peek().v) !== -1) { const o = this.next().v; l = l + ' ' + o + ' ' + this.unary(); } return l; };
_PyParser.prototype.unary = function () { const x = this.peek(); if (x.t === 'op' && (x.v === '!' || x.v === '-' || x.v === '+')) { this.next(); const v = this.unary(); return x.v === '!' ? '(not ' + v + ')' : x.v + v; } return this.primary(); };
_PyParser.prototype.args = function () { const a = []; this.expect('('); if (!(this.peek().t === 'op' && this.peek().v === ')')) { a.push(this.ternary()); while (this.eat(',')) a.push(this.ternary()); } this.expect(')'); return a; };
_PyParser.prototype.primary = function () {
  const x = this.next();
  if (x.t === 'num') return x.v;
  if (x.t === 'str') return x.v;
  if (x.t === 'op' && x.v === '(') { const v = this.ternary(); this.expect(')'); return '(' + v + ')'; }
  if (x.t === 'id') {
    if (x.v === 'true') return 'True'; if (x.v === 'false') return 'False'; if (x.v === 'null') return 'None';
    if (x.v === 'Math' && this.peek().t === 'op' && this.peek().v === '.') {
      this.next(); const m = this.next(); if (m.t !== 'id') throw new Error('membro Math non valido');
      const isCall = this.peek().t === 'op' && this.peek().v === '(';
      if (!isCall) { // costante
        if (m.v === 'PI') { _pyNeedMath = true; return 'math.pi'; }
        if (m.v === 'E') { _pyNeedMath = true; return 'math.e'; }
        throw new Error('Math.' + m.v + ' non supportato');
      }
      const a = this.args();
      if (m.v === 'sign') { const g = a[0]; return '((' + g + ' > 0) - (' + g + ' < 0))'; }
      if (m.v === 'cbrt') { return '((' + a[0] + ') ** (1 / 3))'; }
      if (m.v === 'random') { _pyNeedRandom = true; return 'random.random()'; }
      if (_PY_BUILTIN[m.v]) return m.v + '(' + a.join(', ') + ')';
      if (_PY_MATH_MODULE[m.v]) { _pyNeedMath = true; return 'math.' + m.v + '(' + a.join(', ') + ')'; }
      throw new Error('Math.' + m.v + ' non supportato');
    }
    return x.v; // identificatore (nome variabile)
  }
  throw new Error('espressione non valida');
};
// Traduce una pura ESPRESSIONE in Python; null se non parsabile (il chiamante fa fallback).
function pyExpr(expr) {
  try { return new _PyParser(_pyTokenize(expr)).parse(); }
  catch (e) { return null; }
}
// Traduce uno STATEMENT BaseFlow (condizione, oppure "var =|+=|... espr") in Python: separa
// l'eventuale assegnazione iniziale, traduce la parte espressione con pyExpr, con fallback a
// pyCondSyntax se qualcosa non si parsa (mai peggio di prima).
function pyStmt(info) {
  const s = String(info);
  const m = s.match(/^\s*([A-Za-z_]\w*)\s*(=|\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/);
  if (m && m[2] === '=' ) {
    const rhs = pyExpr(m[3]); if (rhs != null) return m[1] + ' = ' + rhs;
  } else if (m) {
    const rhs = pyExpr(m[3]); if (rhs != null) return m[1] + ' ' + m[2] + ' ' + rhs;
  } else {
    const e = pyExpr(s); if (e != null) return e;
  }
  return pyCondSyntax(info); // fallback identico al comportamento storico
}
// Condizione/espressione pura -> Python (ternario/Math inclusi), fallback pyCondSyntax.
function pyCond(expr) { const e = pyExpr(expr); return (e != null) ? e : pyCondSyntax(expr); }

// ============================================================================
// Ismail 2026-07-20 ("aggiungere i Boolean, occhio a errori/validazioni"): scoperto un bug
// REALE e pre-esistente, non specifico al Boolean, riproducibile con un python3 vero:
// il nodo 'print' passava l'INTERO testo grezzo (es. "'Somma: ' + a+b") a pyCond() come
// UN'unica espressione. pyExpr traduce fedelmente il "+" cosi' com'e' (e' l'operatore
// giusto per un Assegna: tot = a + b DEVE restare addizione numerica) -- ma per un Output
// che concatena testo e numeri, Python (a differenza di JS/Java, che convertono
// automaticamente) NON somma implicitamente str+int: 'Somma: ' + a genera
// "TypeError: can only concatenate str (not 'int') to str" al momento di eseguire lo
// script esportato -- verificato lanciando python3 per davvero, non solo a occhio.
// Fix: stessa GRANULARITA' con cui l'interprete reale (execute.js, case "print") e
// l'export C++ (multiTranslation.js, translatePrintMulti) trattano l'Output -- si separano
// prima i pezzi tra apici (letterali, mai toccati) dai pezzi senza apici via splitStrings()
// (la STESSA funzione di execute.js, già caricato prima in index.html), poi ogni pezzo SENZA
// apici viene tradotto come UNA SOLA espressione (cosi' "a+b" resta una somma vera, non due
// pezzi separati) e il RISULTATO viene avvolto in str(...) -- sempre sicuro: str() su una
// stringa e' un no-op, su un numero/booleano lo trasforma nel testo corretto (str(True) ->
// "True", coerente con la convenzione Python). Rimosso anche un "+" iniziale ridondante
// PRIMA di tradurre (stesso identico bug/fix gia' trovato in execute.js lo stesso giorno:
// 'Nome: ' + nome con nome String/Boolean produceva un "+" unario Python su una stringa,
// altro TypeError -- "+x" su un str non e' definito in Python, esattamente come su un
// oggetto senza __pos__ in generale).
function pyPrintExpr(info) {
  const parts = (typeof splitStrings === 'function') ? splitStrings(String(info)) : [String(info)];
  const pieces = parts.map(function (p) {
    if (p.startsWith("'") || p.startsWith('"')) return p; // letterale tra apici: gia' Python valido cosi' com'e'
    const stripped = p.replace(/^\s*\+\s*/, '');
    return 'str(' + pyCond(stripped) + ')';
  });
  return pieces.length ? pieces.join(' + ') : "''";
}

// Nota: le funzioni UI del vecchio popup dedicato (openPythonPopup/closePythonPopup/
// copyPythonCode/downloadPythonCode, che puntavano a #python-popup/#python-code)
// sono state rimosse: l'export Python passa ora dal popup unificato
// js/exportUnified.js, che chiama direttamente translateFlow() qui sotto e legge
// 'codeLines'. Questo file resta il motore di traduzione, invariato.

function translateFlow(){
    codeLines = [];
    tabsCount = 0;
    index=0;
    _pyNeedMath = false; _pyNeedRandom = false; // 2026-07-19: reset flag import per questa traduzione
    for (index = 0; index < flow.variables.length; index++) {
        addLine(translateVariable(flow.variables[index].name, flow.variables[index].value));
    }
    addLine('\n');
    for (index = 0; index < flow.nodes.length; index++) {
        const node = flow.nodes[index];
        addLine(translateNode(node));
    }
    // 2026-07-19: gli import necessari (rilevati durante la traduzione delle espressioni:
    // Math.sqrt... -> math, Math.random() -> random) vanno messi IN CIMA al file.
    const _imports = [];
    if (_pyNeedMath) _imports.push('import math');
    if (_pyNeedRandom) _imports.push('import random');
    if (_imports.length) codeLines.unshift(_imports.join('\n'));
    console.log(codeLines.join('\n'));
}

function translateVariable(variable,init){
    let string = '';
    // Ismail 2026-07-20: `init` arrivava qui GREZZO (flow.variables[i].value) e veniva
    // concatenato cosi' com'era -- corretto per numeri (stesso letterale in JS e Python),
    // ma SBAGLIATO per String (produceva `nome = Mario` invece di `nome = "Mario"`, un
    // riferimento a un nome non definito anziche' una stringa: bug pre-esistente, mai
    // segnalato finora, scoperto aggiungendo il tipo Boolean) e per Boolean (JS stringifica
    // `true`/`false` in minuscolo, ma Python richiede i letterali capitalizzati `True`/`False`
    // -- altrimenti e' un NameError, "true" non esiste in Python). Serializzazione ora
    // per-tipo, come gia' fa multiTranslation.js per gli altri 4 linguaggi.
    let initLiteral = init;
    if (typeof init === 'string') initLiteral = JSON.stringify(init);
    else if (typeof init === 'boolean') initLiteral = init ? 'True' : 'False';
    // WP-M2 (Ismail 2026-07-20, tipo Array): lista Python con la stessa serializzazione
    // per-elemento (stringhe quotate, bool capitalizzati) -- `a = [1, 2, 3]`.
    // WP-M3: con dimensione dichiarata e valore UNIFORME (il caso normale della tabella)
    // si emette l'idiomatico `a = [v] * n` invece di un letterale chilometrico.
    else if (Array.isArray(init)) {
        const _ser = function (el) {
            if (typeof el === 'string') return JSON.stringify(el);
            if (typeof el === 'boolean') return el ? 'True' : 'False';
            return String(el);
        };
        const _uniform = init.length > 3 && init.every(function (el) { return el === init[0]; });
        initLiteral = _uniform
            ? ('[' + _ser(init[0]) + '] * ' + init.length)
            : ('[' + init.map(_ser).join(', ') + ']');
    }
    string += variable + " = " + initLiteral;

    return string;
}

function translateNode(node){
    switch(node.type) {
        case 'start':
            return '';
        case 'end':
            return '';
        case 'assign':
            // S9 P9.2 (round 15-B, Ismail 2026-07-15): un nodo vuoto NON blocca piu' tutto
            // l'export (prima sovrascriveva codeLines[0] con un errore globale, cancellando
            // il codice gia' generato per gli altri nodi) -- diventa solo un commento
            // placeholder per QUESTO nodo, il resto del flow continua a essere tradotto.
            if(node.info == ""){
                return '# (empty assign block)';
            }
            return pyStmt(node.info); // R13-M + 2026-07-19: && || / ternario / Math -> Python
        case 'input':
            if(node.info == ""){
                return '# (empty input block)';
            }
            const variable = getVariable(node.info,flow.variables);
            switch(variable.type) {
                case 'string':
                    return variable.name + " = input('Insert a string for " + variable.name +"')";
                case 'int':
                    return variable.name + " = int(input('Insert an integer for " + variable.name + "'))";
                case 'float':
                    return variable.name + " = float(input('Insert a float for " + variable.name + "'))";
                // Ismail 2026-07-20: Boolean -- stesso contratto testuale "true"/"false"
                // usato ovunque nell'app (Input runtime, valori letterali), non "1"/"0".
                // .strip().lower() tollera spazi e maiuscole prima del confronto.
                case 'bool':
                    return variable.name + " = input('Insert true/false for " + variable.name + "').strip().lower() == 'true'";
            }
        case 'print':
            if(node.info == ""){
                return '# (empty print block)';
            }
            // A4 (round 11): opzione "a capo dopo la stampa" (node.newline, assente = true).
            // 2026-07-20: pyPrintExpr invece di pyCond diretto -- vedi commento sopra la funzione.
            return (node.newline === false) ? ('print(' + pyPrintExpr(node.info) + ", end='')") : ('print(' + pyPrintExpr(node.info) + ')');
        case 'if':
            if(node.info == ""){
                return '# (empty if block, condition not set -- branches not translated)';
            }
            addLine('');
            addLine('if ' + pyCond(node.info) + ':');
            tabsCount++;
            recreateIfBranches(node);
            return '';
        case 'while':
            if(node.info == ""){
                return '# (empty while block, condition not set -- body not translated)';
            }
            addLine('');
            addLine('while ' + pyCond(node.info) + ':');
            tabsCount++;
            recreateWhileBody(node);
            return '';
        case 'for':
            // FIX B1 (review Fable, 2026-07-05, piano Do-While/For): Python non ha un
            // for in stile C (init;condizione;incremento) -- riscrittura STANDARD e
            // documentata (vedi DECISIONS): l'init diventa una riga a se' PRIMA del
            // ciclo (stessa indentazione del for), la condizione diventa un while, e
            // l'incremento va emesso come ULTIMA riga del corpo (dentro il while) --
            // esattamente come un umano tradurrebbe a mano un for C-style in Python.
            if(node.info == ""){
                return '# (empty for block, parameters not set -- body not translated)';
            }
            const forParts = node.info.split(';');
            if (forParts.length !== 3) {
                codeLines[0] = ("Error: node " + node.type + " has invalid syntax (expected init;condition;increment). Please edit its informations to translate the chart into Python");
                return '';
            }
            const forInit = forParts[0].trim();
            const forCond = forParts[1].trim();
            const forIncr = forParts[2].trim();
            addLine('');
            addLine(pyStmt(forInit));
            addLine('while ' + pyCond(forCond) + ':');
            tabsCount++;
            recreateForBody(node, forIncr);
            return '';
        case 'do':
            // FIX B2 (review Fable, 2026-07-05, piano Do-While/For): Python non ha un
            // do-while nativo -- riscrittura STANDARD e documentata (vedi DECISIONS):
            // while True: <corpo>; if not (<condizione>): break. Questo garantisce
            // l'esecuzione ALMENO una volta, esattamente come il fix semantico
            // dell'executor (B2, vedi execute.js).
            if(node.info == ""){
                return '# (empty do-while block, condition not set -- body not translated)';
            }
            addLine('');
            addLine('while True:');
            tabsCount++;
            recreateDoWhileBody(node);
            return '';
        case 'forward':
        case 'turn':
        case 'home':
        case 'pen':
        case 'gclear':
            return (typeof turtleCommentText === 'function') ? ('# ' + turtleCommentText(node.type, node.info)) : ('# Turtle');
        case 'comment':
            return '# ' + (node.info || '');
        case 'pause':
            return '# [pause]';
    }
}

// Traduce il CORPO di un ciclo While in Python. A differenza di recreateIfBranches
// (che assume range [trueBranch, falseBranch) contigui in flow.nodes, fragile ma
// preesistente e non toccato qui), qui si usa collectLoopBody() -- la stessa
// funzione usata da layout/rendering -- per ottenere l'ordine REALE di esecuzione
// del corpo (robusto anche se gli indici non fossero perfettamente contigui).
// Dopo aver tradotto il corpo, reimposta la variabile 'index' condivisa con
// translateFlow() cosi' che il suo ciclo esterno (index++) riprenda DOPO il corpo,
// senza ritradurre i nodi del corpo come se fossero al livello principale.
function recreateWhileBody(whileNode){
    const loopIdx = flow.nodes.indexOf(whileNode);
    const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
    if (body.bodyList.length === 0) {
        // BUG B3 (review Fable, 2026-07-04 notte-2): un while a corpo vuoto emetteva
        // solo "while <cond>:" senza alcuna riga indentata sotto -- Python richiede
        // almeno un'istruzione nel blocco, altrimenti e' un SyntaxError. "pass" e'
        // l'istruzione nulla standard per un blocco intenzionalmente vuoto.
        addLine('pass');
    } else {
        for (const idx of body.bodyList) {
            addLine(translateNode(flow.nodes[idx]));
        }
    }
    tabsCount--;
    index = body.bodyList.length > 0 ? Math.max(...body.bodyList) : loopIdx;
}

// Converte l'espressione di incremento del For (sintassi C-style: i++, i--, i+=n,
// i-=n, i=espressione) nell'equivalente Python. `+=`/`-=`/`=` sono gia' sintassi
// Python valida cosi' come sono scritte -- serve tradurre SOLO i++/i-- (che Python
// non supporta affatto, ne' come ++i ne' come i++).
function translateIncrementToPython(incrExpr){
    const incTrim = incrExpr.trim();
    const incMatch = incTrim.match(/^([a-zA-Z_]\w*)\s*\+\+$/);
    if (incMatch) return incMatch[1] + ' += 1';
    const decMatch = incTrim.match(/^([a-zA-Z_]\w*)\s*--$/);
    if (decMatch) return decMatch[1] + ' -= 1';
    return incTrim;
}

// Traduce il CORPO di un ciclo For in Python (analoga a recreateWhileBody), con
// l'aggiunta dell'incremento come ultima riga del corpo -- e' quello che chiude il
// ciclo in una riscrittura for->while (senza, il while non avanzerebbe mai).
function recreateForBody(forNode, incrExpr){
    const loopIdx = flow.nodes.indexOf(forNode);
    const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
    if (body.bodyList.length === 0) {
        addLine('pass');
    } else {
        for (const idx of body.bodyList) {
            addLine(translateNode(flow.nodes[idx]));
        }
    }
    addLine(translateIncrementToPython(incrExpr));
    tabsCount--;
    index = body.bodyList.length > 0 ? Math.max(...body.bodyList) : loopIdx;
}

// Traduce il CORPO di un ciclo Do-While in Python (dentro un `while True:`), con un
// `if not (<condizione>): break` come ultima riga -- pattern standard Python per
// simulare un do-while (garantisce l'esecuzione almeno una volta, poi esce quando
// la condizione e' falsa, esattamente il contrario di un while normale).
function recreateDoWhileBody(doNode){
    const loopIdx = flow.nodes.indexOf(doNode);
    const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
    if (body.bodyList.length === 0) {
        addLine('pass');
    } else {
        for (const idx of body.bodyList) {
            addLine(translateNode(flow.nodes[idx]));
        }
    }
    addLine('if not (' + pyCond(doNode.info) + '):');
    tabsCount++;
    addLine('break');
    tabsCount--;
    tabsCount--;
    index = body.bodyList.length > 0 ? Math.max(...body.bodyList) : loopIdx;
}

function recreateIfBranches(ifNode){
    let falseBranch = parseInt(ifNode.next.false);
    let trueBranch = parseInt(ifNode.next.true);
    for(index = trueBranch; index < falseBranch; index++){
        const node = flow.nodes[index];
        addLine(translateNode(node));
    }
    tabsCount--;
    // FIX #14 (Ismail 2026-07-08): in Python "else:" DEVE avere un corpo, altrimenti e'
    // codice non valido (IndentationError). Se il ramo falso e' vuoto (punta direttamente
    // alla ricongiunzione) NON si emette affatto l'else.
    var _ifIdx = flow.nodes.indexOf(ifNode);
    var _sub = (typeof collectBranchNodes === 'function') ? collectBranchNodes(_ifIdx) : null;
    var _hasFalse = _sub ? (_sub.falseList.length > 0) : (falseBranch < (flow.nodes[ifNode.next.false-1] ? flow.nodes[ifNode.next.false-1].next : falseBranch));
    if (_hasFalse) {
        addLine('else:');
        tabsCount++;
        for(index = falseBranch; index < flow.nodes[ifNode.next.false-1].next; index++){
            addLine(translateNode(flow.nodes[index]));
        }
        tabsCount--;
    }
}
