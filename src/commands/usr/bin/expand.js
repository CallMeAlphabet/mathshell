export const help = "expand [-t N] [file]\n  Convert tabs to spaces.\n  -t N  use tab stops at multiples of N (default: 8)\n  Examples:\n    expand file.txt\n    echo -e 'a\\tb' | expand -t 4\n";
export default function expand(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let tabSize=8; const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-t"&&args[i+1]) tabSize=parseInt(args[++i]);
    else if (/^-t\d+$/.test(a)) tabSize=parseInt(a.slice(2));
    else if (!a.startsWith("-")) files.push(a);
  }
  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  const proc=line=>{
    let out=""; let col=0;
    for (const c of line) {
      if (c==="\t") { const sp=tabSize-(col%tabSize); out+=" ".repeat(sp); col+=sp; }
      else { out+=c; col++; }
    }
    return out;
  };
  return { output: text.split("\n").map(proc).join("\n"), exitCode: 0 };
}
