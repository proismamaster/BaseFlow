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
  // WP-M7 (Ismail 2026-07-21): timestamp corrente in millisecondi, per fare benchmark DENTRO
  // il flowchart (t0 = Millis() ... t1 = Millis(), differenza = tempo del ciclo). Zero
  // argomenti. Nomi multipli per coprire le convenzioni comuni; niente accesso a Date, solo
  // il numero -- resta un valutatore che non tocca oggetti globali.
  const NOARG_FN = { Millis: function () { return Date.now(); }, millis: function () { return Date.now(); },
                     Now: function () { return Date.now(); }, now: function () { return Date.now(); },
                     Timestamp: function () { return Date.now(); }, timestamp: function () { return Date.now(); },
                     random: function () { return Math.random(); }, Random: function () { return Math.random(); } };
  // WP-M7 (Ismail 2026-07-21, benchmark ufficiale di Flogo): pseudo-COSTANTI (identificatore
  // NUDO, senza parentesi) e funzioni che il benchmark usa, per poterlo eseguire identico.
  //   CURRENT_TS -> timestamp corrente (come la nostra Millis(), ma nella forma di Flogo)
  const NOARG_CONST = { CURRENT_TS: function () { return Date.now(); } };
  //   toFixed(x, n) -> stringa con n decimali · end(arr) -> ultimo indice (length-1)
  const MULTI_FN = {
    toFixed: function (x, n) { return Number(x).toFixed(n == null ? 0 : n | 0); },
    end:     function (a) { return (a && a.length ? a.length : 1) - 1; },
    len:     function (a) { return a && a.length ? a.length : 0; },
    length:  function (a) { return a && a.length ? a.length : 0; }
  };

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

  // WP-M7 (Ismail 2026-07-21, "velocizza il mio [interprete]"): il parser COMPILA l'espressione
  // in una CLOSURE `(env) => valore` invece di valutarla durante il parse. Il parsing avviene
  // una volta sola; la closure viene poi richiamata a ogni giro del ciclo con l'ambiente delle
  // variabili corrente. Guadagno: il tokenize + il parse SPARISCONO dal loop caldo, e il motore
  // JS puo' finalmente ottimizzare (JIT) una funzione stabile invece di ri-costruire un albero
  // di oggetti ogni volta. Misurato: `total + i*j` per 1M passi da ~1920ms a poche decine.
  // La SEMANTICA e' identica al vecchio evaluate-while-parse: gli stessi errori (__DIV0__,
  // __IDXRANGE__, aritmetica sui caratteri, ecc.) ora scattano DENTRO la closure, a runtime,
  // perche' dipendono dai valori -- non c'e' nessun `eval`, e' sempre un parser scritto a mano.
  // `env` = l'ambiente delle variabili (l'ex opts.vars): la closure lo riceve come parametro.
  // `opts.laxIndex` e' invece noto a COMPILE-TIME (dipende dalla forma, non dai valori): lo si
  // fissa in fase di compilazione, senza costo a runtime.
  function _isChar1(v) { return typeof v === 'string' && Array.from(v).length === 1; }
  function _charArith(l, r, op) {
    if (_isChar1(l) && typeof r === 'number' && Number.isInteger(r)) {
      const c = l.codePointAt(0) + (op === '+' ? r : -r);
      if (c < 0 || c > 0x10FFFF) throw new Error('__CHRRANGE__:' + c);
      return String.fromCodePoint(c);
    }
    if (op === '+' && typeof l === 'number' && Number.isInteger(l) && _isChar1(r)) return _charArith(r, l, '+');
    return null;
  }
  const _HAS = Object.prototype.hasOwnProperty;

  function Parser(tokens, opts) { this.k = tokens; this.p = 0; this.opts = opts || {}; this.lax = !!(opts && opts.laxIndex); }
  Parser.prototype.peek = function () { return this.k[this.p]; };
  Parser.prototype.next = function () { return this.k[this.p++]; };
  Parser.prototype.eat = function (v) { const tk = this.k[this.p]; if (tk.t === 'op' && tk.v === v) { this.p++; return true; } return false; };
  Parser.prototype.expect = function (v) { if (!this.eat(v)) throw new Error("atteso '" + v + "'"); };

  // Ogni metodo ritorna una funzione (env) => valore.
  Parser.prototype.parse = function () { const f = this.ternary(); if (this.peek().t !== 'eof') throw new Error('token in eccesso'); return f; };
  Parser.prototype.ternary = function () {
    const c = this.or();
    if (this.eat('?')) { const a = this.ternary(); this.expect(':'); const b = this.ternary(); return function (e) { return c(e) ? a(e) : b(e); }; }
    return c;
  };
  Parser.prototype.or = function () {
    let l = this.and();
    while (this.peek().t === 'op' && this.peek().v === '||') { this.next(); const r = this.and(); const L = l; l = function (e) { return L(e) || r(e); }; }
    return l;
  };
  Parser.prototype.and = function () {
    let l = this.eq();
    while (this.peek().t === 'op' && this.peek().v === '&&') { this.next(); const r = this.eq(); const L = l; l = function (e) { return L(e) && r(e); }; }
    return l;
  };
  Parser.prototype.eq = function () {
    let l = this.rel();
    while (this.peek().t === 'op' && ['==','!=','===','!=='].indexOf(this.peek().v) !== -1) {
      const o = this.next().v; const r = this.rel(); const L = l;
      l = o === '==' ? function (e) { return L(e) == r(e); }
        : o === '!=' ? function (e) { return L(e) != r(e); }
        : o === '===' ? function (e) { return L(e) === r(e); }
        : function (e) { return L(e) !== r(e); };
    }
    return l;
  };
  Parser.prototype.rel = function () {
    let l = this.add();
    while (this.peek().t === 'op' && ['<','>','<=','>='].indexOf(this.peek().v) !== -1) {
      const o = this.next().v; const r = this.add(); const L = l;
      l = o === '<' ? function (e) { return L(e) < r(e); }
        : o === '>' ? function (e) { return L(e) > r(e); }
        : o === '<=' ? function (e) { return L(e) <= r(e); }
        : function (e) { return L(e) >= r(e); };
    }
    return l;
  };
  Parser.prototype.add = function () {
    let l = this.mul();
    while (this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      const o = this.next().v; const r = this.mul(); const L = l;
      l = function (e) {
        const a = L(e), b = r(e);
        const special = _charArith(a, b, o);       // aritmetica sui caratteri: a runtime
        return (special !== null) ? special : (o === '+' ? (a + b) : (a - b));
      };
    }
    return l;
  };
  Parser.prototype.mul = function () {
    let l = this.unary();
    while (this.peek().t === 'op' && ['*','/','%'].indexOf(this.peek().v) !== -1) {
      const o = this.next().v; const r = this.unary(); const L = l;
      l = function (e) {
        const a = L(e), b = r(e);
        if ((o === '/' || o === '%') && Number(b) === 0) throw new Error('__DIV0__');
        return o === '*' ? (a * b) : o === '/' ? (a / b) : (a % b);
      };
    }
    return l;
  };
  Parser.prototype.unary = function () {
    const tk = this.peek();
    if (tk.t === 'op' && (tk.v === '!' || tk.v === '-' || tk.v === '+')) {
      this.next(); const v = this.unary(); const op = tk.v;
      return op === '!' ? function (e) { return !v(e); } : op === '-' ? function (e) { return -v(e); } : function (e) { return +v(e); };
    }
    return this.postfix(this.primary());
  };
  Parser.prototype.postfix = function (v) {
    for (;;) {
      const tk = this.peek();
      if (tk.t === 'op' && tk.v === '[') {
        this.next();
        const idx = this.ternary();
        this.expect(']');
        const base = v; const lax = this.lax;
        v = function (e) {
          const arr = base(e);
          if (lax) return 1;
          if (!Array.isArray(arr)) throw new Error('__IDXNOTARR__');
          const n = Number(idx(e));
          if (!Number.isInteger(n)) throw new Error('__IDXTYPE__');
          if (n < 0 || n >= arr.length) throw new Error('__IDXRANGE__:' + n + ':' + arr.length);
          return arr[n];
        };
        continue;
      }
      if (tk.t === 'op' && tk.v === '.') {
        const save = this.p;
        this.next();
        const m = this.peek();
        if (m.t === 'id' && m.v === 'length') {
          this.next();
          const base = v; const lax = this.lax;
          v = function (e) {
            const val = base(e);
            if (lax) return 1;
            if (Array.isArray(val) || typeof val === 'string') return val.length;
            throw new Error('__IDXNOTARR__');
          };
          continue;
        }
        this.p = save;
        return v;
      }
      return v;
    }
  };
  // costante -> closure che ignora env e ritorna sempre lo stesso valore
  function _K(val) { return function () { return val; }; }
  Parser.prototype.primary = function () {
    const tk = this.next();
    if (tk.t === 'num') return _K(tk.v);
    if (tk.t === 'str') return _K(tk.v);
    if (tk.t === 'op' && tk.v === '(') { const v = this.ternary(); this.expect(')'); return v; }
    if (tk.t === 'op' && tk.v === '[') {
      const parts = [];
      if (!(this.peek().t === 'op' && this.peek().v === ']')) {
        parts.push(this.ternary());
        while (this.eat(',')) parts.push(this.ternary());
      }
      this.expect(']');
      return function (e) { const out = new Array(parts.length); for (let i = 0; i < parts.length; i++) out[i] = parts[i](e); return out; };
    }
    if (tk.t === 'id') {
      if (tk.v === 'true') return _K(true); if (tk.v === 'false') return _K(false); if (tk.v === 'null') return _K(null);
      if (tk.v === 'Math' && this.peek().t === 'op' && this.peek().v === '.') {
        this.next(); const m = this.next(); if (m.t !== 'id') throw new Error('membro Math non valido');
        if (_HAS.call(MATH_CONST, m.v) && !(this.peek().t === 'op' && this.peek().v === '(')) return _K(MATH_CONST[m.v]);
        if (!_HAS.call(MATH_FN, m.v)) throw new Error('Math.' + m.v + ' non permesso');
        const fn = Math[m.v]; const args = this._args();
        return function (e) { const a = new Array(args.length); for (let i = 0; i < args.length; i++) a[i] = args[i](e); return fn.apply(Math, a); };
      }
      if (_HAS.call(CHAR_FN, tk.v) && this.peek().t === 'op' && this.peek().v === '(') {
        const fn = CHAR_FN[tk.v]; const args = this._args();
        return function (e) { return fn(args[0] ? args[0](e) : undefined); };
      }
      if (_HAS.call(NOARG_FN, tk.v) && this.peek().t === 'op' && this.peek().v === '(') {
        this.expect('('); this.expect(')'); const fn = NOARG_FN[tk.v];
        return function () { return fn(); };
      }
      if (_HAS.call(NOARG_CONST, tk.v)) { const fn = NOARG_CONST[tk.v]; return function () { return fn(); }; }
      if (_HAS.call(MULTI_FN, tk.v) && this.peek().t === 'op' && this.peek().v === '(') {
        const fn = MULTI_FN[tk.v]; const args = this._args();
        return function (e) { const a = new Array(args.length); for (let i = 0; i < args.length; i++) a[i] = args[i](e); return fn.apply(null, a); };
      }
      // identificatore = variabile: risolta a RUNTIME contro l'ambiente. L'allowlist resta
      // (una variabile non presente nell'env lancia lo stesso errore di prima).
      const name = tk.v;
      return function (e) { if (e && _HAS.call(e, name)) return e[name]; throw new Error('identificatore non permesso: ' + name); };
    }
    throw new Error('espressione non valida');
  };
  // helper: parsa una lista di argomenti fra parentesi e ritorna l'array di closure
  Parser.prototype._args = function () {
    this.expect('('); const args = [];
    if (!(this.peek().t === 'op' && this.peek().v === ')')) { args.push(this.ternary()); while (this.eat(',')) args.push(this.ternary()); }
    this.expect(')');
    return args;
  };

  // Cache di COMPILAZIONE: chiave = espressione + flag laxIndex. Una stessa espressione si
  // compila una volta e la closure si riusa per sempre. Tetto per non crescere all'infinito
  // se un programma genera espressioni tutte diverse (raro, ma la cache non deve essere un leak).
  const _COMPILE_CACHE = new Map();
  const _CACHE_MAX = 2000;
  function safeCompile(expr, opts) {
    const key = (opts && opts.laxIndex ? '1|' : '0|') + expr;
    let fn = _COMPILE_CACHE.get(key);
    if (fn) return fn;
    fn = new Parser(tokenize(String(expr)), opts).parse();
    if (_COMPILE_CACHE.size >= _CACHE_MAX) _COMPILE_CACHE.clear();
    _COMPILE_CACHE.set(key, fn);
    return fn;
  }

  // Compatibilita': safeEvaluate resta l'API di prima (compila+esegue). L'ambiente e' opts.vars
  // come da WP-M5k. Chi valuta in un CICLO dovrebbe invece compilare UNA volta con safeCompile
  // e richiamare la closure -- e' quello che fa ora l'esecutore (execute.js).
  function safeEvaluate(expr, opts) {
    if (expr === '' || expr === null || expr === undefined) return expr;
    return safeCompile(expr, opts)((opts && opts.vars) || null);
  }
  global.safeEvaluate = safeEvaluate;
  global.safeCompile = safeCompile;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
