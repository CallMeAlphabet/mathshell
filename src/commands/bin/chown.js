export const help = `chown [-R] OWNER[:GROUP] FILE...
  Change file owner and group (stored in VFS metadata; not enforced).
  -R  apply recursively
  Example:
    chown user file.txt
    chown user:users dir/
`;

export default function chown(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let recursive = false; const files = []; let owner = null;
  for (const a of args) {
    if (a === "-R") recursive = true;
    else if (!owner) owner = a;
    else files.push(a);
  }
  if (!owner || !files.length) return { output: "chown: missing operand\n", exitCode: 1 };
  for (const f of files) {
    const p = norm(f);
    if (!vfs.exists(p)) return { output: `chown: cannot access '${f}': No such file or directory\n`, exitCode: 1 };
    const n = vfs.stat(p); if (n) { n.owner = owner.split(":")[0]; n.group = owner.split(":")[1] ?? owner.split(":")[0]; }
  }
  return { output: "", exitCode: 0 };
}
