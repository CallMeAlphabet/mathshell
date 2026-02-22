import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// MATH ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const factorial = n => {
  n = Math.round(n);
  if (n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
};

function mathEval(expr) {
  let p = expr.trim()
    .replace(/π/g, "(Math.PI)").replace(/\bpi\b/gi, "(Math.PI)")
    .replace(/\bsin\b/g, "Math.sin").replace(/\bcos\b/g, "Math.cos")
    .replace(/\btan\b/g, "Math.tan").replace(/\basin\b/g, "Math.asin")
    .replace(/\bacos\b/g, "Math.acos").replace(/\batan\b/g, "Math.atan")
    .replace(/\bsinh\b/g, "Math.sinh").replace(/\bcosh\b/g, "Math.cosh")
    .replace(/\btanh\b/g, "Math.tanh").replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\bcbrt\b/g, "Math.cbrt").replace(/\bfloor\b/g, "Math.floor")
    .replace(/\bceil\b/g, "Math.ceil").replace(/\babs\b/g, "Math.abs")
    .replace(/\bround\b/g, "Math.round").replace(/\bsign\b/g, "Math.sign")
    .replace(/\bln\b/g, "Math.log").replace(/\blog2\b/g, "Math.log2")
    .replace(/\blog\b/g, "Math.log10").replace(/\bmax\b/g, "Math.max")
    .replace(/\bmin\b/g, "Math.min").replace(/\bpow\b/g, "Math.pow");
  p = p.replace(/(?<![a-zA-Z\d_])e(?![a-zA-Z\d_])/g, "(Math.E)");
  p = p.replace(/(\d+(?:\.\d+)?)\s*!/g, "factorial($1)");
  p = p.replace(/\^/g, "**");
  return new Function("factorial", `"use strict"; return (${p});`)(factorial);
}

function fmtNum(n) {
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "-∞";
  if (isNaN(n)) return "NaN";
  if (Math.abs(n) >= 1e15) return n.toExponential(8);
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

// ══════════════════════════════════════════════════════════════════════════════
// INDEXEDDB PERSISTENCE
// ══════════════════════════════════════════════════════════════════════════════

const IDB_NAME = "mathshell_vfs";
const IDB_STORE = "nodes";
const IDB_VER = 1;

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, { keyPath: "path" });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbPut(db, path, node) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ path, ...node });
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

async function idbDelete(db, path) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(path);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

async function idbDeletePrefix(db, prefix) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) return;
      const k = cursor.key;
      if (k === prefix || k.startsWith(prefix + "/")) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

async function idbLoadAll(db) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// VIRTUAL FILE SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

class VFS {
  constructor() {
    this._t = {};
    this._db = null; // assigned after idbOpen() resolves
    this._mkdirP("/home/user");
    this._mkdirP("/etc");
    this._mkdirP("/tmp");
    this._mkdirP("/bin");
    this._mkdirP("/usr/bin");
    this._mkdirP("/var/log");
    this._wf("/etc/hostname",    "mathshell\n");
    this._wf("/etc/motd",        "MathShell OS 1.0 — POSIX-like shell with built-in calculator\nType 'help' for a list of commands.\nFiles persist across sessions. Type 'wipe-fs' to reset everything.\n");
    this._wf("/etc/os-release",  'NAME="MathShell OS"\nVERSION="1.0"\nID=mathshell\n');
    this._wf("/etc/passwd",      "root:x:0:0:root:/root:/bin/sh\nuser:x:1000:1000:User:/home/user:/bin/mathsh\n");
    this._wf("/etc/shells",      "/bin/sh\n/bin/mathsh\n");
    this._wf("/home/user/README.txt",
      "Welcome to MathShell!\n\nA POSIX-like shell with a built-in calculator.\n\nTry these commands:\n  ls /etc\n  cat /etc/os-release\n  echo hello world\n  math 2^10\n  echo '355/113' | bc\n  seq 1 10 | sort -rn\n  date\n  help\n");
    this._wf("/home/user/.profile", "# MathShell profile\nexport PATH=/bin:/usr/bin\nexport EDITOR=ed\n");
    this._wf("/var/log/shell.log", "");
  }

  // Persist a single node to IDB (fire-and-forget, silent on error)
  _persist(path) {
    if (this._db && this._t[path]) idbPut(this._db, path, this._t[path]).catch(() => {});
  }

  // Remove one path from IDB
  _del(path) {
    if (this._db) idbDelete(this._db, path).catch(() => {});
  }

  // Remove a path and all its children from IDB
  _delPrefix(path) {
    if (this._db) idbDeletePrefix(this._db, path).catch(() => {});
  }

  // Overlay IDB records on top of the default tree
  loadFromIDB(records) {
    for (const rec of records) {
      const { path, ...node } = rec;
      this._t[path] = node;
    }
  }

  _mkdirP(path) {
    const parts = path.split("/").filter(Boolean);
    let cur = "";
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
    const parts = path.split("/").filter(Boolean);
    const r = [];
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
    const prefix = dir === "/" ? "" : dir;
    const seen = new Set();
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
    this._delPrefix(path);
    return null;
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
      const newKey = dest + k.slice(src.length);
      this._t[newKey] = { ...this._t[k] };
      this._persist(newKey);
      delete this._t[k];
    });
    this._delPrefix(src);
    return null;
  }

  touch(path) {
    if (this.isFile(path)) { this._t[path].mtime = Date.now(); this._persist(path); }
    else this._wf(path, "");
  }

  setDb(db) {
    this._db = db;
  }

  _persist(path) {
    if (!this._db) return;
    const node = this._t[path];
    if (node) idbPut(this._db, path, node).catch(() => {});
    else idbDelete(this._db, path).catch(() => {});
  }

  _persistPrefix(prefix) {
    if (!this._db) return;
    idbDeletePrefix(this._db, prefix).catch(() => {});
    for (const k of Object.keys(this._t)) {
      if (k === prefix || k.startsWith(prefix + "/")) idbPut(this._db, k, this._t[k]).catch(() => {});
    }
  }

  _del(path) {
    if (!this._db) return;
    idbDelete(this._db, path).catch(() => {});
  }

  _delPrefix(prefix) {
    if (!this._db) return;
    idbDeletePrefix(this._db, prefix).catch(() => {});
  }

  download(path) {
    const content = this.read(path); if (content === null) return false;
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = path.split("/").pop();
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = ts => { const d = new Date(ts); return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const fmtLong = (fp, vfs) => {
  const name = fp.split("/").pop() || fp;
  const n = vfs.stat(fp);
  if (!n) return `?         ${name}`;
  const perm = n.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--";
  return `${perm}  1 user user ${String(n.size ?? 0).padStart(6)} ${fmtDate(n.mtime ?? Date.now())} ${name}`;
};

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

const MAIN_HELP = `mathsh — POSIX-compatible shell

FILE & DIRECTORY
  ls [-laF] [path]        cat <file>           pwd
  cd [dir]                mkdir [-p] <dir>     rmdir <dir>
  rm [-rf] <file>         cp <src> <dst>       mv <src> <dst>
  touch <file>            find [-name] [-type] du / df

TEXT PROCESSING
  echo [-n -e] <text>     printf <fmt> [args]  grep [-vinc] <pat>
  sed 's/p/r/[flags]'     awk [-F] '{print}'   sort [-rnu]
  uniq [-c]               cut -d<d> -f<f>      tr <from> <to>
  head/tail [-n N]        wc [-lwc]             nl / rev / fold
  tee [-a] <file>         seq [s] [inc] end     od / cksum

SHELL & VARIABLES
  VAR=value               export [VAR=val]      unset VAR
  env / printenv [VAR]    alias [k='v']         unalias <k>
  read [VAR]              history [n]           type / which
  test / [                true / false           exit [code]

MATH
  bc                      expr <expr>           math <expr>

SYSTEM
  date [+fmt]             uname [-a]            whoami / id
  hostname                ps                    sleep <n>

MISC
  clear                   motd                  download <file>
  help [cmd]              man <cmd>

PIPES & REDIRECTION
  cmd | cmd2              cmd > file            cmd >> file
  cmd < file              cmd ; cmd2

MATH FUNCTIONS (in bc/math)
  sqrt  cbrt  sin  cos  tan  asin  acos  atan
  abs  floor  ceil  round  log  log2  ln
  factorial (n!)   pi   e
`;

const HELP_TOPICS = {
  ls:   "ls [-l] [-a] [-F] [path]\n  -l  long format  -a  include hidden  -F  append /\n",
  grep: "grep [-v] [-i] [-n] [-c] [-e] pattern [file...]\n  -v invert  -i ignore-case  -n line-numbers  -c count\n  Supports POSIX extended regular expressions.\n",
  sed:  "sed EXPR [file]\n  s/pat/rep/[gi]    substitute\n  /pat/d            delete matching lines\n  /pat/p            keep only matching lines\n  Nd                delete line N\n",
  awk:  "awk [-F sep] '[/pat/] {action}' [file]\n  print $N   print field N  NR=row NF=fields\n",
  find: "find [path] [-name glob] [-type f|d] [-maxdepth N]\n",
  bc:   "bc — arbitrary precision calculator (reads from stdin)\n  echo '2^10' | bc\n",
  math: "math <expression> — evaluate a math expression\n  math 2^10\n  math sqrt(144)\n  math sin(pi/2)\n",
  test: "test EXPR  or  [ EXPR ]\n  -f file  -d dir  -e path  -z str  -n str\n  str1 = str2   str1 != str2\n  n1 -eq|-ne|-lt|-le|-gt|-ge n2\n",
};

function execCmd(cmd, args, stdin, vfs, sh) {
  if (!cmd) return { output: "", exitCode: 0 };
  const norm = p => vfs.resolve(p, sh.cwd);

  // VAR=value assignment (no space, no args)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*=/.test(cmd) && args.length === 0) {
    const eq = cmd.indexOf("="); sh.env[cmd.slice(0, eq)] = cmd.slice(eq + 1);
    return { output: "", exitCode: 0 };
  }

  // Alias expansion
  if (sh.aliases[cmd]) {
    const expanded = sh.aliases[cmd] + (args.length ? " " + args.join(" ") : "");
    return runPipeline(parsePipeline(tokenize(expanded)), vfs, sh);
  }

  switch (cmd) {
    case "echo": {
      let nl = true, interp = false; const parts = [];
      for (const a of args) {
        if (a === "-n") nl = false;
        else if (a === "-e") interp = true;
        else if (a === "-E") interp = false;
        else parts.push(a);
      }
      let s = parts.join(" ");
      if (interp) s = s.replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\r/g,"\r").replace(/\\\\/g,"\\");
      return { output: s + (nl ? "\n" : ""), exitCode: 0 };
    }

    case "printf": {
      if (!args.length) return { output: "", exitCode: 0 };
      let fmt = args[0].replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\r/g,"\r").replace(/\\\\/g,"\\");
      const pa = args.slice(1); let ai = 0;
      const out = fmt.replace(/%[sdif%]/g, s => {
        if (s === "%%") return "%";
        const v = pa[ai++] ?? "";
        if (s === "%d" || s === "%i") return String(parseInt(v) || 0);
        if (s === "%f") return String(parseFloat(v) || 0);
        return String(v);
      });
      return { output: out, exitCode: 0 };
    }

    case "cat": {
      if (!args.length || (args.length === 1 && args[0] === "-")) return { output: stdin ?? "", exitCode: 0 };
      let out = "", ec = 0;
      for (const a of args) {
        const p = norm(a);
        if (!vfs.exists(p))    { out += `cat: ${a}: No such file or directory\n`; ec = 1; }
        else if (vfs.isDir(p)) { out += `cat: ${a}: Is a directory\n`; ec = 1; }
        else out += vfs.read(p);
      }
      return { output: out, exitCode: ec };
    }

    case "ls": {
      let long = false, all = false, classify = false; const targets = [];
      for (const a of args) {
        if (/^-[laF]+$/.test(a)) { if (a.includes("l")) long=true; if (a.includes("a")) all=true; if (a.includes("F")) classify=true; }
        else targets.push(a);
      }
      const listDir = dir => {
        let entries = vfs.ls(dir);
        if (all) entries = [".", "..", ...entries];
        if (!entries.length) return "";
        if (long) {
          const lines = entries.map(e => {
            if (e === "." || e === "..") return `drwxr-xr-x  2 user user      0 ${fmtDate(Date.now())} ${e}`;
            return fmtLong((dir === "/" ? "" : dir) + "/" + e, vfs);
          });
          return "total " + entries.length + "\n" + lines.join("\n") + "\n";
        }
        return entries.map(e => { const fp = (dir === "/" ? "" : dir) + "/" + e; return e + (classify && vfs.isDir(fp) ? "/" : ""); }).join("  ") + "\n";
      };
      if (!targets.length) return { output: listDir(sh.cwd), exitCode: 0 };
      const parts = []; let ec = 0;
      for (const t of targets) {
        const p = norm(t);
        if (!vfs.exists(p)) { parts.push(`ls: cannot access '${t}': No such file or directory`); ec = 1; }
        else if (vfs.isFile(p)) parts.push(long ? fmtLong(p, vfs) + "\n" : p.split("/").pop() + "\n");
        else parts.push((targets.length > 1 ? t + ":\n" : "") + listDir(p));
      }
      return { output: parts.join("\n"), exitCode: ec };
    }

    case "pwd": return { output: sh.cwd + "\n", exitCode: 0 };

    case "cd": {
      const target = !args.length ? "/home/user" : norm(args[0]);
      if (!vfs.exists(target))  return { output: `cd: ${args[0]}: No such file or directory\n`, exitCode: 1 };
      if (!vfs.isDir(target))   return { output: `cd: ${args[0]}: Not a directory\n`, exitCode: 1 };
      sh.cwd = target; sh.env.PWD = target; return { output: "", exitCode: 0 };
    }

    case "mkdir": {
      let mkP = false; const dirs = [];
      for (const a of args) { if (a === "-p") mkP = true; else dirs.push(a); }
      for (const d of dirs) {
        const p = norm(d);
        if (mkP) vfs._mkdirP(p);
        else { const err = vfs.mkdir(p); if (err) return { output: err + "\n", exitCode: 1 }; }
      }
      return { output: "", exitCode: 0 };
    }

    case "rmdir": {
      for (const d of args) { const err = vfs.rmdir(norm(d)); if (err) return { output: err + "\n", exitCode: 1 }; }
      return { output: "", exitCode: 0 };
    }

    case "rm": {
      let rec = false, force = false; const files = [];
      for (const a of args) {
        if (/^-[rRfF]+$/.test(a)) { if (/[rR]/.test(a)) rec=true; if (/f/.test(a)) force=true; }
        else files.push(a);
      }
      for (const f of files) { const err = vfs.rm(norm(f), rec); if (err && !force) return { output: err + "\n", exitCode: 1 }; }
      return { output: "", exitCode: 0 };
    }

    case "cp": {
      if (args.length < 2) return { output: "cp: missing destination file operand\n", exitCode: 1 };
      const dst = norm(args[args.length - 1]);
      for (const s of args.slice(0, -1)) { const err = vfs.cp(norm(s), dst); if (err) return { output: err + "\n", exitCode: 1 }; }
      return { output: "", exitCode: 0 };
    }

    case "mv": {
      if (args.length < 2) return { output: "mv: missing destination file operand\n", exitCode: 1 };
      const dst = norm(args[args.length - 1]);
      for (const s of args.slice(0, -1)) { const err = vfs.mv(norm(s), dst); if (err) return { output: err + "\n", exitCode: 1 }; }
      return { output: "", exitCode: 0 };
    }

    case "touch": {
      for (const f of args) vfs.touch(norm(f));
      return { output: "", exitCode: 0 };
    }

    case "wc": {
      let l = false, w = false, c = false; const files = [];
      for (const a of args) {
        if (/^-[lwc]+$/.test(a)) { if (a.includes("l")) l=true; if (a.includes("w")) w=true; if (a.includes("c")) c=true; }
        else files.push(a);
      }
      if (!l && !w && !c) { l=true; w=true; c=true; }
      const count = (text, name) => {
        const lns = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
        const wds = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chs = text.length;
        return (l ? String(lns).padStart(8) : "") + (w ? String(wds).padStart(8) : "") + (c ? String(chs).padStart(8) : "") + (name ? " " + name : "");
      };
      if (!files.length) return { output: count(stdin ?? "", "") + "\n", exitCode: 0 };
      const res = []; let ec = 0;
      for (const f of files) { const p = norm(f); if (!vfs.isFile(p)) { res.push(`wc: ${f}: No such file or directory`); ec = 1; } else res.push(count(vfs.read(p), f)); }
      return { output: res.join("\n") + "\n", exitCode: ec };
    }

    case "head": {
      let n = 10; const files = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-n" && args[i+1]) { n = parseInt(args[++i]); }
        else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1));
        else files.push(args[i]);
      }
      const proc = t => t.split("\n").slice(0, n).join("\n") + "\n";
      if (!files.length) return { output: proc(stdin ?? ""), exitCode: 0 };
      const outs = []; let ec = 0;
      for (const f of files) { const p = norm(f); if (!vfs.isFile(p)) { outs.push(`head: ${f}: No such file or directory`); ec = 1; } else outs.push((files.length > 1 ? `==> ${f} <==\n` : "") + proc(vfs.read(p))); }
      return { output: outs.join("\n"), exitCode: ec };
    }

    case "tail": {
      let n = 10; const files = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-n" && args[i+1]) { n = parseInt(args[++i]); }
        else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1));
        else files.push(args[i]);
      }
      const proc = t => { const ls = t.split("\n"); if (ls[ls.length-1] === "") ls.pop(); return ls.slice(-n).join("\n") + "\n"; };
      if (!files.length) return { output: proc(stdin ?? ""), exitCode: 0 };
      const outs = []; let ec = 0;
      for (const f of files) { const p = norm(f); if (!vfs.isFile(p)) { outs.push(`tail: ${f}: No such file or directory`); ec = 1; } else outs.push((files.length > 1 ? `==> ${f} <==\n` : "") + proc(vfs.read(p))); }
      return { output: outs.join("\n"), exitCode: ec };
    }

    case "grep": {
      let inv=false, icase=false, lnum=false, quiet=false, cnt=false; let pattern=null; const files=[];
      for (let i=0; i<args.length; i++) {
        const a = args[i];
        if      (a==="-v"||a==="--invert-match") inv=true;
        else if (a==="-i"||a==="--ignore-case")  icase=true;
        else if (a==="-n"||a==="--line-number")  lnum=true;
        else if (a==="-q"||a==="--quiet")        quiet=true;
        else if (a==="-c"||a==="--count")        cnt=true;
        else if ((a==="-e"||a==="-E") && args[i+1]) { pattern=args[++i]; }
        else if (!pattern) pattern=a;
        else files.push(a);
      }
      if (!pattern) return { output: "grep: missing pattern\n", exitCode: 2 };
      let re; try { re=new RegExp(pattern, icase?"i":""); } catch(e) { return { output: `grep: invalid regex: ${e.message}\n`, exitCode: 2 }; }
      const grepText = (text, fname) => {
        const matched = [];
        text.split("\n").forEach((line, idx) => {
          if (re.test(line) !== inv) { let o = ""; if (fname) o += fname + ":"; if (lnum) o += (idx+1) + ":"; matched.push(o + line); }
        });
        return matched;
      };
      const sources = files.length ? files : [null]; const all = []; let ec = 1;
      for (const f of sources) {
        const text = f ? (vfs.read(norm(f)) ?? "") : (stdin ?? "");
        if (f && !vfs.isFile(norm(f))) return { output: `grep: ${f}: No such file or directory\n`, exitCode: 2 };
        const m = grepText(text, f && files.length>1 ? f : "");
        if (m.length) ec = 0; all.push(...m);
      }
      if (cnt)   return { output: all.length + "\n", exitCode: ec };
      if (quiet) return { output: "", exitCode: ec };
      return { output: all.join("\n") + (all.length ? "\n" : ""), exitCode: ec };
    }

    case "sed": {
      const exprs = []; const files = [];
      for (let i=0; i<args.length; i++) {
        if (args[i]==="-e" && args[i+1]) exprs.push(args[++i]);
        else if (!exprs.length && !args[i].startsWith("-")) exprs.push(args[i]);
        else if (exprs.length) files.push(args[i]);
      }
      let text = stdin ?? "";
      if (files.length) { const p = norm(files[0]); if (vfs.isFile(p)) text = vfs.read(p); }
      for (const expr of exprs) {
        const sM = expr.match(/^s(.)(.+?)\1(.*?)\1([gi]*)$/s);
        if (sM) {
          const [,,pat,rep,flags] = sM; let rflags = ""; if (flags.includes("g")) rflags+="g"; if (flags.includes("i")) rflags+="i";
          let re2; try { re2=new RegExp(pat, rflags); } catch { return { output: "sed: invalid regex\n", exitCode: 1 }; }
          text = text.split("\n").map(l => l.replace(re2, rep.replace(/\\n/g,"\n").replace(/\\t/g,"\t"))).join("\n"); continue;
        }
        const dM = expr.match(/^\/(.+)\/d$/);
        if (dM) { let re2; try { re2=new RegExp(dM[1]); } catch { return { output: "sed: invalid regex\n", exitCode: 1 }; } text = text.split("\n").filter(l => !re2.test(l)).join("\n"); continue; }
        const pM = expr.match(/^\/(.+)\/p$/);
        if (pM) { let re2; try { re2=new RegExp(pM[1]); } catch { return { output: "sed: invalid regex\n", exitCode: 1 }; } text = text.split("\n").filter(l => re2.test(l)).join("\n"); continue; }
        const nM = expr.match(/^(\d+)d$/);
        if (nM) { const ls = text.split("\n"); ls.splice(parseInt(nM[1])-1,1); text = ls.join("\n"); continue; }
        return { output: `sed: expression error near: ${expr}\n`, exitCode: 1 };
      }
      return { output: text.endsWith("\n") ? text : text+"\n", exitCode: 0 };
    }

    case "awk": {
      let FSre=/\s+/, FSstr=" "; let program=""; const fileArgs=[];
      for (let i=0; i<args.length; i++) {
        if (args[i]==="-F" && args[i+1]) { FSstr=args[++i]; FSre=FSstr===" "?/\s+/:new RegExp(FSstr.replace(/[.+*?^${}()|[\]\\]/g,c=>"\\"+c)); }
        else if (!program) program=args[i]; else fileArgs.push(args[i]);
      }
      let text = stdin ?? "";
      if (fileArgs.length) { const p = norm(fileArgs[0]); if (vfs.isFile(p)) text = vfs.read(p); }
      const ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
      const out = [];
      const mProg = program.match(/^(?:\/([^/]*)\/\s*)?\{([^}]*)\}$/s);
      if (!mProg) return { output: "awk: syntax error\n", exitCode: 1 };
      const [,pat,action] = mProg; let patRe = null;
      if (pat) { try { patRe=new RegExp(pat); } catch { return { output: "awk: invalid regex\n", exitCode: 1 }; } }
      for (let nr=0; nr<ls.length; nr++) {
        const line = ls[nr]; if (patRe && !patRe.test(line)) continue;
        const fields = FSstr===" " ? (line.trim() ? line.trim().split(/\s+/) : []) : line.split(FSre);
        const trimmed = action.trim();
        if (!trimmed || trimmed==="print" || trimmed==="print $0") { out.push(line); continue; }
        const pMatch = trimmed.match(/^print\s+(.+)$/);
        if (pMatch) {
          const expr = pMatch[1].replace(/\$0/g,JSON.stringify(line)).replace(/\$(\d+)/g,(_,n)=>JSON.stringify(fields[parseInt(n)-1]??"")).replace(/\bNR\b/g,String(nr+1)).replace(/\bNF\b/g,String(fields.length));
          try { out.push(String(new Function(`return (${expr})`)())); } catch { out.push(line); }
        } else { out.push(line); }
      }
      return { output: out.join("\n") + (out.length ? "\n" : ""), exitCode: 0 };
    }

    case "sort": {
      let rev=false, num=false, uniq=false; const files=[];
      for (const a of args) { if (/^-[rnu]+$/.test(a)) { if (a.includes("r")) rev=true; if (a.includes("n")) num=true; if (a.includes("u")) uniq=true; } else files.push(a); }
      let text = stdin ?? "";
      if (files.length) { const p = norm(files[0]); if (vfs.isFile(p)) text = vfs.read(p); }
      let ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
      num ? ls.sort((a,b) => parseFloat(a)-parseFloat(b)) : ls.sort((a,b) => a.localeCompare(b));
      if (rev) ls.reverse(); if (uniq) ls=[...new Set(ls)];
      return { output: ls.join("\n") + "\n", exitCode: 0 };
    }

    case "uniq": {
      let cnt=false; const files=[];
      for (const a of args) { if (a==="-c") cnt=true; else files.push(a); }
      let text = stdin ?? "";
      if (files.length) { const p = norm(files[0]); if (vfs.isFile(p)) text = vfs.read(p); }
      let ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
      const out = []; let prev=undefined, c=0;
      for (const l of ls) { if (l===prev) c++; else { if (prev!==undefined) out.push(cnt ? `${String(c).padStart(4)} ${prev}` : prev); prev=l; c=1; } }
      if (prev!==undefined) out.push(cnt ? `${String(c).padStart(4)} ${prev}` : prev);
      return { output: out.join("\n") + (out.length?"\n":""), exitCode: 0 };
    }

    case "cut": {
      let delim="\t"; let fields=[]; const files=[];
      for (let i=0; i<args.length; i++) {
        if (args[i]==="-d" && args[i+1]) delim=args[++i];
        else if (args[i]==="-f" && args[i+1]) { fields=args[++i].split(",").flatMap(r => { if (r.includes("-")) { const [a,b]=r.split("-").map(Number); return Array.from({length:b-a+1},(_,j)=>a+j); } return [parseInt(r)]; }); }
        else files.push(args[i]);
      }
      let text = stdin ?? "";
      if (files.length) { const p = norm(files[0]); if (vfs.isFile(p)) text = vfs.read(p); }
      const ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
      const out = ls.map(line => { const parts = line.split(delim); return fields.length ? fields.map(f => parts[f-1]??"").join(delim) : line; });
      return { output: out.join("\n") + "\n", exitCode: 0 };
    }

    case "tr": {
      let del=false; const ta=[];
      for (const a of args) { if (a==="-d") del=true; else ta.push(a); }
      const text = stdin ?? "";
      if (del && ta[0]) { const s=new Set(ta[0]); return { output: text.split("").filter(c=>!s.has(c)).join(""), exitCode: 0 }; }
      if (ta.length<2) return { output: text, exitCode: 0 };
      let out = text;
      for (let i=0; i<Math.min(ta[0].length,ta[1].length); i++) out = out.split(ta[0][i]).join(ta[1][i]);
      return { output: out, exitCode: 0 };
    }

    case "expr": {
      try { const r = mathEval(args.join(" ")); return { output: fmtNum(r)+"\n", exitCode: r===0?1:0 }; }
      catch { return { output: "expr: syntax error\n", exitCode: 2 }; }
    }

    case "bc": {
      const input = (stdin ?? args.join(" ")).trim();
      if (!input) return { output: "", exitCode: 0 };
      const res = [];
      for (const line of input.split("\n")) {
        const l = line.trim(); if (!l || l.startsWith("#")) continue;
        try { res.push(fmtNum(mathEval(l))); } catch(e) { res.push(`(error: ${e.message})`); }
      }
      return { output: res.join("\n")+"\n", exitCode: 0 };
    }

    case "math": {
      const e = args.join(" ").trim() || (stdin ?? "").trim();
      if (!e) return { output: "math: no expression given\n", exitCode: 1 };
      try { return { output: fmtNum(mathEval(e))+"\n", exitCode: 0 }; }
      catch(err) { return { output: `math: ${err.message}\n`, exitCode: 1 }; }
    }

    case "date": {
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      if (args.includes("+%s")) return { output: Math.floor(Date.now()/1000)+"\n", exitCode: 0 };
      const fmt = (args[0]?.startsWith("+") ? args[0].slice(1) : "%a %b %e %H:%M:%S %Z %Y")
        .replace(/%Y/g,now.getFullYear()).replace(/%m/g,pad(now.getMonth()+1))
        .replace(/%d/g,pad(now.getDate())).replace(/%e/g,String(now.getDate()))
        .replace(/%H/g,pad(now.getHours())).replace(/%M/g,pad(now.getMinutes()))
        .replace(/%S/g,pad(now.getSeconds())).replace(/%a/g,days[now.getDay()])
        .replace(/%b/g,MONTHS[now.getMonth()]).replace(/%Z/g,Intl.DateTimeFormat().resolvedOptions().timeZone)
        .replace(/%n/g,"\n").replace(/%t/g,"\t");
      return { output: fmt+"\n", exitCode: 0 };
    }

    case "sleep": return { output: "", exitCode: 0 };
    case "true":  return { output: "", exitCode: 0 };
    case "false": return { output: "", exitCode: 1 };

    case "test":
    case "[": {
      const a = cmd==="[" ? args.slice(0,-1) : args;
      if (!a.length) return { output: "", exitCode: 1 };
      if (a[0]==="-f") return { output: "", exitCode: vfs.isFile(norm(a[1]??""))?0:1 };
      if (a[0]==="-d") return { output: "", exitCode: vfs.isDir(norm(a[1]??""))?0:1 };
      if (a[0]==="-e") return { output: "", exitCode: vfs.exists(norm(a[1]??""))?0:1 };
      if (a[0]==="-z") return { output: "", exitCode: (a[1]??"").length===0?0:1 };
      if (a[0]==="-n") return { output: "", exitCode: (a[1]??"").length>0?0:1 };
      if (a[0]==="!")  return { output: "", exitCode: execCmd("test",a.slice(1),stdin,vfs,sh).exitCode===0?1:0 };
      if (a[1]==="="||a[1]==="==") return { output: "", exitCode: a[0]===a[2]?0:1 };
      if (a[1]==="!=") return { output: "", exitCode: a[0]!==a[2]?0:1 };
      if (a[1]==="-eq") return { output: "", exitCode: Number(a[0])===Number(a[2])?0:1 };
      if (a[1]==="-ne") return { output: "", exitCode: Number(a[0])!==Number(a[2])?0:1 };
      if (a[1]==="-lt") return { output: "", exitCode: Number(a[0])<Number(a[2])?0:1 };
      if (a[1]==="-le") return { output: "", exitCode: Number(a[0])<=Number(a[2])?0:1 };
      if (a[1]==="-gt") return { output: "", exitCode: Number(a[0])>Number(a[2])?0:1 };
      if (a[1]==="-ge") return { output: "", exitCode: Number(a[0])>=Number(a[2])?0:1 };
      return { output: "", exitCode: (a[0]??"").length>0?0:1 };
    }

    case "uname": {
      if (args.includes("-a")) return { output: `MathShell mathshell 1.0.0 ${new Date().toISOString().split("T")[0]} wasm32 mathsh\n`, exitCode: 0 };
      if (args.includes("-r")) return { output: "1.0.0\n", exitCode: 0 };
      if (args.includes("-n")) return { output: "mathshell\n", exitCode: 0 };
      if (args.includes("-m")) return { output: "wasm32\n", exitCode: 0 };
      return { output: "MathShell\n", exitCode: 0 };
    }

    case "whoami": return { output: (sh.env.USER||"user").trim()+"\n", exitCode: 0 };
    case "id": { const u=(sh.env.USER||"user").trim(); return { output: `uid=1000(${u}) gid=1000(${u}) groups=1000(${u})\n`, exitCode: 0 }; }
    case "hostname": return { output: vfs.read("/etc/hostname")||"mathshell\n", exitCode: 0 };

    case "basename": {
      if (!args.length) return { output: "basename: missing operand\n", exitCode: 1 };
      let name = args[0].replace(/\/+$/,"").split("/").pop()||"/";
      if (args[1] && name.endsWith(args[1])) name = name.slice(0,-args[1].length);
      return { output: name+"\n", exitCode: 0 };
    }
    case "dirname": {
      if (!args.length) return { output: "dirname: missing operand\n", exitCode: 1 };
      const p = args[0].replace(/\/+$/,"");
      return { output: (p.includes("/") ? p.slice(0,p.lastIndexOf("/"))||"/" : ".")+"\n", exitCode: 0 };
    }

    case "export": {
      if (!args.length) return { output: Object.entries(sh.env).map(([k,v])=>`export ${k}="${String(v).replace(/\n$/,"")}"` ).join("\n")+"\n", exitCode: 0 };
      for (const a of args) { const eq=a.indexOf("="); if (eq!==-1) sh.env[a.slice(0,eq)]=a.slice(eq+1); }
      return { output: "", exitCode: 0 };
    }
    case "unset": { for (const a of args) delete sh.env[a]; return { output: "", exitCode: 0 }; }
    case "env":
    case "printenv": {
      if (cmd==="printenv" && args.length) { const v=sh.env[args[0]]; return v!==undefined?{output:String(v).replace(/\n$/,"")+"\n",exitCode:0}:{output:"",exitCode:1}; }
      return { output: Object.entries(sh.env).map(([k,v])=>`${k}=${String(v).replace(/\n$/,"")}`).join("\n")+"\n", exitCode: 0 };
    }

    case "read": {
      if (args.length && stdin!=null) sh.env[args[0]]=(stdin??"").split("\n")[0];
      return { output: "", exitCode: 0 };
    }

    case "alias": {
      if (!args.length) { const o=Object.entries(sh.aliases).map(([k,v])=>`alias ${k}='${v}'`).join("\n"); return { output: (o||"(no aliases)")+"\n", exitCode: 0 }; }
      for (const a of args) { const eq=a.indexOf("="); if (eq!==-1) sh.aliases[a.slice(0,eq)]=a.slice(eq+1).replace(/^['"]|['"]$/g,""); }
      return { output: "", exitCode: 0 };
    }
    case "unalias": { for (const a of args) delete sh.aliases[a]; return { output: "", exitCode: 0 }; }

    case "which": {
      if (!args.length) return { output: "which: missing argument\n", exitCode: 1 };
      const outs=[]; let ec=0;
      for (const a of args) { if (BUILTINS.has(a)||sh.aliases[a]) outs.push("/bin/"+a); else { outs.push(`which: no ${a} in (/bin:/usr/bin)`); ec=1; } }
      return { output: outs.join("\n")+"\n", exitCode: ec };
    }
    case "type": {
      if (!args.length) return { output: "type: missing argument\n", exitCode: 1 };
      const a=args[0];
      if (sh.aliases[a]) return { output: `${a} is aliased to '${sh.aliases[a]}'\n`, exitCode: 0 };
      if (BUILTINS.has(a)) return { output: `${a} is a shell builtin\n`, exitCode: 0 };
      return { output: `${a}: not found\n`, exitCode: 1 };
    }
    case "command": {
      if (!args.length) return { output: "", exitCode: 0 };
      if (args[0]==="-v") return { output: (BUILTINS.has(args[1])?"/bin/"+args[1]:"")+"\n", exitCode: BUILTINS.has(args[1])?0:1 };
      return execCmd(args[0], args.slice(1), stdin, vfs, sh);
    }

    case "history": {
      const n = args[0] ? parseInt(args[0]) : sh.history.length;
      const slice = sh.history.slice(-n); const off = sh.history.length-slice.length;
      return { output: slice.map((h,i)=>`  ${String(off+i+1).padStart(4)}  ${h}`).join("\n")+"\n", exitCode: 0 };
    }

    case "ps": return { output: "  PID TTY          TIME CMD\n    1 pts/0    00:00:00 mathsh\n    2 pts/0    00:00:00 ps\n", exitCode: 0 };
    case "jobs": case "kill": case "bg": case "fg": return { output: "", exitCode: 0 };

    case "du": {
      const target = args.filter(a=>!a.startsWith("-"))[0]||"."; const p=norm(target);
      if (!vfs.exists(p)) return { output: `du: cannot access '${target}': No such file or directory\n`, exitCode: 1 };
      let size=0;
      if (vfs.isFile(p)) size=vfs.stat(p)?.size??0;
      else Object.keys(vfs._t).filter(k=>k.startsWith(p)).forEach(k=>{ if (vfs._t[k].type==="file") size+=vfs._t[k].size??0; });
      return { output: `${Math.max(Math.ceil(size/1024),4)}\t${target}\n`, exitCode: 0 };
    }

    case "df": return { output: "Filesystem     1K-blocks  Used Available Use% Mounted on\nmathshellfs      1048576   256   1048320   1% /\n", exitCode: 0 };

    case "find": {
      let searchPath=sh.cwd, namePat=null, typeF=null, maxDepth=Infinity;
      for (let i=0; i<args.length; i++) {
        if      (args[i]==="-name"     && args[i+1]) namePat=args[++i];
        else if (args[i]==="-type"     && args[i+1]) typeF=args[++i];
        else if (args[i]==="-maxdepth" && args[i+1]) maxDepth=parseInt(args[++i]);
        else if (!args[i].startsWith("-")) searchPath=norm(args[i]);
      }
      const sp=norm(searchPath);
      if (!vfs.exists(sp)) return { output: `find: '${searchPath}': No such file or directory\n`, exitCode: 1 };
      const spDepth=sp.split("/").filter(Boolean).length;
      const matches=[];
      if (!typeF||typeF==="d") matches.push(sp);
      for (const k of Object.keys(vfs._t).sort()) {
        if (k!==sp && !k.startsWith(sp==="/"?"/":`${sp}/`)) continue;
        const depth=k.split("/").filter(Boolean).length-spDepth;
        if (depth<1||depth>maxDepth) continue;
        const node=vfs._t[k];
        if (typeF==="f"&&node.type!=="file") continue;
        if (typeF==="d"&&node.type!=="dir")  continue;
        if (namePat) { const base=k.split("/").pop(); const re=new RegExp("^"+namePat.replace(/[.+^${}()|[\]\\]/g,c=>"\\"+c).replace(/\*/g,".*").replace(/\?/g,".")+"$"); if (!re.test(base)) continue; }
        matches.push(k);
      }
      return { output: matches.join("\n")+"\n", exitCode: 0 };
    }

    case "xargs": {
      if (!args.length) return { output: "", exitCode: 0 };
      const items=(stdin??"").trim().split(/\s+/).filter(Boolean);
      const [c2,...cArgs]=args;
      const outs=items.map(item=>execCmd(c2,[...cArgs,item],null,vfs,sh).output??"");
      return { output: outs.join(""), exitCode: 0 };
    }

    case "nl": {
      let text=stdin??"";
      if (args.length) { const p=norm(args.filter(a=>!a.startsWith("-"))[0]??""); if (vfs.isFile(p)) text=vfs.read(p); }
      const ls=text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
      return { output: ls.map((l,i)=>`${String(i+1).padStart(6)}\t${l}`).join("\n")+"\n", exitCode: 0 };
    }

    case "tee": {
      const ap2=args[0]==="-a"; const file=ap2?args[1]:args[0];
      if (file) { const p=norm(file); if (ap2) vfs.append(p,stdin??""); else vfs.write(p,stdin??""); }
      return { output: stdin??"", exitCode: 0 };
    }

    case "seq": {
      const nums=args.filter(a=>!a.startsWith("-")).map(Number).filter(n=>!isNaN(n));
      let start=1, step=1, end=1;
      if (nums.length===1) end=nums[0];
      else if (nums.length===2) { [start,end]=nums; }
      else if (nums.length>=3)  { [start,step,end]=nums; }
      const out=[];
      for (let n=start; step>0?n<=end:n>=end; n+=step) out.push(n);
      return { output: out.join("\n")+"\n", exitCode: 0 };
    }

    case "yes": return { output: Array(20).fill(args[0]||"y").join("\n")+"\n", exitCode: 0 };

    case "fold": {
      let width=80;
      for (let i=0; i<args.length; i++) { if (args[i]==="-w"&&args[i+1]) width=parseInt(args[++i]); }
      const text=stdin??"";
      return { output: text.split("\n").map(line=>{ const c=[]; for (let i=0; i<line.length; i+=width) c.push(line.slice(i,i+width)); return c.join("\n")||""; }).join("\n"), exitCode: 0 };
    }

    case "rev": return { output: (stdin??"").split("\n").map(l=>l.split("").reverse().join("")).join("\n"), exitCode: 0 };

    case "od": {
      const text=stdin??""; let addr=0; const out=[];
      for (let i=0; i<text.length; i+=16) {
        const chunk=text.slice(i,i+16);
        const hex=chunk.split("").map(c=>c.charCodeAt(0).toString(16).padStart(2,"0")).join(" ");
        out.push(`${addr.toString(8).padStart(7,"0")}  ${hex}`); addr+=16;
      }
      out.push(addr.toString(8).padStart(7,"0"));
      return { output: out.join("\n")+"\n", exitCode: 0 };
    }

    case "cksum": {
      let text=stdin??"";
      if (args.length) { const p=norm(args[0]); if (vfs.isFile(p)) text=vfs.read(p); }
      let s=0; for (const c of text) s=((s<<5)+s)^c.charCodeAt(0);
      return { output: `${(s>>>0)} ${text.length}\n`, exitCode: 0 };
    }

    case "download": {
      if (!args.length) return { output: "download: missing filename\n", exitCode: 1 };
      const p=norm(args[0]);
      if (!vfs.isFile(p)) return { output: `download: '${args[0]}': not found\n`, exitCode: 1 };
      return vfs.download(p) ? { output: `Downloading '${args[0]}'...\n`, exitCode: 0 } : { output: "download: failed\n", exitCode: 1 };
    }

    case "clear":  return { output: "__CLEAR__", exitCode: 0 };
    case "exit": { const code=parseInt(args[0]??"0"); return { output: `__EXIT__${isNaN(code)?0:code}`, exitCode: isNaN(code)?0:code }; }
    case "motd":   return { output: vfs.read("/etc/motd")||"", exitCode: 0 };

    case "man":
    case "help": {
      if (args.length && HELP_TOPICS[args[0]]) return { output: HELP_TOPICS[args[0]], exitCode: 0 };
      if (args.length) return { output: `No manual entry for ${args[0]}\nTry 'help' for a list of commands.\n`, exitCode: 1 };
      return { output: MAIN_HELP, exitCode: 0 };
    }

    case "wipe-fs": {
      if (!vfs._db) return { output: "wipe-fs: IndexedDB not available\n", exitCode: 1 };
      idbDeletePrefix(vfs._db, "/").catch(() => {});
      idbDelete(vfs._db, "/").catch(() => {});
      return { output: "__WIPEFS__", exitCode: 0 };
    }

    default:
      return { output: `mathsh: ${cmd}: command not found\n`, exitCode: 127 };
  }
}

const BUILTINS = new Set(["echo","printf","cat","ls","pwd","cd","mkdir","rmdir","rm","cp","mv","touch",
  "wc","head","tail","grep","sed","awk","sort","uniq","cut","tr","expr","bc","math","date","sleep",
  "true","false","test","[","uname","whoami","id","hostname","basename","dirname","export","unset",
  "env","printenv","read","alias","unalias","which","type","command","history","ps","jobs","kill",
  "bg","fg","du","df","find","xargs","nl","tee","seq","yes","fold","rev","od","cksum","download",
  "clear","exit","motd","man","help","wipe-fs"]);

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
    if (res.output?.startsWith("__CLEAR__") || res.output?.startsWith("__EXIT__")) break;
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
        color: col.fg,
        border: `1px solid ${col.border}`,
        borderRadius: "10px",
        height: "52px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: label.length > 3 ? "11px" : "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: pressed ? "scale(0.91)" : "scale(1)",
        transition: "transform 0.08s",
        userSelect: "none",
        WebkitUserSelect: "none",
        outline: "none",
        letterSpacing: "0.5px",
        boxShadow: pressed
          ? "inset 0 2px 8px rgba(0,0,0,0.7)"
          : "inset 0 1px 0 rgba(255,255,255,0.04), 0 3px 8px rgba(0,0,0,0.6)",
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

  const vfs    = useRef(new VFS());
  const sh     = useRef({ cwd: "/home/user", env: { HOME: "/home/user", USER: "user", PATH: "/bin:/usr/bin", SHELL: "/bin/mathsh", "?": "0" }, aliases: { ll: "ls -la", la: "ls -a" }, history: [] });
  const endRef = useRef(null);
  const inpRef = useRef(null);
  const metaTimer = useRef(null);

  // Save session meta (cwd / env / aliases / history / ans) to IDB as __meta__
  const saveMeta = useCallback((ansOverride) => {
    clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      if (!vfs.current._db) return;
      try {
        await idbPut(vfs.current._db, "__meta__", {
          type: "meta",
          cwd:     sh.current.cwd,
          env:     sh.current.env,
          aliases: sh.current.aliases,
          history: sh.current.history.slice(-200),
          ans:     ansOverride ?? ansR.current,
          mtime:   Date.now(),
          size:    0,
        });
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 800);
      } catch (e) { console.warn("meta save failed", e); }
    }, 500);
  }, []);

  // Boot: open IDB, hydrate VFS from persisted records, then show motd
  useEffect(() => {
    idbOpen().then(db => {
      vfs.current._db = db;
      return idbLoadAll(db);
    }).then(records => {
      if (records && records.length > 0) {
        const meta = records.find(r => r.path === "__meta__");
        const nodes = records.filter(r => r.path !== "__meta__");
        if (nodes.length > 0) vfs.current.loadFromIDB(nodes);
        if (meta) {
          if (meta.cwd)     sh.current.cwd     = meta.cwd;
          if (meta.env)     sh.current.env     = { ...sh.current.env, ...meta.env };
          if (meta.aliases) sh.current.aliases = meta.aliases;
          if (meta.history) sh.current.history = meta.history;
          if (meta.ans)     { setAns(meta.ans); ansR.current = meta.ans; }
        }
        const motd = vfs.current.read("/etc/motd") || "";
        const restored = records.length > 1 || meta;
        setLines([{ type: "sys", text: motd.replace(/\n$/, "") + (restored ? "\n[session restored from IndexedDB]" : "") }]);
      } else {
        const motd = vfs.current.read("/etc/motd") || "";
        setLines([{ type: "sys", text: motd.replace(/\n$/, "") }]);
      }
    }).catch(() => {
      // IDB unavailable (private browsing etc.) — still show motd
      const motd = vfs.current.read("/etc/motd") || "";
      setLines([{ type: "sys", text: motd.replace(/\n$/, "") }]);
    });
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);
  useEffect(() => { if (cliOpen) setTimeout(() => inpRef.current?.focus(), 350); }, [cliOpen]);

  const exprR  = useRef(expr);    exprR.current  = expr;
  const isResR = useRef(isResult); isResR.current = isResult;
  const dispR  = useRef(display); dispR.current  = display;
  const ansR   = useRef(ans);     ansR.current   = ans;

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
      setAns(s);
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
    const prompt = `${sh.current.env.USER}@mathsh:${sh.current.cwd}$ `;
    const newLines = [{ type: "in", text: prompt + raw }];
    const results = executeInput(raw, vfs.current, sh.current);
    for (const res of results) {
      if (!res.output) continue;
      if (res.output.startsWith("__CLEAR__")) { setLines([{ type: "sys", text: "Terminal cleared." }]); setInp(""); return; }
      if (res.output.startsWith("__WIPEFS__")) {
        // Clear all IDB data, then rebuild fresh VFS
        (async () => {
          try {
            if (vfs.current._db) {
              await idbDeletePrefix(vfs.current._db, "/");
              await idbDelete(vfs.current._db, "__meta__");
            }
          } catch (e) { console.warn("IDB wipe failed", e); }
          const freshVfs = new VFS();
          freshVfs._db = vfs.current._db;
          vfs.current = freshVfs;
          sh.current = { cwd: "/home/user", env: { HOME: "/home/user", USER: "user", PATH: "/bin:/usr/bin", SHELL: "/bin/mathsh", "?": "0" }, aliases: { ll: "ls -la", la: "ls -a" }, history: [] };
          setAns("0"); setCmdHist([]);
          setLines([{ type: "sys", text: "Filesystem wiped. All persisted data cleared." }]);
          setInp("");
        })();
        return;
      }
      if (res.output.startsWith("__EXIT__")) { const code=parseInt(res.output.slice(8)); newLines.push({ type: "out", text: `[Process exited with code ${code}]` }); break; }
      const text = res.output.replace(/\n$/, "");
      if (text) newLines.push({ type: "out", text });
    }
    setLines(l => [...l, ...newLines]); setInp("");
    saveMeta();
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
  const promptStr = `${sh.current.env.USER}@mathsh:${sh.current.cwd}$ `;

  const calcButtons = [
    { l: "C",   kind: "clear", fn: doClear },
    { l: "(",   kind: "fn",   fn: () => push("(") },
    { l: ")",   kind: "fn",   fn: () => push(")") },
    { l: "⌫",  kind: "del",  fn: doDel },
    { l: "7",   kind: "num",  fn: () => push("7") },
    { l: "8",   kind: "num",  fn: () => push("8") },
    { l: "9",   kind: "num",  fn: () => push("9") },
    { l: "÷",   kind: "op",   fn: () => push("/") },
    { l: "4",   kind: "num",  fn: () => push("4") },
    { l: "5",   kind: "num",  fn: () => push("5") },
    { l: "6",   kind: "num",  fn: () => push("6") },
    { l: "×",   kind: "op",   fn: () => push("*") },
    { l: "1",   kind: "num",  fn: () => push("1") },
    { l: "2",   kind: "num",  fn: () => push("2") },
    { l: "3",   kind: "num",  fn: () => push("3") },
    { l: "−",   kind: "op",   fn: () => push("-") },
    { l: "0",   kind: "num",  fn: () => push("0") },
    { l: ".",   kind: "num",  fn: () => push(".") },
    { l: "xʸ",  kind: "fn",   fn: () => push("^") },
    { l: "+",   kind: "op",   fn: () => push("+") },
    { l: "ANS", kind: "ans",  fn: doAns },
    { l: "%",   kind: "fn",   fn: () => push("%") },
    { l: "√",   kind: "fn",   fn: () => push("sqrt(") },
    { l: "=",   kind: "eq",   fn: doEval },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060608",
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 23px,rgba(255,255,255,0.012) 23px,rgba(255,255,255,0.012) 24px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace",
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Calculator */}
      <div style={{
        width: "290px",
        transform: cliOpen ? "translateY(-25vh)" : "translateY(0)",
        transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Display */}
        <div style={{
          background: "#030305", border: "1px solid #1a1a20",
          borderRadius: "14px 14px 0 0", padding: "18px 18px 12px",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.8)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.1) 2px,rgba(0,0,0,0.1) 4px)", pointerEvents: "none" }} />
          <div style={{ color: "#28262e", fontSize: "10px", textAlign: "right", minHeight: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "10px", letterSpacing: "0.8px", position: "relative" }}>
            {expr || "·"}
          </div>
          <div style={{
            fontSize: dispFS, fontWeight: "300",
            color: isResult ? "#e8e0d8" : "#3d3840",
            textAlign: "right", minHeight: "48px",
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: "-0.5px", position: "relative",
            textShadow: isResult ? "0 0 40px rgba(232,224,216,0.1)" : "none",
            transition: "color 0.12s",
          }}>
            {display}
          </div>
          <div style={{ color: "#15253a", fontSize: "9px", marginTop: "8px", letterSpacing: "2px", position: "relative" }}>
            ANS <span style={{ color: "#1e3a50" }}>{ans}</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          background: "#0a0a0c", border: "1px solid #1a1a20", borderTop: "none",
          borderRadius: "0 0 14px 14px", padding: "10px",
          display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.95)",
        }}>
          {calcButtons.map((b, i) => <Key key={i} label={b.l} kind={b.kind} onClick={b.fn} />)}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setCliOpen(o => !o)}
          style={{
            width: "100%", marginTop: "8px", padding: "9px",
            background: "transparent",
            border: `1px solid ${cliOpen ? "#1a3a1a" : "#141418"}`,
            color: cliOpen ? "#22c55e" : "#1e2820",
            fontSize: "9px", fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer", borderRadius: "10px", letterSpacing: "3.5px",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.color = "#4ade80"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = cliOpen?"#1a3a1a":"#141418"; e.currentTarget.style.color = cliOpen?"#22c55e":"#1e2820"; }}
        >
          {cliOpen ? "▲  CLOSE TERMINAL" : "▼  OPEN TERMINAL"}
        </button>
      </div>

      {/* Terminal panel */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: "48vh",
        background: "#020205", borderTop: "1px solid #0c180c",
        transform: cliOpen ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        fontFamily: "'JetBrains Mono', monospace",
        zIndex: 10,
      }}>
        {/* Title bar */}
        <div
          onClick={() => setCliOpen(false)}
          style={{
            padding: "7px 16px", background: "#03030a", borderBottom: "1px solid #0a140a",
            display: "flex", alignItems: "center", gap: "8px",
            cursor: "pointer", userSelect: "none", flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#050510"}
          onMouseLeave={e => e.currentTarget.style.background = "#03030a"}
        >
          <span style={{ width:9, height:9, borderRadius:"50%", background:"#3a1515", display:"inline-block" }} />
          <span style={{ width:9, height:9, borderRadius:"50%", background:"#3a3010", display:"inline-block" }} />
          <span style={{ width:9, height:9, borderRadius:"50%", background:"#10203a", display:"inline-block" }} />
          <span style={{ color:"#1a4a1a", marginLeft:"10px", letterSpacing:"3px", fontSize:"9px" }}>MATHSHELL v1.0</span>
          <span style={{ fontSize:"9px", marginLeft:"auto", transition:"color 0.4s", color: savedFlash ? "#22c55e" : "#0d2010" }}>{savedFlash ? "● SAVED" : "click to collapse ▲"}</span>
        </div>

        {/* Output */}
        <div style={{ flex:1, overflow:"auto", padding:"10px 16px 4px", lineHeight:"1.7" }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              whiteSpace:"pre-wrap", wordBreak:"break-all",
              color: l.type==="in" ? "#86efac" : l.type==="sys" ? "#1f4525" : "#4ade80",
              marginBottom:"2px", fontSize:"12px",
            }}>
              {l.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input row */}
        <div style={{
          padding:"8px 16px", borderTop:"1px solid #0a140a",
          background:"#03030a", display:"flex", alignItems:"center", gap:"8px", flexShrink:0,
        }}>
          <span style={{ color:"#1a5020", fontSize:"12px", whiteSpace:"nowrap", flexShrink:0 }}>{promptStr}</span>
          <input
            ref={inpRef}
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              flex:1, background:"transparent", border:"none", outline:"none",
              color:"#86efac", fontSize:"12px",
              fontFamily:"'JetBrains Mono', monospace",
              caretColor:"#4ade80", minWidth:0,
            }}
            placeholder="type a command… (Tab to complete, ↑↓ history)"
          />
        </div>
      </div>
    </div>
  );
}
