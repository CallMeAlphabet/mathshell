export const help = "realpath [path...]\n  Print the resolved absolute path.\n  Examples:\n    realpath .\n    realpath ../etc\n    realpath ~/README.txt\n";
export default function realpath(args, { vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  if (!args.length) return { output: "realpath: missing operand\n", exitCode: 1 };
  const out=[]; let ec=0;
  for (const a of args.filter(a=>!a.startsWith("-"))) {
    const p=norm(a);
    if (!vfs.exists(p)) { out.push(`realpath: ${a}: No such file or directory`); ec=1; continue; }
    out.push(p);
  }
  return { output: out.join("\n")+"\n", exitCode: ec };
}
