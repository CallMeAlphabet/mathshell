export const help = `mv [-v] [-f] <src...> <dst>
  Move or rename files or directories.
  -v  verbose
  -f  force (overwrite without prompt)
  Examples:
    mv old.txt new.txt
    mv file.txt /tmp/
    mv dir1 dir2
`;
export default function mv(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let verbose=false;
  const fileArgs=[];
  for (const a of args) {
    if (/^-[vfi]+$/.test(a)) { if (a.includes("v")) verbose=true; }
    else fileArgs.push(a);
  }
  if (fileArgs.length < 2) return { output: "mv: missing destination file operand\n", exitCode: 1 };
  const dst=norm(fileArgs[fileArgs.length-1]);
  let out="";
  for (const s of fileArgs.slice(0,-1)) {
    const sp=norm(s);
    const err=vfs.mv(sp, dst);
    if (err) return { output: err+"\n", exitCode: 1 };
    const dest=vfs.isDir(dst)?dst+"/"+sp.split("/").pop():dst;
    if (verbose) out+=`renamed '${sp}' -> '${dest}'\n`;
  }
  return { output: out, exitCode: 0 };
}
