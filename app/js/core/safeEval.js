// safeEval.js — MIGLIORIA #45 (Ismail 2026-07-08): valutatore di espressioni SICURO che
// sostituisce eval() nell'esecutore. eval() era un vettore di RCE (aprendo un .json ostile,
// un'espressione come `constructor.constructor("...")()` veniva eseguita). Questo valutatore
// e' un parser a discesa ricorsiva che riconosce SOLO: numeri, stringhe, booleani/null,
// operatori aritmetici/relazionali/logici, parentesi, ternario e un set ALLOWLIST di funzioni
// Math. Qualsiasi altra cosa (identificatori sconosciuti, membri, chiamate arbitrarie) lancia
// un errore -> nessun accesso a globali/prototype, niente esecuzione di codice arbitrario.
(function (global) {
  const MATH_FN = { abs:1, floor:1, ceil:1, round:1, sqrt:1, pow:1, max:1, min:1, random:1, trunc:1, sign:1, cbrt:1, log:1, exp:1, sin:1, cos:1, tan:1 };
  const MATH_CONST = { PI: Math.PI, E: Math.E };
  // WP-M5f: conversioni carattere <-> codice ASCII/Unicode. Nomi accettati anche in
  // minuscolo perche' nessuno si ricorda la maiuscola giusta mentre scrive un blocco.
  function _asc(v) {
    const s = String(v);
    if (!s.length) throw new Error('__ASCEMPTY__');
    return s.codePointAt(0);
  }
  function _chr(v) {
    const n = Number(v);
    // Il range valido dei code point Unicode. Fuori, String.fromCodePoint lancerebbe un
    // RangeError tecnico: meglio un marcatore che l'esecutore traduce in un messaggio chiaro.
    if (!Number.isInteger(n) || n < 0 || n > 0x10FFFF) throw new Error('__CHRRANGE__:' + v);
    return String.fromCodePoint(n);
  }
  const CHAR_FN = { Asc: _asc, asc: _asc, Chr: _chr, chr: _chr, Char: _chr, char: _chr };

  function tokenize(src) {
    const t = []; let i = 0; const s = String(src);
    const two = ['===','!==','==','!=','<=','>=','&&','||'];
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      // stringa
      if (ch === '"' || ch === "'") {
        let q = ch, j = i + 1, str = '';
        while (j < s.length && s[j] !== q) { if (s[j] === '\\' && j + 1 < s.length) { str += s[j + 1]; j += 2; } else { str += s[j]; j++; } }
        if (j >= s.length) throw new Error('stringa non chiusa');
        t.push({ t: 'str', v: str }); i = j + 1; continue;
      }
      // numero
      if ((ch >= '0' && ch <= '9') || (ch === '.' && s[i + 1] >= '0' && s[i + 1] <= '9')) {
        let j = i, num = '';
        while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) { num += s[j]; j++; }
        t.push({ t: 'num', v: parseFloat(num) }); i = j; continue;
      }
      // identificatore
      if (/[A-Za-z_]/.test(ch)) {
        let j = i, id = '';
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
        t.push({ t: 'id', v: id }); i = j; continue;
      }
      // operatore a 3 char
      const three = s.substr(i, 3);
      if (three === '===' || three === '!==') { t.push({ t: 'op', v: three }); i += 3; continue; }
      const twoc = s.substr(i, 2);
      if (two.indexOf(twoc) !== -1) { t.push({ t: 'op', v: twoc }); i += 2; continue; }
      // WP-M2 (Ismail 2026-07-20, tipo Array): [ e ] ammessi -- letterali array e indicizzazione.
      if ('+-*/%<>!()?:,.[]'.includes(ch)) { t.push({ t: 'op', v: ch }); i++; continue; }
      throw new Error('carattere non ammesso: ' + ch);
    }
    t.push({ t: 'eof' }); return t;
  }

  function Parser(tokens, opts) { this.k = tokens; this.p = 0; this.opts = opts || {}; }
  Parser.prototype.peek = function () { return this.k[this.p]; };
  Parser.prototype.next = function () { return this.k[this.p++]; };
  Parser.prototype.eat = function (v) { const tk = this.k[this.p]; if (tk.t === 'op' && tk.v === v) { this.p++; return true; } return false; };
  Parser.prototype.expect = function (v) { if (!this.eat(v)) throw new Error("atteso '" + v + "'"); };

  Parser.prototype.parse = function () { const r = this.ternary(); if (this.peek().t !== 'eof') throw new Error('token in eccesso'); return r; };
  Parser.prototype.ternary = function () { let c = this.or(); if (this.eat('?')) { const a = this.ternary(); this.expect(':'); const b = this.ternary(); return c ? a : b; } return c; };
  Parser.prototype.or = function () { let l = this.and(); while (this.peek().t === 'op' && this.peek().v === '||') { this.next(); const r = this.and(); l = l || r; } return l; };
  Parser.prototype.and = function () { let l = this.eq(); while (this.peek().t === 'op' && this.peek().v === '&&') { this.next(); const r = this.eq(); l = l && r; } return l; };
  Parser.prototype.eq = function () { let l = this.rel(); while (this.peek().t === 'op' && ['==','!=','===','!=='].indexOf(this.peek().v) !== -1) { const o = this.next().v; const r = this.rel(); l = o === '==' ? (l == r) : o === '!=' ? (l != r) : o === '===' ? (l === r) : (l !== r); } return l; };
  Parser.prototype.rel = function () { let l = this.add(); while (this.peek().t === 'op' && ['<','>','<=','>='].indexOf(this.peek().v) !== -1) { const o = this.next().v; const r = this.add(); l = o === '<' ? (l < r) : o === '>' ? (l > r) : o === '<=' ? (l <= r) : (l >= r); } return l; };
  // WP-M5f (Ismail 2026-07-21): aritmetica sui CARATTERI. `"a" + 1` dava "a1" (concatenazione
  // JS) mentre l'intento didattico e' "il carattere successivo", cioe' "b". La regola e'
  // volutamente STRETTA per non rendere ambiguo il `+` fra stringhe:
  //   - si applica SOLO se un operando e' una stringa di UN SOLO carattere e l'altro un NUMERO;
  //   - "ab" + 1 resta concatenazione ("ab1"), "a" + "b" resta concatenazione ("ab").
  // Cosi' `"a" + 1` e `"a" - 1` fanno quello che ci si aspetta e tutto il resto e' invariato.
  // Per i casi non coperti (o per essere espliciti) restano Asc()/Chr().
  function _isChar1(v) { return typeof v === 'string' && Array.from(v).length === 1; }
  function _charArith(l, r, op) {
    // Solo carattere op numero (e numero + carattere, che e' commutativo solo per '+').
    if (_isChar1(l) && typeof r === 'number' && Number.isInteger(r)) {
      const c = l.codePointAt(0) + (op === '+' ? r : -r);
      if (c < 0 || c > 0x10FFFF) throw new Error('__CHRRANGE__:' + c);
      return String.fromCodePoint(c);
    }
    if (op === '+' && typeof l === 'number' && Number.isInteger(l) && _isChar1(r)) return _charArith(r, l, '+');
    return null; // nessuna regola speciale: il chiamante usa il comportamento normale
  }
  Parser.prototype.add = function () {
    let l = this.mul();
    while (this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      const o = this.next().v; const r = this.mul();
      const special = _charArith(l, r, o);
      l = (special !== null) ? special : (o === '+' ? (l + r) : (l - r));
    }
    return l;
  };
  Parser.prototype.mul = function () { let l = this.unary(); while (this.peek().t === 'op' && ['*','/','%'].indexOf(this.peek().v) !== -1) { const o = this.next().v; const r = this.unary(); if ((o === '/' || o === '%') && Number(r) === 0) throw new Error('__DIV0__'); l = o === '*' ? (l * r) : o === '/' ? (l / r) : (l % r); } return l; };
  Parser.prototype.unary = function () { const tk = this.peek(); if (tk.t === 'op' && (tk.v === '!' || tk.v === '-' || tk.v === '+')) { this.next(); const v = this.unary(); return tk.v === '!' ? !v : tk.v === '-' ? -v : +v; } return this.postfix(this.primary()); };
  // WP-M2 (Ismail 2026-07-20, tipo Array): operatori POSTFISSI su un valore primario --
  // indicizzazione `expr[i]` (solo su array, indice intero in range: __IDXTYPE__/__IDXRANGE__
  // vengono tradotti in messaggi chiari da _evalErrMsg in execute.js) e l'UNICO membro
  // ammesso `.length` (array e stringhe; nessun altro membro: mai un accesso a prototype).
  // opts.laxIndex (usato SOLO dal syntax-check _bfExprSyntaxOk in layout.js, che neutralizza
  // gli identificatori a `1`): l'indicizzazione non valuta davvero, restituisce 1 -- serve a
  // validare la GRAMMATICA di `a[i]` senza conoscere i valori reali.
  Parser.prototype.postfix = function (v) {
    for (;;) {
      const tk = this.peek();
      if (tk.t === 'op' && tk.v === '[') {
        this.next();
        const idx = this.ternary();
        this.expect(']');
        if (this.opts.laxIndex) { v = 1; continue; }
        if (!Array.isArray(v)) throw new Error('__IDXNOTARR__');
        const n = Number(idx);
        if (!Number.isInteger(n)) throw new Error('__IDXTYPE__');
        if (n < 0 || n >= v.length) throw new Error('__IDXRANGE__:' + n + ':' + v.length);
        v = v[n];
        continue;
      }
      if (tk.t === 'op' && tk.v === '.') {
        // Ammesso SOLO `.length` (e solo qui: il ramo Math.* vive in primary e non passa di qua).
        const save = this.p;
        this.next();
        const m = this.peek();
        if (m.t === 'id' && m.v === 'length') {
          this.next();
          if (this.opts.laxIndex) { v = 1; continue; }
          if (Array.isArray(v) || typeof v === 'string') { v = v.length; continue; }
          throw new Error('__IDXNOTARR__');
        }
        this.p = save; // non era .length: lascia decidere/fallire il chiamante (token in eccesso)
        return v;
      }
      return v;
    }
  };
  Parser.prototype.primary = function () {
    const tk = this.next();
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'str') return tk.v;
    if (tk.t === 'op' && tk.v === '(') { const v = this.ternary(); this.expect(')'); return v; }
    // WP-M2 (Ismail 2026-07-20, tipo Array): letterale array [e1, e2, ...] -- ogni elemento
    // e' un'espressione completa (ternary). Usato sia dall'utente ("a = [1,2,3]") sia dalla
    // sostituzione variabili dell'esecutore (_varValueForExpr serializza un array cosi').
    if (tk.t === 'op' && tk.v === '[') {
      const arr = [];
      if (!(this.peek().t === 'op' && this.peek().v === ']')) {
        arr.push(this.ternary());
        while (this.eat(',')) arr.push(this.ternary());
      }
      this.expect(']');
      return arr;
    }
    if (tk.t === 'id') {
      if (tk.v === 'true') return true; if (tk.v === 'false') return false; if (tk.v === 'null') return null;
      if (tk.v === 'Math' && this.peek().t === 'op' && this.peek().v === '.') {
        this.next(); const m = this.next(); if (m.t !== 'id') throw new Error('membro Math non valido');
        if (Object.prototype.hasOwnProperty.call(MATH_CONST, m.v) && !(this.peek().t === 'op' && this.peek().v === '(')) return MATH_CONST[m.v];
        if (!Object.prototype.hasOwnProperty.call(MATH_FN, m.v)) throw new Error('Math.' + m.v + ' non permesso');
        this.expect('('); const args = []; if (!(this.peek().t === 'op' && this.peek().v === ')')) { args.push(this.ternary()); while (this.eat(',')) args.push(this.ternary()); } this.expect(')');
        return Math[m.v].apply(Math, args);
      }
      // WP-M5f (Ismail 2026-07-21, "non riesco a operare con gli ascii: 'a'+1 scrive a1"):
      // due funzioni globali per convertire carattere <-> codice, come in Flowgorithm.
      //   Asc("a") -> 97      Chr(98) -> "b"
      // Sono nell'ALLOWLIST come le Math.*: si aggiunge una capacita' precisa, non un varco
      // per chiamare funzioni arbitrarie (qualunque altro identificatore resta rifiutato).
      if (Object.prototype.hasOwnProperty.call(CHAR_FN, tk.v) && this.peek().t === 'op' && this.peek().v === '(') {
        this.expect('('); const args = [];
        if (!(this.peek().t === 'op' && this.peek().v === ')')) { args.push(this.ternary()); while (this.eat(',')) args.push(this.ternary()); }
        this.expect(')');
        return CHAR_FN[tk.v](args[0]);
      }
      // WP-M5k (Ismail 2026-07-21, "perche' lagga cosi' tanto quando metto istantanea?"):
      // AMBIENTE di valutazione. Finora l'esecutore passava i valori delle variabili
      // INCOLLANDOLI nel testo dell'espressione: per un array significava riscrivere e
      // ri-tokenizzare tutti i suoi elementi ad ogni valutazione -- leggere `a[i]` con `a` da
      // 1000 celle costava 4000 caratteri da generare e riparsare, mille volte in un ciclo.
      // Con `opts.vars` il valore arriva per RIFERIMENTO e l'indicizzazione torna O(1).
      // Resta un ALLOWLIST: si accettano solo i nomi che il chiamante ha messo nell'ambiente.
      if (this.opts.vars && Object.prototype.hasOwnProperty.call(this.opts.vars, tk.v)) return this.opts.vars[tk.v];
      throw new Error('identificatore non permesso: ' + tk.v);
    }
    throw new Error('espressione non valida');
  };

  function safeEvaluate(expr, opts) {
    if (expr === '' || expr === null || expr === undefined) return expr;
    return new Parser(tokenize(expr), opts).parse();
  }
  global.safeEvaluate = safeEvaluate;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
