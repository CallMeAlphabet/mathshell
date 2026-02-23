import { useState, useRef, useEffect, useCallback } from "react";
import { REGISTRY, BUILTINS, HELP_TOPICS } from "./commands/registry.js";
import { mathEval, fmtNum } from "./commands/_utils/format.js";
import { idbOpen, idbPut, idbDelete, idbDeletePrefix, idbLoadAll } from "./idb.js";

// ══════════════════════════════════════════════════════════════════════════════
// VIRTUAL FILE SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

class VFS {
  constructor() {
    this._t = {};
    this._db = null;
    this._mkdirP("/home/user");
    this._mkdirP("/etc");
    this._mkdirP("/tmp");
    this._mkdirP("/bin");
    this._mkdirP("/usr/bin");
    this._mkdirP("/var/log");
    this._wf("/etc/hostname",    "mash\n");
    this._wf("/etc/motd",        "MASH 1.0 — Math & Shell\nA POSIX-like shell with a built-in calculator.\nType 'help' for a list of commands.\nFiles persist across sessions. Type 'wipe-fs' to reset everything.\n");
    this._wf("/etc/os-release",  'NAME="MASH"\nVERSION="1.0"\nID=mash\nPRETTY_NAME="MASH 1.0 (Math And Shell)"\nHOME_URL="https://github.com/"\n');
    this._wf("/etc/passwd",      "root:x:0:0:root:/root:/bin/sh\nuser:x:1000:1000:User:/home/user:/bin/mash\n");
    this._wf("/etc/shells",      "/bin/sh\n/bin/mash\n");
    this._wf("/etc/issue",       "MASH 1.0 \\n \\l\n");
    this._wf("/home/user/README.txt",
      "Welcome to MASH — Math And Shell!\n\nA POSIX-like shell with a built-in math calculator.\nAll standard commands are available. Files persist between sessions.\n\nTry these commands:\n  ls /etc\n  cat /etc/os-release\n  echo hello world\n  math 2^10\n  echo '355/113' | bc\n  seq 1 10 | sort -rn\n  date\n  help\n  help cat\n  help grep\n");
    this._wf("/home/user/.profile", "# MASH profile\nexport PATH=/bin:/usr/bin\nexport EDITOR=nano\nexport TERM=xterm-256color\n");
    this._wf("/home/user/.bashrc", "# MASH interactive shell config\nalias ll='ls -la'\nalias la='ls -a'\nalias ..='cd ..'\nalias ...='cd ../..'\n");
    this._wf("/var/log/shell.log", "");
  }

  _persist(path) { if (!this._db) return; const n = this._t[path]; if (n) idbPut(this._db, path, n).catch(()=>{}); else idbDelete(this._db, path).catch(()=>{}); }
  _del(path)    { if (!this._db) return; idbDelete(this._db, path).catch(()=>{}); }
  _delPrefix(p) { if (!this._db) return; idbDeletePrefix(this._db, p).catch(()=>{}); }

  loadFromIDB(records) { for (const rec of records) { const { path, ...node } = rec; this._t[path] = node; } }

  _mkdirP(path) {
    const parts = path.split("/").filter(Boolean); let cur = "";
    for (const p of parts) { cur += "/" + p; if (!this._t[cur]) { this._t[cur] = { type: "dir", mtime: Date.now(), size: 0 }; this._persist(cur); } }
  }
  _wf(path, content) {
    const parent = path.lastIndexOf("/") > 0 ? path.slice(0, path.lastIndexOf("/")) : "/";
    this._mkdirP(parent);
    this._t[path] = { type: "file", content: String(content), mtime: Date.now(), size: String(content).length };
    this._persist(path);
  }

  resolve(path, cwd = "/home/user") {
    if (!path || path === ".") return cwd;
    if (path === "~") return "/home/user";
    if (path.startsWith("~/")) path = "/home/user" + path.slice(1);
    if (!path.startsWith("/")) path = cwd + "/" + path;
    const parts = path.split("/").filter(Boolean); const r = [];
    for (const p of parts) { if (p === "..") r.pop(); else if (p !== ".") r.push(p); }
    return "/" + r.join("/");
  }

  exists(p) { return p === "/" || p in this._t; }
  isDir(p)  { return p === "/" || this._t[p]?.type === "dir"; }
  isFile(p) { return this._t[p]?.type === "file"; }
  stat(p)   { return p === "/" ? { type: "dir", mtime: Date.now(), size: 0 } : (this._t[p] ?? null); }
  read(p)   { return this.isFile(p) ? this._t[p].content : null; }
  write(p, content) { this._wf(p, content); this._persist(p); }
  append(p, content) {
    if (this.isFile(p)) { this._t[p].content += content; this._t[p].size = this._t[p].content.length; this._t[p].mtime = Date.now(); }
    else this._wf(p, content);
    this._persist(p);
  }
  ls(dir) {
    const prefix = dir === "/" ? "" : dir; const seen = new Set();
    for (const k of Object.keys(this._t)) {
      if (k.startsWith(prefix + "/")) { const rest = k.slice(prefix.length + 1); const name = rest.split("/")[0]; if (name) seen.add(name); }
    }
    return [...seen].sort();
  }
  mkdir(path) {
    if (this.exists(path)) return `mkdir: cannot create directory '${path}': File exists`;
    const parent = path.slice(0, path.lastIndexOf("/")) || "/";
    if (!this.isDir(parent)) return `mkdir: cannot create directory '${path}': No such file or directory`;
    this._t[path] = { type: "dir", mtime: Date.now(), size: 0 }; this._persist(path); return null;
  }
  rmdir(path) {
    if (!this.exists(path)) return `rmdir: failed to remove '${path}': No such file or directory`;
    if (!this.isDir(path))  return `rmdir: failed to remove '${path}': Not a directory`;
    if (this.ls(path).length > 0) return `rmdir: failed to remove '${path}': Directory not empty`;
    delete this._t[path]; this._del(path); return null;
  }
  rm(path, recursive = false) {
    if (!this.exists(path)) return `rm: cannot remove '${path}': No such file or directory`;
    if (this.isDir(path) && !recursive) return `rm: cannot remove '${path}': Is a directory`;
    const keys = Object.keys(this._t).filter(k => k === path || k.startsWith(path + "/"));
    keys.forEach(k => delete this._t[k]);
    this._delPrefix(path); return null;
  }
  cp(src, dst) {
    if (!this.exists(src)) return `cp: cannot stat '${src}': No such file or directory`;
    if (this.isDir(src))   return `cp: omitting directory '${src}'`;
    const dest = this.isDir(dst) ? dst + "/" + src.split("/").pop() : dst;
    const pd = dest.slice(0, dest.lastIndexOf("/")) || "/";
    if (!this.isDir(pd)) return `cp: cannot create '${dest}': No such file or directory`;
    this._t[dest] = { ...this._t[src], mtime: Date.now() }; this._persist(dest); return null;
  }
  mv(src, dst) {
    if (!this.exists(src)) return `mv: cannot stat '${src}': No such file or directory`;
    const dest = this.isDir(dst) ? dst + "/" + src.split("/").pop() : dst;
    Object.keys(this._t).filter(k => k === src || k.startsWith(src + "/")).forEach(k => {
      const nk = dest + k.slice(src.length); this._t[nk] = { ...this._t[k] }; this._persist(nk); delete this._t[k];
    });
    this._delPrefix(src); return null;
  }
  touch(path) {
    if (this.isFile(path)) { this._t[path].mtime = Date.now(); this._persist(path); }
    else this._wf(path, "");
  }
  setDb(db) { this._db = db; }
  download(path) {
    const content = this.read(path); if (content === null) return false;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = path.split("/").pop();
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    return true;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOKENIZER / PARSER
// ══════════════════════════════════════════════════════════════════════════════

function tokenize(input) {
  const tokens = []; let i = 0;
  while (i < input.length) {
    if (input[i] === "#") break;
    if (/\s/.test(input[i])) { i++; continue; }
    if (input[i] === ">" && input[i+1] === ">") { tokens.push({ type: "append" }); i += 2; continue; }
    if (input[i] === "|") { tokens.push({ type: "pipe" }); i++; continue; }
    if (input[i] === ">") { tokens.push({ type: "redir_out" }); i++; continue; }
    if (input[i] === "<") { tokens.push({ type: "redir_in" }); i++; continue; }
    if (input[i] === '"') {
      let s = ""; i++;
      while (i < input.length && input[i] !== '"') { if (input[i] === "\\" && i+1 < input.length) { i++; s += input[i]; } else s += input[i]; i++; }
      i++; tokens.push({ type: "word", value: s }); continue;
    }
    if (input[i] === "'") {
      let s = ""; i++;
      while (i < input.length && input[i] !== "'") s += input[i++];
      i++; tokens.push({ type: "word", value: s, literal: true }); continue;
    }
    let s = "";
    while (i < input.length && !/[\s|<>]/.test(input[i])) { if (input[i] === "\\" && i+1 < input.length) { i++; s += input[i]; } else s += input[i]; i++; }
    if (s) tokens.push({ type: "word", value: s });
  }
  return tokens;
}

function parsePipeline(tokens) {
  const segs = []; let cur = [];
  for (const tok of tokens) { if (tok.type === "pipe") { segs.push(cur); cur = []; } else cur.push(tok); }
  segs.push(cur);
  return segs.map(seg => {
    const words = []; let stdout = null, stdin = null, append = false;
    for (let i = 0; i < seg.length; i++) {
      if (seg[i].type === "append")    { append = true; stdout = seg[i+1]?.value; i++; }
      else if (seg[i].type === "redir_out") { stdout = seg[i+1]?.value; i++; }
      else if (seg[i].type === "redir_in")  { stdin  = seg[i+1]?.value; i++; }
      else if (seg[i].type === "word")      { words.push(seg[i]); }
    }
    return { words, stdout, stdin, append };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SHELL EXECUTOR
// ══════════════════════════════════════════════════════════════════════════════

const MAIN_HELP = `mash — Math And Shell (POSIX-compatible)

FILE & DIRECTORY
  ls [-laFRhSt] [path]    cat [-n] <file>        pwd / cd [dir]
  mkdir [-p] <dir>        rm [-rf] <file>         cp/mv/touch/ln
  find [-name] [-type]    du/df                   stat/chmod/chown

TEXT PROCESSING
  echo [-ne] <text>       printf <fmt>            grep [-vincrwolABC]
  sed 's/p/r/[gi]'        awk [-F] '{}'           sort [-rnufhSkMt]
  uniq [-cdu]             cut -d<d> -f<f>         tr [-dsc]
  head/tail [-n N]        wc [-lwcL]              nl/rev/fold/tac
  tee [-a] <file>         seq/shuf                od/cksum
  diff [-u] f1 f2         paste/comm              expand/unexpand

HASHING / ENCODING
  base64 [-d]             md5sum                  sha256sum/cksum

SHELL & VARIABLES
  VAR=value  export  unset  env  printenv  read  alias  unalias
  test / [   which / type   history         command

MATH
  bc  expr  math <expr>

SYSTEM
  date [+fmt]  uname [-a]  whoami/id  hostname  ps  uptime
  free [-h]    nproc       sleep      chmod/chown  mktemp  timeout

MISC
  clear  motd  download <file>  nano/vi  help [cmd]  man <cmd>
  wipe-fs  write <f> <text>  append <f> <text>

PIPES & REDIRECTION
  cmd | cmd2    cmd > file    cmd >> file    cmd < file    cmd ; cmd2

Type 'help <command>' for detailed help on any command.
`;

function expandVar(str, env) {
  return String(str)
    .replace(/\$\{([a-zA-Z_?][a-zA-Z0-9_]*)\}/g, (_, n) => env[n] ?? "")
    .replace(/\$([a-zA-Z_?][a-zA-Z0-9_]*)/g,     (_, n) => env[n] ?? "");
}

function expandWord(w, env) { return w.literal ? w.value : expandVar(w.value, env); }

function runPipeline(segs, vfs, sh) {
  let pipeIn = null, lastOut = "", lastExit = 0;
  for (let i = 0; i < segs.length; i++) {
    const seg   = segs[i];
    const words = seg.words.map(w => expandWord(w, sh.env));
    const [cmd, ...args] = words;
    let stdinData = pipeIn;
    if (seg.stdin) { const p = vfs.resolve(seg.stdin, sh.cwd); stdinData = vfs.read(p) ?? ""; }

    if (!cmd && seg.stdout) {
      const content = stdinData ?? ""; const p = vfs.resolve(seg.stdout, sh.cwd);
      if (seg.append) vfs.append(p, content); else vfs.write(p, content);
      pipeIn = ""; if (i === segs.length - 1) lastOut = ""; continue;
    }

    const res = execCmd(cmd, args, stdinData, vfs, sh);
    lastOut  = res.output ?? "";
    lastExit = res.exitCode ?? 0;
    sh.env["?"] = String(lastExit);
    if (seg.stdout && !lastOut.startsWith("__")) {
      const p = vfs.resolve(seg.stdout, sh.cwd);
      if (seg.append) vfs.append(p, lastOut); else vfs.write(p, lastOut);
      pipeIn = ""; if (i === segs.length - 1) lastOut = "";
    } else { pipeIn = lastOut; }
  }
  return { output: lastOut, exitCode: lastExit };
}

function execCmd(cmd, args, stdin, vfs, sh) {
  if (!cmd) return { output: "", exitCode: 0 };
  const norm = p => vfs.resolve(p, sh.cwd);

  // VAR=value assignment
  if (/^[a-zA-Z_][a-zA-Z0-9_]*=/.test(cmd) && args.length === 0) {
    const eq = cmd.indexOf("="); sh.env[cmd.slice(0, eq)] = cmd.slice(eq + 1);
    return { output: "", exitCode: 0 };
  }

  // Alias expansion (before registry lookup)
  if (sh.aliases[cmd]) {
    const expanded = sh.aliases[cmd] + (args.length ? " " + args.join(" ") : "");
    return runPipeline(parsePipeline(tokenize(expanded)), vfs, sh);
  }

  // help / man — special-cased here to access MAIN_HELP and HELP_TOPICS
  if (cmd === "help" || cmd === "man") {
    if (args.length && HELP_TOPICS[args[0]]) return { output: HELP_TOPICS[args[0]], exitCode: 0 };
    if (args.length) return { output: `No manual entry for ${args[0]}\nTry 'help' for a list of commands.\n`, exitCode: 1 };
    return { output: MAIN_HELP, exitCode: 0 };
  }

  // Registry dispatch
  const entry = REGISTRY[cmd];
  if (entry) {
    const ctx = { stdin, vfs, sh, env: sh.env, execCmd, runPipeline, parsePipeline, tokenize, registry: REGISTRY };
    try {
      // Handle test/[ bracket alias
      const cmdArgs = cmd === "[" ? args.slice(0, -1) : args;
      return entry.fn(cmdArgs, ctx);
    } catch(e) {
      return { output: `${cmd}: internal error: ${e.message}\n`, exitCode: 1 };
    }
  }

  return { output: `mash: ${cmd}: command not found\n`, exitCode: 127 };
}

// ══════════════════════════════════════════════════════════════════════════════
// EXECUTE INPUT  (handles ; separated commands)
// ══════════════════════════════════════════════════════════════════════════════

function splitBySemicolon(input) {
  const parts=[]; let cur="", inS=false, inD=false;
  for (const c of input) {
    if (c==="'"&&!inD) { inS=!inS; cur+=c; }
    else if (c==='"'&&!inS) { inD=!inD; cur+=c; }
    else if (c===";"&&!inS&&!inD) { if (cur.trim()) parts.push(cur); cur=""; }
    else cur+=c;
  }
  if (cur.trim()) parts.push(cur); return parts;
}

function executeInput(rawInput, vfs, sh) {
  const parts = splitBySemicolon(rawInput); const results = [];
  for (const part of parts) {
    const trimmed = part.trim(); if (!trimmed) continue;
    sh.history.push(trimmed);
    const toks = tokenize(trimmed); if (!toks.length) continue;
    const segs = parsePipeline(toks);
    const res  = runPipeline(segs, vfs, sh);
    results.push(res);
    if (res.output?.startsWith("__CLEAR__") || res.output?.startsWith("__EXIT__") || res.output?.startsWith("__WIPEFS__")) break;
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// REACT APP
// ══════════════════════════════════════════════════════════════════════════════

const KEY_COLORS = {
  num:   { bg: "#111111", fg: "#e8e0d8", border: "#222" },
  op:    { bg: "#0a1a0a", fg: "#5fdd7f", border: "#1a3a1a" },
  fn:    { bg: "#0d0d1e", fg: "#a09cf0", border: "#1a1a38" },
  clear: { bg: "#1c0a0a", fg: "#ff6b6b", border: "#3a1a1a" },
  eq:    { bg: "#0a1f0a", fg: "#4dff7a", border: "#1a4a1a" },
  ans:   { bg: "#081520", fg: "#5cc8f5", border: "#1a3a50" },
  del:   { bg: "#191008", fg: "#f5a840", border: "#352010" },
};

function Key({ label, onClick, kind = "num" }) {
  const [pressed, setPressed] = useState(false);
  const col = KEY_COLORS[kind] || KEY_COLORS.num;
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={e => { e.preventDefault(); setPressed(true); }}
      onTouchEnd={e => { e.preventDefault(); setPressed(false); onClick?.(); }}
      style={{
        background: pressed ? col.bg + "bb" : col.bg,
        color: col.fg, border: `1px solid ${col.border}`,
        borderRadius: "10px", height: "52px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: label.length > 3 ? "11px" : "14px",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transform: pressed ? "scale(0.91)" : "scale(1)", transition: "transform 0.08s",
        userSelect: "none", WebkitUserSelect: "none", outline: "none", letterSpacing: "0.5px",
        boxShadow: pressed ? "inset 0 2px 8px rgba(0,0,0,0.7)" : "inset 0 1px 0 rgba(255,255,255,0.04), 0 3px 8px rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </button>
  );
}

export default function App() {
  const [expr, setExpr]         = useState("");
  const [display, setDisplay]   = useState("0");
  const [isResult, setIsResult] = useState(false);
  const [ans, setAns]           = useState("0");
  const [cliOpen, setCliOpen]   = useState(false);
  const [lines, setLines]       = useState([]);
  const [inp, setInp]           = useState("");
  const [cmdHist, setCmdHist]   = useState([]);
  const [cmdIdx, setCmdIdx]     = useState(-1);
  const [savedFlash, setSavedFlash] = useState(false);
  const [cwd, setCwd]           = useState("/home/user");

  const vfs    = useRef(new VFS());
  const sh     = useRef({ cwd: "/home/user", env: { HOME: "/home/user", USER: "user", PATH: "/bin:/usr/bin", SHELL: "/bin/mash", TERM: "xterm-256color", "?": "0" }, aliases: { ll: "ls -la", la: "ls -a", "..": "cd .." }, history: [] });
  const endRef = useRef(null);
  const inpRef = useRef(null);
  const metaTimer = useRef(null);
  const ansR   = useRef(ans);

  const saveMeta = useCallback((ansOverride) => {
    clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      if (!vfs.current._db) return;
      try {
        await idbPut(vfs.current._db, "__meta__", {
          type: "meta", cwd: sh.current.cwd, env: sh.current.env,
          aliases: sh.current.aliases, history: sh.current.history.slice(-200),
          ans: ansOverride ?? ansR.current, mtime: Date.now(), size: 0,
        });
        setSavedFlash(true); setTimeout(() => setSavedFlash(false), 800);
      } catch(e) { console.warn("meta save failed", e); }
    }, 500);
  }, []);

  useEffect(() => {
    idbOpen().then(db => {
      vfs.current._db = db;
      return idbLoadAll(db);
    }).then(records => {
        if (records && records.length > 0) {
          const meta  = records.find(r => r.path === "__meta__");
          const nodes = records.filter(r => r.path !== "__meta__");
          if (nodes.length > 0) vfs.current.loadFromIDB(nodes);
          if (meta) {
            if (meta.cwd)     sh.current.cwd     = meta.cwd;
            if (meta.env)     sh.current.env     = { ...sh.current.env, ...meta.env };
            if (meta.aliases) sh.current.aliases = meta.aliases;
            if (meta.history) sh.current.history = meta.history;
            if (meta.ans)     { setAns(meta.ans); ansR.current = meta.ans; }
            if (meta.cwd)     setCwd(meta.cwd);
          }
          const motd = vfs.current.read("/etc/motd") || "";
          setLines([{ type: "sys", text: motd.replace(/\n$/,"") + (records.length>1||meta ? "\n[session restored from IndexedDB]" : "") }]);
        } else {
          setLines([{ type: "sys", text: (vfs.current.read("/etc/motd")||"").replace(/\n$/,"") }]);
        }
    }).catch(() => {
      setLines([{ type: "sys", text: (vfs.current.read("/etc/motd")||"").replace(/\n$/,"") }]);
    });
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);
  useEffect(() => { if (cliOpen) setTimeout(() => inpRef.current?.focus(), 350); }, [cliOpen]);

  const exprR  = useRef(expr);    exprR.current  = expr;
  const isResR = useRef(isResult); isResR.current = isResult;
  const dispR  = useRef(display); dispR.current  = display;
  ansR.current = ans;

  const push = useCallback(v => {
    const isOp = /^[+\-*\/^%]$/.test(v);
    if (isResR.current) { const next = isOp ? dispR.current + v : v; setExpr(next); setDisplay(next); setIsResult(false); }
    else setExpr(e => { const n = e + v; setDisplay(n); return n; });
  }, []);

  const doClear = useCallback(() => { setExpr(""); setDisplay("0"); setIsResult(false); }, []);
  const doDel   = useCallback(() => {
    if (isResR.current) { setExpr(""); setDisplay("0"); setIsResult(false); return; }
    setExpr(e => { const n = e.slice(0, -1); setDisplay(n || "0"); return n; });
  }, []);
  const doAns = useCallback(() => {
    const a = ansR.current;
    if (isResR.current) { setExpr(a); setDisplay(a); setIsResult(false); }
    else setExpr(e => { const n = e + a; setDisplay(n); return n; });
  }, []);
  const doEval = useCallback(() => {
    const e = exprR.current; if (!e) return;
    try {
      const r = mathEval(e); const s = fmtNum(r);
      setAns(s); ansR.current = s;
      const existing = vfs.current.read("/home/user/ANS") || "";
      vfs.current.write("/home/user/ANS", existing + s + "\n");
      setDisplay(s); setExpr(s); setIsResult(true);
      saveMeta(s);
    } catch { setDisplay("Error"); setExpr(""); setIsResult(true); }
  }, [saveMeta]);

  useEffect(() => {
    const h = e => {
      if (cliOpen && document.activeElement === inpRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k >= "0" && k <= "9") push(k);
      else if (["+", "-", "*", "/", "(", ")", "."].includes(k)) push(k);
      else if (k === "^") push("^");
      else if (k === "Enter" || k === "=") doEval();
      else if (k === "Backspace") doDel();
      else if (k === "Escape") doClear();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cliOpen, push, doEval, doDel, doClear]);

  const submit = () => {
    const raw = inp.trim(); if (!raw) return;
    setCmdHist(h => [raw, ...h]); setCmdIdx(-1);
    const promptDisplay = sh.current.cwd === "/home/user" ? "~" : sh.current.cwd;
    const newLines = [{ type: "in", text: `${promptDisplay} ❯ ${raw}` }];
    const results = executeInput(raw, vfs.current, sh.current);
    for (const res of results) {
      if (res.output === undefined || res.output === null) continue;
      if (res.output.startsWith("__CLEAR__")) { setLines([{ type: "sys", text: "Terminal cleared." }]); setInp(""); return; }
      if (res.output.startsWith("__WIPEFS__")) {
        (async () => {
          try {
            if (vfs.current._db) {
              await idbDeletePrefix(vfs.current._db, "/");
              await idbDelete(vfs.current._db, "__meta__");
            }
          } catch(e) { console.warn("IDB wipe failed", e); }
          const freshVfs = new VFS(); freshVfs._db = vfs.current._db; vfs.current = freshVfs;
          sh.current = { cwd: "/home/user", env: { HOME: "/home/user", USER: "user", PATH: "/bin:/usr/bin", SHELL: "/bin/mash", TERM: "xterm-256color", "?": "0" }, aliases: { ll: "ls -la", la: "ls -a" }, history: [] };
          setAns("0"); setCmdHist([]); setCwd("/home/user");
          setLines([{ type: "sys", text: "Filesystem wiped. All persisted data cleared." }]); setInp("");
        })();
        return;
      }
      if (res.output.startsWith("__EXIT__")) { const code=parseInt(res.output.slice(8)); newLines.push({ type: "out", text: `[Process exited with code ${code}]` }); break; }
      const text = res.output.replace(/\n$/, "");
      if (text !== "") newLines.push({ type: "out", text });
    }
    setLines(l => [...l, ...newLines]); setInp("");
    setCwd(sh.current.cwd); saveMeta();
  };

  const onKey = e => {
    if (e.key === "Enter") { submit(); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); const ni=Math.min(cmdIdx+1,cmdHist.length-1); setCmdIdx(ni); if (cmdHist[ni]!=null) setInp(cmdHist[ni]); }
    if (e.key === "ArrowDown") { e.preventDefault(); const ni=Math.max(cmdIdx-1,-1); setCmdIdx(ni); setInp(ni===-1?"":cmdHist[ni]??""); }
    if (e.key === "Tab") {
      e.preventDefault();
      const words = inp.split(" "); const last = words[words.length-1];
      if (!last) return;
      if (words.length === 1) {
        const match = [...BUILTINS].filter(b => b.startsWith(last));
        if (match.length === 1) setInp(match[0]);
        else if (match.length > 1) setLines(l => [...l, { type: "out", text: match.join("  ") }]);
      } else {
        const dir   = last.includes("/") ? vfs.current.resolve(last.slice(0, last.lastIndexOf("/")+1), sh.current.cwd) : sh.current.cwd;
        const base  = last.includes("/") ? last.split("/").pop() : last;
        const entries = vfs.current.ls(dir).filter(e => e.startsWith(base));
        if (entries.length === 1) { words[words.length-1]=(last.includes("/")?last.slice(0,last.lastIndexOf("/")+1):"")+entries[0]; setInp(words.join(" ")); }
        else if (entries.length > 1) setLines(l => [...l, { type: "out", text: entries.join("  ") }]);
      }
    }
  };

  const dispLen = display.length;
  const dispFS  = dispLen > 16 ? "14px" : dispLen > 12 ? "20px" : dispLen > 8 ? "26px" : "34px";
  const promptStr = `${cwd === "/home/user" ? "~" : cwd} ❯ `;

  const calcButtons = [
    { l:"C",  kind:"clear", fn:doClear }, { l:"(",  kind:"fn",  fn:()=>push("(") },
    { l:")",  kind:"fn",  fn:()=>push(")") }, { l:"⌫",  kind:"del", fn:doDel },
    { l:"7",  kind:"num", fn:()=>push("7") }, { l:"8",  kind:"num", fn:()=>push("8") },
    { l:"9",  kind:"num", fn:()=>push("9") }, { l:"÷",  kind:"op",  fn:()=>push("/") },
    { l:"4",  kind:"num", fn:()=>push("4") }, { l:"5",  kind:"num", fn:()=>push("5") },
    { l:"6",  kind:"num", fn:()=>push("6") }, { l:"×",  kind:"op",  fn:()=>push("*") },
    { l:"1",  kind:"num", fn:()=>push("1") }, { l:"2",  kind:"num", fn:()=>push("2") },
    { l:"3",  kind:"num", fn:()=>push("3") }, { l:"−",  kind:"op",  fn:()=>push("-") },
    { l:"0",  kind:"num", fn:()=>push("0") }, { l:".",  kind:"num", fn:()=>push(".") },
    { l:"xʸ", kind:"fn",  fn:()=>push("^") }, { l:"+",  kind:"op",  fn:()=>push("+") },
    { l:"ANS",kind:"ans", fn:doAns }, { l:"%",  kind:"fn",  fn:()=>push("%") },
    { l:"√",  kind:"fn",  fn:()=>push("sqrt(") }, { l:"=",  kind:"eq",  fn:doEval },
  ];

  return (
    <div style={{
      minHeight:"100vh", background:"#060608",
      backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 23px,rgba(255,255,255,0.012) 23px,rgba(255,255,255,0.012) 24px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'JetBrains Mono', monospace", overflow:"hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Calculator */}
      <div style={{ width:"290px", transform:cliOpen?"translateY(-100vh)":"translateY(0)", transition:"transform 0.45s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ background:"#030305", border:"1px solid #1a1a20", borderRadius:"14px 14px 0 0", padding:"18px 18px 12px", boxShadow:"inset 0 0 60px rgba(0,0,0,0.8)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px)", pointerEvents:"none" }} />
          <div style={{ color:"#28262e", fontSize:"10px", textAlign:"right", minHeight:"14px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:"10px", letterSpacing:"0.8px", position:"relative" }}>{expr||"·"}</div>
          <div style={{ fontSize:dispFS, fontWeight:"300", color:isResult?"#e8e0d8":"#3d3840", textAlign:"right", minHeight:"48px", display:"flex", alignItems:"center", justifyContent:"flex-end", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-0.5px", position:"relative", textShadow:isResult?"0 0 40px rgba(232,224,216,0.1)":"none", transition:"color 0.12s" }}>{display}</div>
          <div style={{ color:"#15253a", fontSize:"9px", marginTop:"8px", letterSpacing:"2px", position:"relative" }}>ANS <span style={{ color:"#1e3a50" }}>{ans}</span></div>
        </div>
        <div style={{ background:"#0a0a0c", border:"1px solid #1a1a20", borderTop:"none", borderRadius:"0 0 14px 14px", padding:"10px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px", boxShadow:"0 40px 100px rgba(0,0,0,0.95)" }}>
          {calcButtons.map((b,i) => <Key key={i} label={b.l} kind={b.kind} onClick={b.fn} />)}
        </div>
        <button
          onClick={() => setCliOpen(o => !o)}
          style={{ width:"100%", marginTop:"8px", padding:"9px", background:"transparent", border:`1px solid ${cliOpen?"#1a3a1a":"#141418"}`, color:cliOpen?"#22c55e":"#1e2820", fontSize:"9px", fontFamily:"'JetBrains Mono', monospace", cursor:"pointer", borderRadius:"10px", letterSpacing:"3.5px", transition:"all 0.2s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#22c55e";e.currentTarget.style.color="#4ade80";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=cliOpen?"#1a3a1a":"#141418";e.currentTarget.style.color=cliOpen?"#22c55e":"#1e2820";}}
        >{cliOpen?"▲  CLOSE TERMINAL":"▼  OPEN TERMINAL"}</button>
      </div>

      {/* Terminal */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, height:"100vh", background:"#020205", borderTop:"1px solid #0c180c", transform:cliOpen?"translateY(0)":"translateY(100%)", transition:"transform 0.45s cubic-bezier(0.4,0,0.2,1)", display:"flex", flexDirection:"column", fontFamily:"'JetBrains Mono', monospace", zIndex:10 }}>
        <div onClick={()=>setCliOpen(false)} style={{ padding:"7px 16px", background:"#03030a", borderBottom:"1px solid #0a140a", display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", userSelect:"none", flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.background="#050510"} onMouseLeave={e=>e.currentTarget.style.background="#03030a"}>
          <span style={{ width:9, height:9, borderRadius:"50%", background:"#3a1515", display:"inline-block" }} />
          <span style={{ width:9, height:9, borderRadius:"50%", background:"#3a3010", display:"inline-block" }} />
          <span style={{ width:9, height:9, borderRadius:"50%", background:"#10203a", display:"inline-block" }} />
          <span style={{ color:"#1a4a1a", marginLeft:"10px", letterSpacing:"3px", fontSize:"9px" }}>MASH v1.0</span>
          <span style={{ fontSize:"9px", marginLeft:"auto", transition:"color 0.4s", color:savedFlash?"#22c55e":"#0d2010" }}>{savedFlash?"● SAVED":"click to collapse ▲"}</span>
        </div>
        <div style={{ flex:1, overflow:"auto", padding:"10px 16px 4px", lineHeight:"1.7" }}>
          {lines.map((l,i) => <div key={i} style={{ whiteSpace:"pre-wrap", wordBreak:"break-all", color:l.type==="in"?"#86efac":l.type==="sys"?"#1f4525":"#4ade80", marginBottom:"2px", fontSize:"12px" }}>{l.text}</div>)}
          <div ref={endRef} />
        </div>
        <div style={{ padding:"8px 16px", borderTop:"1px solid #0a140a", background:"#03030a", display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
          <span style={{ color:"#1a5020", fontSize:"12px", whiteSpace:"nowrap", flexShrink:0 }}>{promptStr}</span>
          <input ref={inpRef} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={onKey}
            spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
            style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#86efac", fontSize:"12px", fontFamily:"'JetBrains Mono', monospace", caretColor:"#4ade80", minWidth:0 }}
            placeholder="type a command… (Tab to complete, ↑↓ history)"
          />
        </div>
      </div>
    </div>
  );
}
