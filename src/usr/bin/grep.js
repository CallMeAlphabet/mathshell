export const help = `grep [-vinicorwlqEF] [-e pat] [-m N] [-A N] [-B N] [-C N] pattern [file...]
  Search for lines matching a pattern.
  -v  invert match
  -i  ignore case
  -n  prefix with line numbers
  -c  print count of matching lines
  -o  print only the matching part of each line
  -r  recursive search in directories
  -w  match whole words only
  -l  print only filenames with matches
  -q  quiet (no output, exit code only)
  -E  use extended regular expressions (default)
  -F  treat pattern as fixed string (no regex)
  -e  specify pattern explicitly (can repeat)
  -m N  stop after N matches
  -A N  print N lines after each match
  -B N  print N lines before each match
  -C N  print N lines of context (= -A N -B N)
  Examples:
    grep 'hello' file.txt
    grep -i 'error' /var/log/shell.log
    grep -rn 'TODO' /home/user
    grep -v '^#' /etc/shells
    grep -o '[0-9]+' numbers.txt
    grep -A2 'ERROR' log.txt
`;

export default function grep(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let inv = false, icase = false, lnum = false, quiet = false, cnt = false;
  let only = false, recursive = false, word = false, listFiles = false;
  let fixed = false, maxMatch = Infinity;
  let ctxAfter = 0, ctxBefore = 0;
  const patterns = []; const files = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-v" || a === "--invert-match")    inv = true;
    else if (a === "-i" || a === "--ignore-case") icase = true;
    else if (a === "-n" || a === "--line-number") lnum = true;
    else if (a === "-q" || a === "--quiet")       quiet = true;
    else if (a === "-c" || a === "--count")       cnt = true;
    else if (a === "-o" || a === "--only-matching") only = true;
    else if (a === "-r" || a === "-R" || a === "--recursive") recursive = true;
    else if (a === "-w" || a === "--word-regexp") word = true;
    else if (a === "-l" || a === "--files-with-matches") listFiles = true;
    else if (a === "-F" || a === "--fixed-strings") fixed = true;
    else if (a === "-E" || a === "-P")            {} // default extended
    else if ((a === "-e" || a === "--regexp") && args[i+1]) patterns.push(args[++i]);
    else if ((a === "-m" || a === "--max-count") && args[i+1]) maxMatch = parseInt(args[++i]);
    else if ((a === "-A" || a === "--after-context") && args[i+1])  ctxAfter  = parseInt(args[++i]);
    else if ((a === "-B" || a === "--before-context") && args[i+1]) ctxBefore = parseInt(args[++i]);
    else if ((a === "-C" || a === "--context") && args[i+1]) { const n = parseInt(args[++i]); ctxAfter = ctxBefore = n; }
    else if (/^-[vinicorwlqEFe]+$/.test(a)) {
      // combined flags handled individually above, but catch leftover combos
      for (const f of a.slice(1)) {
        if (f==="v") inv=true; else if (f==="i") icase=true; else if (f==="n") lnum=true;
        else if (f==="q") quiet=true; else if (f==="c") cnt=true; else if (f==="o") only=true;
        else if (f==="r"||f==="R") recursive=true; else if (f==="w") word=true;
        else if (f==="l") listFiles=true; else if (f==="F") fixed=true;
      }
    }
    else if (!patterns.length && !files.length && !a.startsWith("-")) patterns.push(a);
    else files.push(a);
  }

  if (!patterns.length) return { output: "grep: missing pattern\n", exitCode: 2 };

  const escapeRe = s => s.replace(/[.+*?^${}()|[\]\\]/g, c => "\\" + c);
  let reSrc = patterns.map(p => fixed ? escapeRe(p) : p).join("|");
  if (word) reSrc = `\\b(?:${reSrc})\\b`;
  let re;
  try { re = new RegExp(reSrc, icase ? "gi" : "g"); }
  catch (e) { return { output: `grep: invalid regex: ${e.message}\n`, exitCode: 2 }; }

  const collectFiles = (path) => {
    if (vfs.isDir(path)) {
      const out = [];
      for (const e of vfs.ls(path)) out.push(...collectFiles((path === "/" ? "" : path) + "/" + e));
      return out;
    }
    return [path];
  };

  const grepText = (text, fname) => {
    const lineArr = text.split("\n");
    if (lineArr[lineArr.length - 1] === "") lineArr.pop();
    const matched = [];
    const printed = new Set();
    let matchCount = 0;

    for (let idx = 0; idx < lineArr.length; idx++) {
      const line = lineArr[idx];
      re.lastIndex = 0;
      const matches = line.match(re);
      const hit = matches !== null;
      if (hit !== inv) {
        if (++matchCount > maxMatch) break;
        if (only && !inv && matches) {
          re.lastIndex = 0;
          for (const m of line.matchAll(re)) {
            let prefix = fname ? fname + ":" : "";
            if (lnum) prefix += (idx + 1) + ":";
            matched.push(prefix + m[0]);
          }
        } else {
          // context: gather lines before and after
          for (let b = Math.max(0, idx - ctxBefore); b < idx; b++) {
            if (!printed.has(b)) { const p = (fname ? fname + "-" : "") + (lnum ? (b+1) + "-" : ""); matched.push(p + lineArr[b]); printed.add(b); }
          }
          const p = (fname ? fname + ":" : "") + (lnum ? (idx+1) + ":" : "");
          matched.push(p + line); printed.add(idx);
          for (let a = idx + 1; a <= Math.min(lineArr.length - 1, idx + ctxAfter); a++) {
            if (!printed.has(a)) { const p2 = (fname ? fname + "-" : "") + (lnum ? (a+1) + "-" : ""); matched.push(p2 + lineArr[a]); printed.add(a); }
          }
          if ((ctxBefore || ctxAfter) && idx + ctxAfter < lineArr.length - 1) matched.push("--");
        }
      }
    }
    // remove trailing --
    while (matched[matched.length - 1] === "--") matched.pop();
    return { lines: matched, count: matchCount };
  };

  let allFiles = [];
  if (files.length) {
    for (const f of files) {
      const p = norm(f);
      if (!vfs.exists(p)) return { output: `grep: ${f}: No such file or directory\n`, exitCode: 2 };
      if (recursive && vfs.isDir(p)) allFiles.push(...collectFiles(p).map(fp => ({ path: fp, label: fp })));
      else allFiles.push({ path: p, label: f });
    }
  } else {
    allFiles = [{ path: null, label: null }];
  }

  const multiFile = allFiles.length > 1;
  const results = []; let ec = 1; let totalCount = 0;

  for (const { path, label } of allFiles) {
    const text = path ? (vfs.read(path) ?? "") : (stdin ?? "");
    const fname = multiFile ? label : null;
    const { lines, count } = grepText(text, fname);
    if (count > 0) ec = 0;
    totalCount += count;
    if (listFiles) { if (count > 0) results.push(label); continue; }
    if (cnt) { results.push((multiFile ? label + ":" : "") + count); continue; }
    results.push(...lines);
  }

  if (quiet) return { output: "", exitCode: ec };
  if (cnt && !listFiles) return { output: results.join("\n") + "\n", exitCode: ec };
  return { output: results.join("\n") + (results.length ? "\n" : ""), exitCode: ec };
}
