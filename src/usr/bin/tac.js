export const help = "tac [file]\n  Concatenate and print files in reverse (line order).\n  Example:\n    tac file.txt\n    cat file.txt | tac\n";
export default function tac(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const files=args.filter(a=>!a.startsWith("-"));
  if (!files.length) {
    const ls=(stdin??"").split("\n"); if (ls[ls.length-1]==="") ls.pop();
    return { output: ls.reverse().join("\n")+"\n", exitCode: 0 };
  }
  let out="";
  for (const f of files) {
    const p=norm(f);
    if (!vfs.isFile(p)) return { output: `tac: ${f}: No such file or directory\n`, exitCode: 1 };
    const ls=vfs.read(p)??""; const lines=ls.split("\n"); if (lines[lines.length-1]==="") lines.pop();
    out+=lines.reverse().join("\n")+"\n";
  }
  return { output: out, exitCode: 0 };
}
