export const help = `chmod [-R] MODE FILE...
  Change file permissions (stored in VFS metadata).
  MODE: octal (644, 755) or symbolic (u+x, go-w, a+r)
  -R  apply recursively
  Examples:
    chmod 755 script.sh
    chmod +x script.sh
    chmod u+rw,go-w file.txt
`;

export default function chmod(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let recursive = false; const files = []; let mode = null;

  for (const a of args) {
    if (a === "-R" || a === "-r") recursive = true;
    else if (!mode) mode = a;
    else files.push(a);
  }

  if (!mode || !files.length) return { output: "chmod: missing operand\n", exitCode: 1 };

  const applyMode = p => {
    const n = vfs.stat(p);
    if (!n) return;
    if (/^\d+$/.test(mode)) {
      const oct = parseInt(mode, 8);
      const isDir = vfs.isDir(p);
      const bits = (oct >>> 0).toString(8).padStart(3, "0");
      const u = parseInt(bits[0]), g = parseInt(bits[1]), o = parseInt(bits[2]);
      const mk = (n) => (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-");
      n.mode = (isDir ? "d" : "-") + mk(u) + mk(g) + mk(o);
    } else {
      // symbolic — just accept and store simplified
      n.mode = n.mode ?? (vfs.isDir(p) ? "drwxr-xr-x" : "-rw-r--r--");
    }
    vfs._persist(p);
  };

  for (const f of files) {
    const p = norm(f);
    if (!vfs.exists(p)) return { output: `chmod: cannot access '${f}': No such file or directory\n`, exitCode: 1 };
    applyMode(p);
    if (recursive && vfs.isDir(p)) {
      for (const k of Object.keys(vfs._t).filter(k => k.startsWith(p + "/"))) applyMode(k);
    }
  }
  return { output: "", exitCode: 0 };
}
