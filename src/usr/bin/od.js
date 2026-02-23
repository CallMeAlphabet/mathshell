export const help = "od [-A BASE] [-t TYPE] [-N COUNT] [file]\n  Display file in various formats.\n  -A o|d|x|n  address base: octal(default), decimal, hex, none\n  -t o|d|x|c|a  output type per byte: octal, decimal, hex, char, named-char\n  -N N  limit to N bytes\n  Examples:\n    echo 'ABC' | od\n    echo 'ABC' | od -t x1\n    echo 'ABC' | od -t c\n";
export default function od(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let addrBase="o", type="o2", limit=Infinity;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if ((a==="-A")&&args[i+1]) addrBase=args[++i];
    else if ((a==="-t")&&args[i+1]) type=args[++i];
    else if ((a==="-N")&&args[i+1]) limit=parseInt(args[++i]);
    else if (!a.startsWith("-")) files.push(a);
  }
  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  const bytes=[...text.slice(0,limit)].map(c=>c.charCodeAt(0));
  const out=[]; let addr=0;
  const fmtAddr=n=>addrBase==="o"?n.toString(8).padStart(7,"0"):addrBase==="d"?String(n).padStart(7):addrBase==="x"?n.toString(16).padStart(7,"0"):"";

  for (let i=0; i<bytes.length; i+=16) {
    const chunk=bytes.slice(i,i+16);
    const base=type[0]==="x"?"hex":type[0]==="d"?"dec":type[0]==="c"?"char":"oct";
    let vals;
    if (base==="hex")  vals=chunk.map(b=>b.toString(16).padStart(2,"0")).join(" ");
    else if (base==="dec") vals=chunk.map(b=>String(b).padStart(3)).join(" ");
    else if (base==="char") vals=chunk.map(b=>b<32?`.`:String.fromCharCode(b)).join("  ");
    else vals=chunk.map(b=>b.toString(8).padStart(3,"0")).join(" ");
    const addrStr=addrBase==="n"?"":fmtAddr(addr);
    out.push((addrStr?addrStr+"  ":"")+vals);
    addr+=16;
  }
  if (addrBase!=="n") out.push(fmtAddr(addr));
  return { output: out.join("\n")+"\n", exitCode: 0 };
}
