export const help = `touch [-a] [-m] [-t TIME] <file...>
  Update file timestamps or create empty files.
  -a  change access time only (mash: same as default)
  -m  change modification time only (mash: same as default)
  -t TIME  use [[CC]YY]MMDDhhmm[.ss] timestamp (mash: ignored)
  Examples:
    touch newfile.txt
    touch a.txt b.txt c.txt
`;
export default function touch(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const files=args.filter(a=>!a.startsWith("-"));
  if (!files.length) return { output: "touch: missing file operand\n", exitCode: 1 };
  for (const f of files) vfs.touch(norm(f));
  return { output: "", exitCode: 0 };
}
