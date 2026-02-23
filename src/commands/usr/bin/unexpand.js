export const help = "unexpand [-t N] [-a] [file]\n  Convert spaces to tabs.\n  -t N  use tab stops at multiples of N (default: 8)\n  -a    convert all whitespace, not just leading\n  Examples:\n    unexpand -t 4 file.txt\n    expand file.txt | unexpand\n";
export default function unexpand(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let tabSize=8, all=false; const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-t"&&args[i+1]) tabSize=parseInt(args[++i]);
    else if (/^-t\d+$/.test(a)) tabSize=parseInt(a.slice(2));
    else if (a==="-a") all=true;
    else if (!a.startsWith("-")) files.push(a);
  }
  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  const proc=line=>{
    let out=""; let col=0; let inLeading=true;
    for (let i=0; i<line.length; i++) {
      const c=line[i];
      if (c!==" "&&c!=="\t") inLeading=false;
      if ((inLeading||all) && c===" ") {
        col++;
        if (col%tabSize===0) { out+="\t"; }
        else { out+=" "; }
      } else { out+=c; if (c==="\t") col+=tabSize-(col%tabSize); else col++; }
    }
    return out;
  };
  return { output: text.split("\n").map(proc).join("\n"), exitCode: 0 };
}
