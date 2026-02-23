export const help = "nano FILE\n  Text editor (non-interactive in MASH).\n  Use echo/redirection to write: echo 'text' > file\n";
export default function nano(args, { vfs, sh }, cmd = "nano") {
  const norm = p => vfs.resolve(p, sh.cwd);
  if (!args.length) return { output: `${cmd}: no file specified\n`, exitCode: 1 };
  const p = norm(args[0]);
  if (!vfs.exists(p)) vfs.touch(p);
  if (vfs.isDir(p)) return { output: `${cmd}: ${args[0]}: Is a directory\n`, exitCode: 1 };
  const content = vfs.read(p) ?? "";
  return { output: `[${cmd} is not interactive in mash. File contents:\n${content || "(empty file)"}\nUse redirection to write: echo 'text' > ${args[0]}]\n`, exitCode: 0 };
}
