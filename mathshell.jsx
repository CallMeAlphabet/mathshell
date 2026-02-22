import { useState, useRef, useEffect, useCallback } from "react";

// ── MATH ENGINE ──────────────────────────────────────────────────────────────

const factorial = n => {
  n = Math.round(n);
  if (n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

const upArrow = (a, n, b, depth = 0) => {
  if (depth > 500) return Infinity;
  n = Math.round(n); b = Math.round(b);
  if (n <= 1) { const r = Math.pow(a, b); return isFinite(r) ? r : Infinity; }
  if (b === 0) return 1;
  if (b === 1) return a;
  const prev = upArrow(a, n, b - 1, depth + 1);
  if (!isFinite(prev) || prev > 65536) return Infinity;
  return upArrow(a, n - 1, prev, depth + 1);
};

function mathEval(expr, vars = {}) {
  let p = expr.trim();
  Object.entries(vars).forEach(([k, v]) => {
    p = p.replace(new RegExp(`\\b${k}\\b`, 'g'), `(${v})`);
  });
  p = p.replace(/π/g, '(Math.PI)').replace(/\bpi\b/gi, '(Math.PI)');
  p = p
    .replace(/\bsin\b/g, 'Math.sin').replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan').replace(/\basin\b/g, 'Math.asin')
    .replace(/\bacos\b/g, 'Math.acos').replace(/\batan\b/g, 'Math.atan')
    .replace(/\bsinh\b/g, 'Math.sinh').replace(/\bcosh\b/g, 'Math.cosh')
    .replace(/\btanh\b/g, 'Math.tanh').replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\bcbrt\b/g, 'Math.cbrt').replace(/\bfloor\b/g, 'Math.floor')
    .replace(/\bceil\b/g, 'Math.ceil').replace(/\babs\b/g, 'Math.abs')
    .replace(/\bround\b/g, 'Math.round').replace(/\bsign\b/g, 'Math.sign')
    .replace(/\bln\b/g, 'Math.log').replace(/\blog\b/g, 'Math.log10')
    .replace(/\bmod\b/gi, '%');
  p = p.replace(/(?<![a-zA-Z\d_])e(?![a-zA-Z\d_])/g, '(Math.E)');
  p = p.replace(/(\d+(?:\.\d+)?)\s*!/g, 'factorial($1)');
  let prev = '';
  while (prev !== p) { prev = p; p = p.replace(/([\d.]+)\{(\d+)\}([\d.]+)/g, 'upArrow($1,$2,$3)'); }
  p = p.replace(/\^/g, '**');
  return new Function('factorial', 'upArrow', `"use strict"; return (${p});`)(factorial, upArrow);
}

function fmt(n) {
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "-∞";
  if (isNaN(n)) return "Error";
  if (Math.abs(n) >= 1e15) return n.toExponential(6);
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

// ── VIRTUAL FILE SYSTEM ───────────────────────────────────────────────────────

class VFS {
  constructor() { this.f = {}; }
  write(n, c) { this.f[n] = String(c); }
  read(n) { return this.f[n] ?? null; }
  list() { return Object.keys(this.f); }
  rm(n) { const e = n in this.f; if (e) delete this.f[n]; return e; }
  dl(name) {
    const c = this.read(name);
    if (!c) return false;
    const b = new Blob([c], { type: 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(u);
    return true;
  }
}

// ── CLI PROCESSOR ─────────────────────────────────────────────────────────────

const HELP = `MathShell — commands & syntax

  ls                   list files
  cat <file>           read a file
  rm <file>            delete a file
  download <file>      download a file
  vars                 show variables
  clear                clear terminal

  Expressions:
    3 + 3 * 2          arithmetic
    2^10               exponentiation
    3{2}3              3^^3  (tetration)
    3{3}3              3^^^3 → ∞
    10!                factorial
    sin(pi/2)          →  1
    floor(e^2)         floored

  Variables:
    x = 42             assign
    x + 8              →  50
    _                  last result

  Pipes:
    3+3 | *2           →  12
    3+3 | +_           →  12
    3+3 | >out.txt     save to file
    3+3 | >>out.txt    append to file

  ANS is always appended to /ANS automatically.`;

function runCmd(raw, vfs, vars, setVars) {
  const r = raw.trim();
  if (!r) return null;
  if (r === 'help') return HELP;
  if (r === 'clear') return '__CLEAR__';
  if (r === 'vars') {
    const e = Object.entries(vars);
    return e.length ? e.map(([k, v]) => `${k} = ${v}`).join('\n') : '(no variables)';
  }
  if (r === 'ls') {
    const f = vfs.list();
    return f.length ? f.join('   ') : '(empty)';
  }
  if (r.startsWith('cat ')) {
    const n = r.slice(4).trim();
    const c = vfs.read(n);
    return c === null ? `cat: ${n}: not found` : c;
  }
  if (r.startsWith('rm ')) {
    const n = r.slice(3).trim();
    return vfs.rm(n) ? `removed ${n}` : `rm: ${n}: not found`;
  }
  if (r.startsWith('download ')) {
    const n = r.slice(9).trim();
    return vfs.dl(n) ? `⬇  downloading ${n}…` : `not found: ${n}`;
  }
  const am = r.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
  if (am && !r.includes('|')) {
    try {
      const v = mathEval(am[2], vars);
      const s = fmt(v);
      setVars(p => ({ ...p, [am[1]]: s }));
      return `${am[1]} = ${s}`;
    } catch (e) { return `Error: ${e.message}`; }
  }
  if (r.includes('|')) {
    const parts = r.split('|');
    let acc, as;
    try { acc = mathEval(parts[0].trim(), vars); as = fmt(acc); }
    catch (e) { return `Error: ${e.message}`; }
    for (let i = 1; i < parts.length; i++) {
      const pt = parts[i].trim();
      if (pt.startsWith('>>')) { const fn = pt.slice(2).trim(); vfs.write(fn, (vfs.read(fn) || '') + '\n' + as); return `appended → ${fn}`; }
      if (pt.startsWith('>')) { const fn = pt.slice(1).trim(); vfs.write(fn, as); return `saved "${as}" → ${fn}`; }
      let pe = pt;
      if (/^[+\-*\/%^]/.test(pt)) pe = `(${as})${pt}`;
      else pe = pt.replace(/_/g, `(${as})`);
      try { acc = mathEval(pe, { ...vars, _: as }); as = fmt(acc); }
      catch (e) { return `pipe error: ${e.message}`; }
    }
    return as;
  }
  try { return fmt(mathEval(r, vars)); }
  catch (e) { return `Error: ${e.message}`; }
}

// ── BUTTON ────────────────────────────────────────────────────────────────────

function Btn({ label, onClick, bg = '#161616', fg = '#d4ccc5', fontSize = '13px' }) {
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onMouseLeave={() => setActive(false)}
      style={{
        background: active ? `${bg}bb` : bg,
        color: fg, border: 'none',
        borderRadius: '8px', padding: '14px 4px',
        fontFamily: 'JetBrains Mono, monospace', fontSize,
        cursor: 'pointer',
        transform: active ? 'scale(0.93)' : 'scale(1)',
        transition: 'transform 0.07s, filter 0.1s',
        outline: 'none', userSelect: 'none',
        boxShadow: active
          ? 'inset 0 2px 6px rgba(0,0,0,0.6)'
          : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 4px rgba(0,0,0,0.5)',
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.7)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; setActive(false); }}
    >{label}</button>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [expr, setExpr] = useState('');
  const [display, setDisplay] = useState('0');
  const [isResult, setIsResult] = useState(false);
  const [ans, setAns] = useState('0');
  const [cliOpen, setCliOpen] = useState(false);
  const [hist, setHist] = useState([{ t: 'sys', s: 'MathShell v1.0 — type "help" for commands' }]);
  const [inp, setInp] = useState('');
  const [cmdHist, setCmdHist] = useState([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [vars, setVars] = useState({});
  const vfs = useRef(new VFS());
  const endRef = useRef(null);
  const inpRef = useRef(null);
  const exprRef = useRef(expr);
  exprRef.current = expr;
  const isResultRef = useRef(isResult);
  isResultRef.current = isResult;
  const displayRef = useRef(display);
  displayRef.current = display;
  const ansRef = useRef(ans);
  ansRef.current = ans;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [hist]);
  useEffect(() => { if (cliOpen) setTimeout(() => inpRef.current?.focus(), 350); }, [cliOpen]);

  const ap = useCallback(v => {
    const isOp = ['+', '-', '*', '/', '^', '%'].includes(v);
    if (isResultRef.current) {
      if (isOp) {
        const ne = displayRef.current + v;
        setExpr(ne); setDisplay(ne);
      } else {
        setExpr(v); setDisplay(v);
      }
      setIsResult(false);
    } else {
      setExpr(ex => { const ne = ex + v; setDisplay(ne); return ne; });
    }
  }, []);

  const doBs = useCallback(() => {
    if (isResultRef.current) { setExpr(''); setDisplay('0'); setIsResult(false); return; }
    setExpr(ex => { const ne = ex.slice(0, -1); setDisplay(ne || '0'); return ne; });
  }, []);

  const doClear = useCallback(() => {
    setExpr(''); setDisplay('0'); setIsResult(false);
  }, []);

  const insertAns = useCallback(() => {
    const a = ansRef.current;
    if (isResultRef.current) { setExpr(a); setDisplay(a); setIsResult(false); }
    else { setExpr(ex => { const ne = ex + a; setDisplay(ne); return ne; }); }
  }, []);

  const doEval = useCallback(() => {
    const e = exprRef.current;
    if (!e || e === '0') return;
    try {
      const r = mathEval(e, vars);
      const s = fmt(r);
      setAns(s);
      setVars(v => ({ ...v, _: s }));
      // Append to /ANS file
      const existing = vfs.current.read('ANS') || '';
      const lines = existing ? existing.split('\n').filter(Boolean) : [];
      lines.push(s);
      vfs.current.write('ANS', lines.join('\n'));
      setDisplay(s); setExpr(s); setIsResult(true);
    } catch {
      setDisplay('Error'); setExpr(''); setIsResult(true);
    }
  }, [vars]);

  // Keyboard support
  useEffect(() => {
    const h = e => {
      if (cliOpen && document.activeElement === inpRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k >= '0' && k <= '9') ap(k);
      else if (['+', '-', '*', '/', '(', ')', '.', '^'].includes(k)) ap(k);
      else if (k === 'Enter') doEval();
      else if (k === 'Backspace') doBs();
      else if (k === 'Escape') doClear();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cliOpen, ap, doEval, doBs, doClear]);

  // CLI
  const submit = () => {
    if (!inp.trim()) return;
    const i = inp.trim();
    setCmdHist(h => [i, ...h]); setCmdIdx(-1);
    const out = runCmd(i, vfs.current, vars, setVars);
    if (out === '__CLEAR__') { setHist([{ t: 'sys', s: 'cleared.' }]); setInp(''); return; }
    const ne = [{ t: 'in', s: i }];
    if (out) ne.push({ t: 'out', s: out });
    setHist(h => [...h, ...ne]); setInp('');
  };

  const onKey = e => {
    if (e.key === 'Enter') { submit(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const ni = Math.min(cmdIdx + 1, cmdHist.length - 1);
      setCmdIdx(ni); if (cmdHist[ni]) setInp(cmdHist[ni]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const ni = Math.max(cmdIdx - 1, -1);
      setCmdIdx(ni); setInp(ni === -1 ? '' : cmdHist[ni] || '');
    }
  };

  // Button colour palette — all fg values are bright and legible
  const C = {
    num:  { bg: '#161616', fg: '#ede5dc' },
    op:   { bg: '#0e1a0e', fg: '#7ddd9c' },
    fn:   { bg: '#10101e', fg: '#c0b8ff' },
    spec: { bg: '#1e0d0d', fg: '#ff8888' },
    arr:  { bg: '#1c1200', fg: '#ffca7a' },
    eq:   { bg: '#0b1f0b', fg: '#5dff80' },
    ans:  { bg: '#0a1520', fg: '#60d0ff' },
    dim:  { bg: '#141414', fg: '#9a97a2' },
  };

  const rows = [
    [
      { l: 'C',     fn: doClear,           ...C.spec },
      { l: '(',     fn: () => ap('('),     ...C.dim  },
      { l: ')',     fn: () => ap(')'),     ...C.dim  },
      { l: '⌫',    fn: doBs,              ...C.dim  },
    ],
    [
      { l: 'sin',   fn: () => ap('sin('), ...C.fn },
      { l: 'cos',   fn: () => ap('cos('), ...C.fn },
      { l: 'tan',   fn: () => ap('tan('), ...C.fn },
      { l: '÷',     fn: () => ap('/'),    ...C.op },
    ],
    [
      { l: '7', fn: () => ap('7'), ...C.num },
      { l: '8', fn: () => ap('8'), ...C.num },
      { l: '9', fn: () => ap('9'), ...C.num },
      { l: '×', fn: () => ap('*'), ...C.op  },
    ],
    [
      { l: '4', fn: () => ap('4'), ...C.num },
      { l: '5', fn: () => ap('5'), ...C.num },
      { l: '6', fn: () => ap('6'), ...C.num },
      { l: '−', fn: () => ap('-'), ...C.op  },
    ],
    [
      { l: '1', fn: () => ap('1'), ...C.num },
      { l: '2', fn: () => ap('2'), ...C.num },
      { l: '3', fn: () => ap('3'), ...C.num },
      { l: '+', fn: () => ap('+'), ...C.op  },
    ],
    [
      { l: '0',   fn: () => ap('0'),      ...C.num },
      { l: '.',   fn: () => ap('.'),      ...C.num },
      { l: 'xʸ', fn: () => ap('^'),      ...C.fn  },
      { l: '=',   fn: doEval,             ...C.eq  },
    ],
    [
      { l: 'ANS', fn: insertAns,          ...C.ans },
      { l: 'n!',  fn: () => ap('!'),      ...C.fn  },
      { l: 'π',   fn: () => ap('π'),      ...C.fn  },
      { l: '√',   fn: () => ap('sqrt('),  ...C.fn  },
    ],
    [
      { l: '↑↑',  fn: () => ap('{2}'),   ...C.arr },
      { l: '↑↑↑', fn: () => ap('{3}'),   ...C.arr, fontSize: '11px' },
      { l: 'mod', fn: () => ap(' mod '),  ...C.arr },
      { l: 'log', fn: () => ap('log('),   ...C.fn  },
    ],
  ];

  const dispFontSize = display.length > 14 ? '18px' : display.length > 9 ? '24px' : '32px';

  return (
    <div style={{
      minHeight: '100vh', background: '#070707',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.007) 3px,rgba(255,255,255,0.007) 4px)',
      overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* ── CALCULATOR ── */}
      <div style={{
        width: '300px',
        transform: cliOpen ? 'translateY(-23vh)' : 'translateY(0)',
        transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Display */}
        <div style={{
          background: '#040404', border: '1px solid #1c1c1c',
          borderRadius: '12px 12px 0 0', padding: '14px 16px 14px',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)',
        }}>
          {/* Expression line */}
          <div style={{
            color: '#2e2a26', fontSize: '11px', textAlign: 'right',
            minHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', marginBottom: '8px', letterSpacing: '0.5px',
          }}>
            {isResult ? expr : (expr || '·')}
          </div>

          {/* Big display */}
          <div style={{
            color: isResult ? '#ede5dc' : '#5a5450',
            fontSize: dispFontSize, textAlign: 'right', minHeight: '46px',
            fontWeight: '300', letterSpacing: '-1px',
            textShadow: isResult ? '0 0 30px rgba(237,229,220,0.1)' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.1s, font-size 0.1s',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          }}>
            {display}
          </div>

          {/* ANS indicator */}
          <div style={{
            color: '#1a3848', fontSize: '10px', textAlign: 'left',
            marginTop: '6px', letterSpacing: '2px',
          }}>
            ANS: <span style={{ color: '#1e4a60' }}>{ans}</span>
          </div>
        </div>

        {/* Button grid */}
        <div style={{
          background: '#0c0c0c', border: '1px solid #1c1c1c', borderTop: 'none',
          borderRadius: '0 0 12px 12px', padding: '8px',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '5px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
        }}>
          {rows.map((row, i) => row.map((b, j) => (
            <Btn key={`${i}-${j}`} label={b.l} onClick={b.fn}
              bg={b.bg} fg={b.fg} fontSize={b.fontSize || '13px'} />
          )))}
        </div>

        {/* Terminal toggle button */}
        <button
          onClick={() => setCliOpen(o => !o)}
          style={{
            width: '100%', marginTop: '7px', padding: '8px',
            background: 'transparent',
            border: `1px solid ${cliOpen ? '#1c4a1c' : '#1c1c1c'}`,
            color: cliOpen ? '#22c55e' : '#2c4a2c',
            fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
            cursor: 'pointer', borderRadius: '8px',
            transition: 'all 0.2s', letterSpacing: '3px',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#4ade80'; }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = cliOpen ? '#1c4a1c' : '#1c1c1c';
            e.currentTarget.style.color = cliOpen ? '#22c55e' : '#2c4a2c';
          }}
        >
          {cliOpen ? '▲  CLOSE  TERMINAL' : '▼  OPEN  TERMINAL'}
        </button>
      </div>

      {/* ── CLI PANEL ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '46vh',
        background: '#030305', borderTop: '1px solid #0c1e0c',
        transform: cliOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'JetBrains Mono, monospace', zIndex: 10,
      }}>
        {/* Clickable header — collapses terminal */}
        <div
          onClick={() => setCliOpen(false)}
          title="Click to collapse"
          onMouseEnter={e => e.currentTarget.style.background = '#06060a'}
          onMouseLeave={e => e.currentTarget.style.background = '#040407'}
          style={{
            padding: '6px 16px', borderBottom: '1px solid #0a1a0a',
            background: '#040407', display: 'flex', alignItems: 'center', gap: '7px',
            cursor: 'pointer', transition: 'background 0.15s',
            userSelect: 'none',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a1a1a', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a4a1a', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a2a4a', display: 'inline-block' }} />
          <span style={{ color: '#1a5a1a', fontSize: '10px', marginLeft: '8px', letterSpacing: '2.5px' }}>MATHSHELL v1.0</span>
          <span style={{ color: '#0d2a0d', fontSize: '10px', marginLeft: 'auto', letterSpacing: '1px' }}>click to collapse ▲</span>
        </div>

        {/* Output area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px' }}>
          {hist.map((h, i) => (
            <div key={i} style={{
              fontSize: '12px', lineHeight: '1.75',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              color: h.t === 'in' ? '#86efac' : h.t === 'sys' ? '#1a4020' : '#4ade80',
              marginBottom: h.t === 'in' ? '0' : '6px',
            }}>
              {h.t === 'in' && <span style={{ color: '#1a5a1a', marginRight: '8px' }}>$</span>}
              {h.s}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input row */}
        <div style={{
          padding: '8px 16px', borderTop: '1px solid #0a1a0a',
          background: '#040407', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ color: '#1a5a1a', fontSize: '13px' }}>$</span>
          <input
            ref={inpRef}
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#86efac', fontSize: '13px',
              fontFamily: 'JetBrains Mono, monospace',
              caretColor: '#4ade80',
            }}
            placeholder="3+3 | *2 | >result.txt"
          />
        </div>
      </div>
    </div>
  );
}
