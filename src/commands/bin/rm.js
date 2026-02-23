export const help = `rm [-r] [-f] [-v] [-i] <file...>
  Remove files or directories.
  -r  recursive (required for directories)
  -f  force; ignore missing files and errors
  -v  verbose; print each file removed
  -i  interactive (in mash: same as default; non-interactive)
  Examples:
    rm file.txt
    rm -rf mydir
    rm -v file1 file2
`;
export default function rm(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let rec=false, force=false, verbose=false;
  const files=[];
  for (const a of args) {
    if (/^-[rRfviFi]+$/.test(a)) {
      if (/[rR]/.test(a)) rec=true;
      if (a.includes("f"))  force=true;
      if (a.includes("v"))  verbose=true;
    } else files.push(a);
  }
  if (!files.length && !force) return { output: "rm: missing operand\n", exitCode: 1 };
  let out="";
  for (const f of files) {
    const p=norm(f);
    const err=vfs.rm(p, rec);
    if (err && !force) return { output: err+"\n", exitCode: 1 };
    if (!err && verbose) out+=`removed '${p}'\n`;
  }
  return { output: out, exitCode: 0 };
}
