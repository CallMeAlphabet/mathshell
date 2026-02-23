export const help = "shuf [-n N] [-i LO-HI] [-e] [-o FILE] [-r] [file]\n  Randomly shuffle lines or generate random permutations.\n  -n N      output at most N lines\n  -i LO-HI  generate numbers from LO to HI instead of reading input\n  -e        treat args as input lines\n  -r        repeat output lines\n  Examples:\n    shuf file.txt\n    shuf -n 3 file.txt\n    shuf -i 1-10\n    shuf -e apple banana cherry\n";
export default function shuf(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let n=Infinity, range=null, echo2=false, repeat=false, outFile=null;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-n"&&args[i+1]) n=parseInt(args[++i]);
    else if (a==="-i"&&args[i+1]) range=args[++i].split("-").map(Number);
    else if (a==="-e") echo2=true;
    else if (a==="-r") repeat=true;
    else if ((a==="-o")&&args[i+1]) outFile=args[++i];
    else if (!a.startsWith("-")) files.push(a);
  }
  let lines;
  if (range) { lines=Array.from({length:range[1]-range[0]+1},(_,i)=>String(range[0]+i)); }
  else if (echo2) { lines=files; }
  else {
    let text=stdin??"";
    if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
    lines=text.split("\n"); if (lines[lines.length-1]==="") lines.pop();
  }
  // Fisher-Yates
  for (let i=lines.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [lines[i],lines[j]]=[lines[j],lines[i]]; }
  const result=lines.slice(0,n===Infinity?lines.length:n);
  const out=result.join("\n")+"\n";
  if (outFile) { vfs.write(vfs.resolve(outFile,sh.cwd), out); return { output: "", exitCode: 0 }; }
  return { output: out, exitCode: 0 };
}
