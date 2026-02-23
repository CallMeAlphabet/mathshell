import { mathEval, fmtNum } from "../../_utils/math.js";
export const help = "bc [-l] [file]\n  Arbitrary precision calculator.\n  Reads expressions from stdin/file, one per line.\n  Supports: + - * / ^ % sqrt() sin() cos() log() floor() ceil() pi e\n  -l  enable math library (always on in mash)\n  Examples:\n    echo '2^10' | bc\n    echo 'sqrt(144)' | bc\n    echo 'sin(pi/2)' | bc\n    bc <<< '22/7'\n";
export default function bc(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const fileArgs=args.filter(a=>!a.startsWith("-"));
  let input=(stdin??"");
  if (fileArgs.length) { const p=norm(fileArgs[0]); if (vfs.isFile(p)) input=vfs.read(p)??"";}
  if (!input.trim()) { if (args.join(" ").trim()) input=args.filter(a=>!a.startsWith("-")).join(" "); }
  if (!input.trim()) return { output: "", exitCode: 0 };
  const res=[];
  for (const line of input.split("\n")) {
    const l=line.trim(); if (!l||l.startsWith("#")||l.startsWith("/*")) continue;
    try { res.push(fmtNum(mathEval(l))); } catch(e) { res.push(`(error: ${e.message})`); }
  }
  return { output: res.join("\n")+"\n", exitCode: 0 };
}
