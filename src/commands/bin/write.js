export const help = "write FILE TEXT...\n  Write text to a file.\n";
export default function write(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  if (args.length < 2) return { output: "write: usage: write <file> <text...>\n", exitCode: 1 };
  vfs.write(norm(args[0]), args.slice(1).join(" ") + "\n");
  return { output: "", exitCode: 0 };
}
