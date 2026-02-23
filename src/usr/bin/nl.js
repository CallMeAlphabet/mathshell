export const help = "nl [-b STYLE] [-n FORMAT] [-w N] [-s SEP] [-v N] [file]\n  Number lines of files.\n  -b a   number all lines (default)\n  -b t   number non-empty lines only\n  -b n   do not number lines\n  -n ln  left-justify numbers\n  -n rn  right-justify, no padding (default)\n  -n rz  right-justify with leading zeros\n  -w N   use N columns for line number (default: 6)\n  -s SEP use SEP after line number (default: tab)\n  -v N   start counting at N (default: 1)\n  Examples:\n    nl README.txt\n    nl -b t README.txt\n    nl -w 4 -s '. ' file.txt\n";
export default function nl(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let style="a", fmt="rn", width=6, sep="\t", startNum=1;
  const files=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if ((a==="-b")&&args[i+1]) style=args[++i];
    else if ((a==="-n")&&args[i+1]) fmt=args[++i];
    else if ((a==="-w")&&args[i+1]) width=parseInt(args[++i]);
    else if ((a==="-s")&&args[i+1]) sep=args[++i];
    else if ((a==="-v")&&args[i+1]) startNum=parseInt(args[++i]);
    else if (!a.startsWith("-")) files.push(a);
  }
  let text=stdin??"";
  if (files.length) { const p=norm(files[0]); if (vfs.isFile(p)) text=vfs.read(p)??"";}
  const ls=text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
  let num=startNum;
  const out=ls.map(l=>{
    const empty=l==="" && style!=="a";
    if (style==="n"||empty) return " ".repeat(width)+sep+l;
    const numStr = fmt==="rz"?String(num).padStart(width,"0"):
                   fmt==="ln"?String(num).padEnd(width," "):
                   String(num).padStart(width," ");
    num++;
    return numStr+sep+l;
  });
  return { output: out.join("\n")+(out.length?"\n":""), exitCode: 0 };
}
