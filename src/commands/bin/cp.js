export const help = `cp [-r] [-p] [-v] [-f] <src...> <dst>
  Copy files or directories.
  -r  recursive (copy directories)
  -p  preserve timestamps
  -v  verbose
  -f  force (overwrite without prompt)
  Examples:
    cp file.txt backup.txt
    cp notes.txt /tmp/
    cp -r src/ dst/
`;
export default function cp(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let recursive=false, preserve=false, verbose=false;
  const fileArgs=[];
  for (const a of args) {
    if (/^-[rRpvf]+$/.test(a)) {
      if (/[rR]/.test(a)) recursive=true;
      if (a.includes("p")) preserve=true;
      if (a.includes("v")) verbose=true;
    } else fileArgs.push(a);
  }
  if (fileArgs.length < 2) return { output: "cp: missing destination file operand\n", exitCode: 1 };
  const dst=norm(fileArgs[fileArgs.length-1]);
  let out="";
  for (const s of fileArgs.slice(0,-1)) {
    const sp=norm(s);
    if (!vfs.exists(sp)) return { output: `cp: cannot stat '${s}': No such file or directory\n`, exitCode: 1 };
    if (recursive && vfs.isDir(sp)) {
      const destDir = vfs.isDir(dst) ? dst+"/"+sp.split("/").pop() : dst;
      vfs._mkdirP(destDir);
      for (const k of Object.keys(vfs._t).filter(k2=>k2.startsWith(sp+"/"))) {
        const rel=k.slice(sp.length);
        const np=destDir+rel;
        if (vfs._t[k].type==="dir") vfs._mkdirP(np);
        else { const content=vfs._t[k].content; vfs._wf(np, content); if (preserve) vfs._t[np].mtime=vfs._t[k].mtime; }
        if (verbose) out+=`'${k}' -> '${np}'\n`;
      }
    } else {
      const err=vfs.cp(sp, dst); if (err) return { output: err+"\n", exitCode: 1 };
      const dest=vfs.isDir(dst)?dst+"/"+sp.split("/").pop():dst;
      if (preserve) vfs._t[dest].mtime=vfs._t[sp].mtime;
      if (verbose) out+=`'${sp}' -> '${dest}'\n`;
    }
  }
  return { output: out, exitCode: 0 };
}
