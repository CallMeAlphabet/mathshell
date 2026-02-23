export const help = `cut [-d DELIM] [-f FIELDS] [-c CHARS] [-s] [file...]
  Remove sections from each line of files.
  -d DELIM  field delimiter (default: tab)
  -f FIELDS field list: 1,3 or 2-4 or 1-3,5
  -c CHARS  character positions: 1,3 or 2-5
  -s        suppress lines without delimiter (with -f)
  Examples:
    cut -d: -f1 /etc/passwd
    echo 'a,b,c' | cut -d, -f2
    echo 'hello' | cut -c1-3
    cut -d' ' -f1,3 file.txt
`;
export default function cut(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let delim="\t", fields=null, chars=null, suppress=false;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-d" && args[i+1]) delim=args[++i];
    else if (a==="-f" && args[i+1]) fields=parseRange(args[++i]);
    else if (a==="-c" && args[i+1]) chars=parseRange(args[++i]);
    else if (a==="-s"||a==="--only-delimited") suppress=true;
    else if (!a.startsWith("-")) files.push(a);
    // handle -d= form
    else if (a.startsWith("-d")) delim=a.slice(2);
    else if (a.startsWith("-f")) fields=parseRange(a.slice(2));
    else if (a.startsWith("-c")) chars=parseRange(a.slice(2));
  }

  function parseRange(s) {
    return s.split(",").flatMap(r=>{
      if (r.includes("-")) {
        const [a2,b]=r.split("-").map(v=>v===''?null:parseInt(v));
        if (a2===null) return []; // e.g. -3 means 1-3
        if (b===null) return { from: a2 }; // open-ended
        return Array.from({length:b-a2+1},(_,j)=>a2+j);
      }
      return [parseInt(r)];
    });
  }

  let text = stdin ?? "";
  if (files.length) {
    let combined = "";
    for (const f of files) { const p=norm(f); if (!vfs.isFile(p)) return { output: `cut: ${f}: No such file or directory\n`, exitCode: 1 }; combined+=vfs.read(p)??"";}
    text=combined;
  }

  const ls=text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
  const out=ls.map(line=>{
    if (chars) {
      // character ranges (1-based)
      const positions = new Set();
      for (const r of chars) {
        if (typeof r === "object" && r.from) { for (let i=r.from;i<=line.length;i++) positions.add(i); }
        else positions.add(r);
      }
      return [...line].filter((_,i)=>positions.has(i+1)).join("");
    }
    if (fields) {
      if (!line.includes(delim)) return suppress ? null : line;
      const parts=line.split(delim);
      const positions = new Set();
      for (const r of fields) {
        if (typeof r === "object" && r.from) { for (let i=r.from;i<=parts.length;i++) positions.add(i); }
        else positions.add(r);
      }
      return [...positions].sort((a,b)=>a-b).map(f=>parts[f-1]??"").join(delim);
    }
    return line;
  }).filter(l=>l!==null);
  return { output: out.join("\n")+"\n", exitCode: 0 };
}
