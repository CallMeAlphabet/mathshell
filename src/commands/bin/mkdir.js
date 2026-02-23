export const help = `mkdir [-p] [-v] <dir...>
  Create one or more directories.
  -p  create parent directories as needed; no error if exists
  -v  verbose: print each directory created
  Examples:
    mkdir projects
    mkdir -p /home/user/a/b/c
    mkdir dir1 dir2 dir3
`;
export default function mkdir(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let mkP=false, verbose=false; const dirs=[];
  for (const a of args) {
    if (a==="-p"||a==="--parents") mkP=true;
    else if (a==="-v"||a==="--verbose") verbose=true;
    else dirs.push(a);
  }
  if (!dirs.length) return { output: "mkdir: missing operand\n", exitCode: 1 };
  let out="";
  for (const d of dirs) {
    const p=norm(d);
    if (mkP) { vfs._mkdirP(p); if (verbose) out+=`mkdir: created directory '${p}'\n`; }
    else { const err=vfs.mkdir(p); if (err) return { output: err+"\n", exitCode: 1 }; if (verbose) out+=`mkdir: created directory '${p}'\n`; }
  }
  return { output: out, exitCode: 0 };
}
