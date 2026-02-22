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
  // Substitute variables
  Object.entries(vars).forEach(([k, v]) => {
    p = p.replace(new RegExp(`\\b${k}\\b`, 'g'), `(${v})`);
  });
  // Constants
  p = p.replace(/π/g, '(Math.PI)').replace(/\bpi\b/gi, '(Math.PI)');
  // Functions (before standalone e replacement)
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
  // Standalone e (not in scientific notation or variable names)
  p = p.replace(/(?<![a-zA-Z\d_])e(?![a-zA-Z\d_])/g, '(Math.E)');
  // Factorial: n!
  p = p.replace(/(\d+(?:\.\d+)?)\s*!/g, 'factorial($1)');
  // Up-arrows: a{n}b → upArrow(a,n,b)
  let prev = '';
  while (prev !== p) { prev = p; p = p.replace(/([\d.]+)\{(\d+)\}([\d.]+)/g, 'upArrow($1,$2,$3)'); }
  // Exponent
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
    3{3}3              3^^^3 (pentation) → ∞
    10!                factorial
    sin(pi/2)          trig  →  1
    floor(e^2)         e squared floored

  Variables:
    x = 42             assign
    x + 8              use it  →  50
    _                  last result

  Pipes:
    3+3 | *2           →  12
    3+3 | +_           →  12  (_ = piped value)
    3+3 | >out.txt     save result to file
    3+3 | >>out.txt    append to file`;

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

  // Assignment (no pipe)
  const am = r.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
  if (am && !r.includes('|')) {
    try {
      const v = mathEval(am[2], vars);
      const s = fmt(v);
      setVars(p => ({ ...p, [am[1]]: s }));
      return `${am[1]} = ${s}`;
    } catch (e) { return `Error: ${e.message}`; }
  }

  // Pipe chain
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

  // Plain expression
  try { return fmt(mathEval(r, vars)); }
  catch (e) { return `Error: ${e.message}`; }
}

// ── BUTTON COMPONENT ──────────────────────────────────────────────────────────

function Btn({ label, onClick, bg = '#161616', fg = '#b0a89e', span = 1 }) {
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onMouseLeave={() => setActive(false)}
      style={{
        background: active ? `${bg}dd` : bg,
        color: fg, border: 'none',
        borderRadius: '8px', padding: '14px 4px',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
        cursor: 'pointer', gridColumn: `span ${span}`,
        transform: active ? 'scale(0.93)' : 'scale(1)',
        transition: 'transform 0.07s, filter 0.1s',
        outline: 'none', userSelect: 'none',
        boxShadow: active
          ? 'inset 0 2px 6px rgba(0,0,0,0.6)'
          : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.5)',
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.6)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
    >{label}</button>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [expr, setExpr] = useState('');
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

  // Scroll CLI to bottom
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [hist]);

  // Focus CLI input when opened
  useEffect(() => { if (cliOpen) setTimeout(() => inpRef.current?.focus(), 350); }, [cliOpen]);

  // Live preview
  useEffect(() => {
    if (!expr) { setPreview(''); return; }
    try { setPreview(fmt(mathEval(expr, vars))); } catch { setPreview(''); }
  }, [expr, vars]);

  // Keyboard handler for calculator
  useEffect(() => {
    const h = (e) => {
      if (cliOpen && document.activeElement === inpRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k >= '0' && k <= '9') { setExpr(ex => ex + k); }
      else if (['+', '-', '*', '/', '(', ')', '.', '^'].includes(k)) { setExpr(ex => ex + k); }
      else if (k === 'Enter') { evalExpr(); }
      else if (k === 'Backspace') { setExpr(ex => ex.slice(0, -1)); }
      else if (k === 'Escape') { setExpr(''); setPreview(''); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cliOpen, vars]);

  const ap = v => setExpr(e => e + v);
  const bs = () => setExpr(e => e.slice(0, -1));
  const clr = () => { setExpr(''); setPreview(''); };

  const evalExpr = useCallback(() => {
    const e = exprRef.current;
    if (!e) return;
    try {
      const r = mathEval(e, vars);
      const s = fmt(r);
      setVars(v => ({ ...v, _: s }));
      setExpr(s); setPreview('');
    } catch { setExpr('Error'); }
  }, [vars]);

  // CLI submit
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

  // Button layout
  const rows = [
    [
      { l: 'C', fn: clr, bg: '#1a0e0e', fg: '#f87171' },
      { l: '(', fn: () => ap('('), bg: '#141414', fg: '#94a3b8' },
      { l: ')', fn: () => ap(')'), bg: '#141414', fg: '#94a3b8' },
      { l: '⌫', fn: bs, bg: '#141414', fg: '#64748b' },
    ],
    [
      { l: 'sin', fn: () => ap('sin('), bg: '#10101c', fg: '#a5b4fc' },
      { l: 'cos', fn: () => ap('cos('), bg: '#10101c', fg: '#a5b4fc' },
      { l: 'tan', fn: () => ap('tan('), bg: '#10101c', fg: '#a5b4fc' },
      { l: '÷', fn: () => ap('/'), bg: '#0e160e', fg: '#86efac' },
    ],
    [
      { l: '7', fn: () => ap('7') }, { l: '8', fn: () => ap('8') }, { l: '9', fn: () => ap('9') },
      { l: '×', fn: () => ap('*'), bg: '#0e160e', fg: '#86efac' },
    ],
    [
      { l: '4', fn: () => ap('4') }, { l: '5', fn: () => ap('5') }, { l: '6', fn: () => ap('6') },
      { l: '−', fn: () => ap('-'), bg: '#0e160e', fg: '#86efac' },
    ],
    [
      { l: '1', fn: () => ap('1') }, { l: '2', fn: () => ap('2') }, { l: '3', fn: () => ap('3') },
      { l: '+', fn: () => ap('+'), bg: '#0e160e', fg: '#86efac' },
    ],
    [
      { l: '0', fn: () => ap('0') }, { l: '.', fn: () => ap('.') },
      { l: 'xʸ', fn: () => ap('^'), bg: '#101018', fg: '#c4b5fd' },
      { l: '=', fn: evalExpr, bg: '#0c1c0c', fg: '#4ade80' },
    ],
    [
      { l: 'n!', fn: () => ap('!'), bg: '#10101a', fg: '#818cf8' },
      { l: 'π', fn: () => ap('π'), bg: '#10101a', fg: '#818cf8' },
      { l: '√', fn: () => ap('sqrt('), bg: '#10101a', fg: '#818cf8' },
      { l: 'log', fn: () => ap('log('), bg: '#10101a', fg: '#818cf8' },
    ],
    [
      { l: '↑↑', fn: () => ap('{2}'), bg: '#160e06', fg: '#fb923c' },
      { l: '↑↑↑', fn: () => ap('{3}'), bg: '#160e06', fg: '#fb923c' },
      { l: 'mod', fn: () => ap(' mod '), bg: '#160e06', fg: '#fbbf24' },
      { l: 'ln', fn: () => ap('ln('), bg: '#10101a', fg: '#818cf8' },
    ],
  ];

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
          background: '#040404', border: '1px solid #1a1a1a',
          borderRadius: '12px 12px 0 0', padding: '14px 16px 18px',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)',
        }}>
          <div style={{
            color: '#2a2520', fontSize: '11px', textAlign: 'right',
            minHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', marginBottom: '8px', letterSpacing: '0.5px',
          }}>
            {expr || '·'}
          </div>
          <div style={{
            color: preview ? '#e8ddd0' : '#3a3530',
            fontSize: '32px', textAlign: 'right', minHeight: '46px',
            fontWeight: '300', letterSpacing: '-1px',
            textShadow: preview ? '0 0 30px rgba(232,221,208,0.15)' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s',
          }}>
            {preview || (expr ? '…' : '0')}
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          background: '#0c0c0c', border: '1px solid #1a1a1a', borderTop: 'none',
          borderRadius: '0 0 12px 12px', padding: '8px',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '5px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
        }}>
          {rows.map((row, i) => row.map((b, j) => (
            <Btn key={`${i}-${j}`} label={b.l} onClick={b.fn} bg={b.bg} fg={b.fg} />
          )))}
        </div>

        {/* CLI toggle */}
        <button
          onClick={() => setCliOpen(o => !o)}
          style={{
            width: '100%', marginTop: '7px', padding: '8px',
            background: 'transparent',
            border: `1px solid ${cliOpen ? '#1a3d1a' : '#1a1a1a'}`,
            color: cliOpen ? '#22c55e' : '#1e3a1e',
            fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
            cursor: 'pointer', borderRadius: '8px',
            transition: 'all 0.2s', letterSpacing: '3px',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#4ade80'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = cliOpen ? '#1a3d1a' : '#1a1a1a'; e.currentTarget.style.color = cliOpen ? '#22c55e' : '#1e3a1e'; }}
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
        {/* Header */}
        <div style={{
          padding: '6px 16px', borderBottom: '1px solid #0a1a0a',
          background: '#040407', display: 'flex', alignItems: 'center', gap: '7px',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a3a1a', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2a2a0a', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1a2a', display: 'inline-block' }} />
          <span style={{ color: '#1a4a1a', fontSize: '10px', marginLeft: '8px', letterSpacing: '2.5px' }}>MATHSHELL v1.0</span>
          <span style={{ color: '#0d2a0d', fontSize: '10px', marginLeft: 'auto', letterSpacing: '1px' }}>pipes · vfs · up-arrows</span>
        </div>

        {/* Output */}
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

        {/* Input */}
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
