export const help = "printf FORMAT [ARGUMENT...]\n  Format and print text.\n  Format specifiers: %s %d %i %f %e %g %o %x %X %%\n  Width/precision: %10s %05d %.2f %-20s\n  Escape seqs: \\n \\t \\r \\\\ \\0\n  Examples:\n    printf 'Hello %s!\\n' world\n    printf '%d + %d = %d\\n' 2 3 5\n    printf '%-10s %5d\\n' item 42\n    printf '%05.2f\\n' 3.14159\n";
export default function printf(args) {
  if (!args.length) return { output: "", exitCode: 0 };
  let fmt=args[0].replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\r/g,"\r").replace(/\\\\/g,"\\").replace(/\\0/g,"\0");
  const pa=args.slice(1); let ai=0;
  const out=fmt.replace(/%([-]?)([0-9]*)(?:\.([0-9]+))?([sdifegoxX%])/g,(m,align,width,prec,type)=>{
    if (type==="%") return "%";
    const v=pa[ai++]??0;
    const w=width?parseInt(width):0;
    const p=prec!==undefined?parseInt(prec):-1;
    let s;
    switch(type) {
      case "s": s=p>=0?String(v).slice(0,p):String(v); break;
      case "d": case "i": s=String(parseInt(v)||0).padStart(p>=0?p:0,"0"); break;
      case "f": s=(parseFloat(v)||0).toFixed(p>=0?p:6); break;
      case "e": s=(parseFloat(v)||0).toExponential(p>=0?p:6); break;
      case "g": s=String(parseFloat(v)||0); break;
      case "o": s=(parseInt(v)||0).toString(8); break;
      case "x": s=(parseInt(v)||0).toString(16); break;
      case "X": s=(parseInt(v)||0).toString(16).toUpperCase(); break;
      default:  s=String(v);
    }
    if (w) s=align==="-"?s.padEnd(w):s.padStart(w);
    return s;
  });
  return { output: out, exitCode: 0 };
}
