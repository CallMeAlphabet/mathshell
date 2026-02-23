// find — search filesystem
export const help = `find [path...] [expression]
  Search for files in a directory hierarchy.
  Options:
    -name GLOB       match filename (supports * and ?)
    -iname GLOB      case-insensitive name match
    -type f|d|l      file type: f=regular, d=directory, l=symlink
    -maxdepth N      limit search depth
    -mindepth N      skip entries shallower than N
    -size [+/-]N[c]  match file size (c=bytes, k=kB, M=MB)
    -newer FILE      newer than FILE
    -empty           find empty files or directories
    -print           print matching paths (default)
    -not / !         negate next expression
    -and / -a        logical AND (default)
    -or / -o         logical OR
    -exec CMD {} ;   execute CMD for each match
    -delete          delete matching files
  Examples:
    find /home/user -name '*.txt'
    find . -type f
    find /etc -maxdepth 1 -name '*.conf'
    find . -size +1k
    find . -empty
    find . -name '*.log' -delete
`;

export default function find(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let searchPaths = [], maxDepth = Infinity, minDepth = 0;
  let namePat = null, inamePat = null, typeF = null, sizeSpec = null;
  let newerFile = null, emptyOnly = false, doDelete = false;
  let execCmd = null;
  let negate = false;

  const i2Paths = [];
  let i = 0;
  // collect leading paths (non-option args)
  while (i < args.length && !args[i].startsWith("-") && args[i] !== "!") {
    i2Paths.push(args[i++]);
  }
  if (i2Paths.length) searchPaths = i2Paths;
  else searchPaths = [sh.cwd];

  while (i < args.length) {
    const a = args[i];
    if (a === "-name"     && args[i+1]) { namePat  = args[++i]; }
    else if (a === "-iname"  && args[i+1]) { inamePat = args[++i]; }
    else if (a === "-type"   && args[i+1]) { typeF    = args[++i]; }
    else if (a === "-maxdepth" && args[i+1]) { maxDepth = parseInt(args[++i]); }
    else if (a === "-mindepth" && args[i+1]) { minDepth = parseInt(args[++i]); }
    else if (a === "-size"   && args[i+1]) { sizeSpec = args[++i]; }
    else if (a === "-newer"  && args[i+1]) { newerFile = args[++i]; }
    else if (a === "-empty") { emptyOnly = true; }
    else if (a === "-delete") { doDelete = true; }
    else if (a === "-print" || a === "-print0") { /* default */ }
    else if (a === "-not" || a === "!")   { negate = true; }
    else if (a === "-exec") {
      const parts = [];
      while (args[++i] && args[i] !== ";") parts.push(args[i]);
      execCmd = parts;
    }
    i++;
  }

  const globToRe = pat => new RegExp("^" +
    pat.replace(/[.+^${}()|[\]\\]/g, c => "\\" + c)
       .replace(/\*/g, ".*").replace(/\?/g, ".") + "$");

  const checkSize = (node, spec) => {
    if (!spec) return true;
    const m = spec.match(/^([+-]?)(\d+)([ckMG]?)$/);
    if (!m) return true;
    const [, sign, num, unit] = m;
    const mul = { c:1, k:1024, M:1024**2, G:1024**3, "":512 }[unit] ?? 1;
    const target = parseInt(num) * mul;
    const actual = node.size ?? 0;
    if (sign === "+") return actual > target;
    if (sign === "-") return actual < target;
    return actual === target;
  };

  const newerMtime = newerFile ? (vfs.stat(norm(newerFile))?.mtime ?? 0) : 0;
  const matches = [];

  for (const sp of searchPaths) {
    const base = norm(sp);
    if (!vfs.exists(base)) {
      return { output: `find: '${sp}': No such file or directory\n`, exitCode: 1 };
    }
    const baseDepth = base.split("/").filter(Boolean).length;

    // include the base itself
    const checkEntry = (k, node) => {
      const depth = k.split("/").filter(Boolean).length - baseDepth;
      if (depth < minDepth || depth > maxDepth) return false;
      const base2 = k.split("/").pop();
      if (namePat  && !globToRe(namePat).test(base2))   return false;
      if (inamePat && !globToRe(inamePat).test(base2.toLowerCase())) return false;
      if (typeF === "f" && node.type !== "file")  return false;
      if (typeF === "d" && node.type !== "dir")   return false;
      if (typeF === "l") return false; // no symlinks
      if (sizeSpec && !checkSize(node, sizeSpec)) return false;
      if (newerFile && (node.mtime ?? 0) <= newerMtime) return false;
      if (emptyOnly) {
        if (node.type === "file" && (node.size ?? 0) > 0) return false;
        if (node.type === "dir"  && vfs.ls(k).length > 0) return false;
      }
      return true;
    };

    // base dir itself (depth 0)
    if (minDepth === 0) {
      const bn = vfs.stat(base) ?? { type: "dir", mtime: Date.now(), size: 0 };
      if (checkEntry(base, bn)) matches.push(base);
    }

    for (const k of Object.keys(vfs._t).sort()) {
      if (!k.startsWith(base === "/" ? "/" : base + "/")) continue;
      if (k === base) continue;
      const node = vfs._t[k];
      if (checkEntry(k, node)) matches.push(k);
    }
  }

  if (doDelete) {
    for (const m of matches) {
      if (vfs.isFile(m)) vfs.rm(m);
    }
  }

  const out = matches.join("\n") + (matches.length ? "\n" : "");
  return { output: out, exitCode: 0 };
}
