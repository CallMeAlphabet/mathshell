export const help = "rmdir [-p] <dir...>\n  Remove empty directories.\n  -p  remove parent directories too if they become empty\n  Use 'rm -rf' for non-empty directories.\n  Examples:\n    rmdir emptydir\n    rmdir -p a/b/c\n";
export default function rmdir(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let parents=false; const dirs=[];
  for (const a of args) { if (a==="-p"||a==="--parents") parents=true; else dirs.push(a); }
  for (const d of dirs) {
    let p=norm(d);
    const err=vfs.rmdir(p); if (err) return { output: err+"\n", exitCode: 1 };
    if (parents) {
      while (p.includes("/") && p !== "/") {
        p = p.slice(0, p.lastIndexOf("/")) || "/";
        if (vfs.ls(p).length > 0) break;
        const e2=vfs.rmdir(p); if (e2) break;
      }
    }
  }
  return { output: "", exitCode: 0 };
}
