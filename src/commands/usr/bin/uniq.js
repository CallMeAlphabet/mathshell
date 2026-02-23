export const help = `uniq [-c] [-d] [-u] [-i] [-f N] [-s N] [-w N] [file]
  Filter adjacent duplicate lines.
  -c  prefix each line with occurrence count
  -d  print only duplicate lines
  -u  print only unique (non-repeated) lines
  -i  case-insensitive comparison
  -f N  skip first N fields
  -s N  skip first N characters
  -w N  compare only first N characters
  Tip: pipe through sort first to deduplicate all duplicates.
  Examples:
    sort file.txt | uniq
    sort file.txt | uniq -c | sort -rn
    uniq -d file.txt
`;
export default function uniq(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let cnt=false, dupOnly=false, uniqOnly=false, icase=false;
  let skipFields=0, skipChars=0, maxChars=Infinity;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (/^-[cduiDU]+$/.test(a)) {
      if (a.includes("c")) cnt=true;
      if (a.includes("d")) dupOnly=true;
      if (a.includes("u")) uniqOnly=true;
      if (a.includes("i")) icase=true;
    } else if ((a==="-f"||a.startsWith("-f")) && args[i+1]) skipFields=parseInt(args[++i]);
    else if ((a==="-s"||a.startsWith("-s")) && args[i+1]) skipChars=parseInt(args[++i]);
    else if ((a==="-w"||a.startsWith("-w")) && args[i+1]) maxChars=parseInt(args[++i]);
    else if (!a.startsWith("-")) files.push(a);
  }

  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  let ls=text.split("\n"); if (ls[ls.length-1]==="") ls.pop();

  const cmpKey = line => {
    let k=line;
    if (skipFields) { const f=line.split(/\s+/); k=f.slice(skipFields).join(" "); }
    if (skipChars)  k=k.slice(skipChars);
    if (maxChars<Infinity) k=k.slice(0,maxChars);
    return icase?k.toLowerCase():k;
  };

  const out=[]; let prev=undefined, c=0;
  const flush=(l,count)=>{
    if (dupOnly && count<2) return;
    if (uniqOnly && count>1) return;
    out.push(cnt ? `${String(count).padStart(7)} ${l}` : l);
  };
  for (const l of ls) {
    if (cmpKey(l)===prev) c++;
    else { if (prev!==undefined) flush(ls[out.length+ls.filter((_,i2)=>cmpKey(ls[i2])===prev).length-1], c); prev=cmpKey(l); c=1; }
  }
  // simpler approach
  const out2=[]; let p2=undefined, c2=0, repr="";
  for (const l of ls) {
    const k=cmpKey(l);
    if (k===p2) { c2++; }
    else { if (p2!==undefined) { if (!dupOnly||c2>1) if (!uniqOnly||c2===1) out2.push(cnt?`${String(c2).padStart(7)} ${repr}`:repr); } p2=k; c2=1; repr=l; }
  }
  if (p2!==undefined) { if (!dupOnly||c2>1) if (!uniqOnly||c2===1) out2.push(cnt?`${String(c2).padStart(7)} ${repr}`:repr); }
  return { output: out2.join("\n")+(out2.length?"\n":""), exitCode: 0 };
}
