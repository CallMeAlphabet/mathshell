export const help = "fold [-w N] [-s] [-b] [file]\n  Wrap long lines.\n  -w N  wrap at N characters (default: 80)\n  -s    break at spaces/word boundaries\n  -b    count bytes, not characters\n  Example:\n    echo 'a very long line...' | fold -w 10\n    cat longfile.txt | fold -w 72 -s\n";
export default function fold(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let width=80, wordBreak=false;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-w"&&args[i+1]) width=parseInt(args[++i]);
    else if (/^-w\d+$/.test(a)) width=parseInt(a.slice(2));
    else if (/^-\d+$/.test(a)) width=parseInt(a.slice(1));
    else if (a==="-s") wordBreak=true;
    else if (a==="-b") { /* same as -w in our context */ }
    else if (!a.startsWith("-")) files.push(a);
  }
  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  const proc=line=>{
    if (line.length<=width) return [line];
    if (!wordBreak) {
      const chunks=[];
      for (let i=0; i<line.length; i+=width) chunks.push(line.slice(i,i+width));
      return chunks;
    }
    // break at word boundaries
    const chunks=[]; let cur="";
    for (const word of line.split(/(?<=\s)/)) {
      if (cur.length+word.length>width&&cur.length>0) { chunks.push(cur.trimEnd()); cur=word; }
      else cur+=word;
    }
    if (cur) chunks.push(cur);
    return chunks;
  };
  const out=text.split("\n").flatMap(proc);
  return { output: out.join("\n"), exitCode: 0 };
}
