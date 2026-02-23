export const help = "rev [file]\n  Reverse each line character-by-character.\n  Example:\n    echo 'hello' | rev    → olleh\n    rev file.txt\n";
export default function rev(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let text=stdin??"";
  const fileArg=args.find(a=>!a.startsWith("-"));
  if (fileArg) { const p=norm(fileArg); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  return { output: text.split("\n").map(l=>[...l].reverse().join("")).join("\n"), exitCode: 0 };
}
