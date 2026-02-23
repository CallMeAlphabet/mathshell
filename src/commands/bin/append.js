export const help = "append FILE TEXT...\n  Append text to a file.\n";
export default function append(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  if (args.length < 2) return { output: "append: usage: append <file> <text...>\n", exitCode: 1 };
  vfs.append(norm(args[0]), args.slice(1).join(" ") + "\n");
  return { output: "", exitCode: 0 };
}
