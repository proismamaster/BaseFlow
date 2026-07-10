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
      if ('+-*/%<>!()?:,.'.includes(ch)) { t.push({ t: 'op', v: ch }); i++; continue; }
      throw new Error('carattere non ammesso: ' + ch);
    }
    t.push({ t: 'eof' }); return t;
  }

  function Parser(tokens) { this.k = tokens; this.p = 0; }
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
  Parser.prototype.add = function () { let l = this.mul(); while (this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) { const o = this.next().v; const r = this.mul(); l = o === '+' ? (l + r) : (l - r); } return l; };
  Parser.prototype.mul = function () { let l = this.unary(); while (this.peek().t === 'op' && ['*','/','%'].indexOf(this.peek().v) !== -1) { const o = this.next().v; const r = this.unary(); l = o === '*' ? (l * r) : o === '/' ? (l / r) : (l % r); } return l; };
  Parser.prototype.unary = function () { const tk = this.peek(); if (tk.t === 'op' && (tk.v === '!' || tk.v === '-' || tk.v === '+')) { this.next(); const v = this.unary(); return tk.v === '!' ? !v : tk.v === '-' ? -v : +v; } return this.primary(); };
  Parser.prototype.primary = function () {
    const tk = this.next();
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'str') return tk.v;
    if (tk.t === 'op' && tk.v === '(') { const v = this.ternary(); this.expect(')'); return v; }
    if (tk.t === 'id') {
      if (tk.v === 'true') return true; if (tk.v === 'false') return false; if (tk.v === 'null') return null;
      if (tk.v === 'Math' && this.peek().t === 'op' && this.peek().v === '.') {
        this.next(); const m = this.next(); if (m.t !== 'id') throw new Error('membro Math non valido');
        if (Object.prototype.hasOwnProperty.call(MATH_CONST, m.v) && !(this.peek().t === 'op' && this.peek().v === '(')) return MATH_CONST[m.v];
        if (!Object.prototype.hasOwnProperty.call(MATH_FN, m.v)) throw new Error('Math.' + m.v + ' non permesso');
        this.expect('('); const args = []; if (!(this.peek().t === 'op' && this.peek().v === ')')) { args.push(this.ternary()); while (this.eat(',')) args.push(this.ternary()); } this.expect(')');
        return Math[m.v].apply(Math, args);
      }
      throw new Error('identificatore non permesso: ' + tk.v);
    }
    throw new Error('espressione non valida');
  };

  function safeEvaluate(expr) {
    if (expr === '' || expr === null || expr === undefined) return expr;
    return new Parser(tokenize(expr)).parse();
  }
  global.safeEvaluate = safeEvaluate;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
