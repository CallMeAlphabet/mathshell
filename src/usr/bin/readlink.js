export const help = "readlink [-f] [-e] [-m] [path]\n  Print resolved symlink target.\n  In mash, no symlinks exist; -f resolves to absolute path.\n  -f  canonicalize (resolves to absolute path)\n  -e  canonicalize; error if not exist\n  -m  canonicalize; allow missing\n  Examples:\n    readlink -f .\n    readlink -f /home/user/../etc\n";
export default function readlink(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let force=false, strict=false;
  const files=[];
  for (const a of args) {
    if (a==="-f") force=true;
    else if (a==="-e") { force=true; strict=true; }
    else if (a==="-m") force=true;
    else if (!a.startsWith("-")) files.push(a);
  }
  if (!files.length) return { output: "readlink: missing operand\n", exitCode: 1 };
  const out=[]; let ec=0;
  for (const f of files) {
    const p=norm(f);
    if (strict && !vfs.exists(p)) { out.push(`readlink: ${f}: No such file or directory`); ec=1; continue; }
    out.push(force?p:p);
  }
  return { output: out.join("\n")+"\n", exitCode: ec };
}
