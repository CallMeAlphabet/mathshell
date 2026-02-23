export const help = "paste [-d DELIM] [-s] [file...]\n  Merge lines of files side by side.\n  -d DELIM  use DELIM as separator (default: tab)\n  -s        serial: all lines from each file concatenated\n  Examples:\n    paste file1 file2\n    paste -d, file1 file2\n    paste -s file.txt\n    seq 5 | paste -d, -s\n";
export default function paste(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let delim="\t", serial=false;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-d"&&args[i+1]) delim=args[++i].replace(/\\t/g,"\t").replace(/\\n/g,"\n");
    else if (a.startsWith("-d")) delim=a.slice(2).replace(/\\t/g,"\t");
    else if (a==="-s") serial=true;
    else if (!a.startsWith("-")) files.push(a);
  }
  const delims=[...delim]; // support multi-char delimiter rotation

  const getLines=f=>{
    if (f==="-") return (stdin??"").split("\n").filter((_,i,a)=>i<a.length-1||a[a.length-1]!=="");
    const p=norm(f); if (!vfs.isFile(p)) return [];
    const t=vfs.read(p)??""; const ls=t.split("\n"); if (ls[ls.length-1]==="") ls.pop(); return ls;
  };
  const allLines=files.length?files.map(getLines):[[(stdin??"").replace(/\n$/,"")]];

  if (serial) {
    const out=allLines.map((ls,fi)=>ls.join(delims[fi%delims.length]||"\t"));
    return { output: out.join("\n")+"\n", exitCode: 0 };
  }
  // parallel paste
  const maxLen=Math.max(...allLines.map(l=>l.length));
  const out=[];
  for (let i=0; i<maxLen; i++) {
    out.push(allLines.map((ls,fi)=>(ls[i]??"")+((fi<allLines.length-1)?delims[fi%delims.length]||"\t":"")).join(""));
  }
  return { output: out.join("\n")+"\n", exitCode: 0 };
}
