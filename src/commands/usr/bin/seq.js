export const help = `seq [OPTION] [FIRST [INCREMENT]] LAST
  Print a sequence of numbers.
  -s SEP  use SEP as separator (default: newline)
  -w      equalize width by padding with leading zeros
  -f FMT  use printf-style format (e.g. %05.2f)
  Examples:
    seq 5           → 1\\n2\\n3\\n4\\n5
    seq 2 10        → 2 through 10
    seq 0 2 10      → 0 2 4 6 8 10
    seq 10 -1 1     → 10 down to 1
    seq -s, 5       → 1,2,3,4,5
    seq -w 1 10     → 01 02 ... 10
`;
export default function seq(args) {
  let sep="\n", pad=false, fmt=null;
  const nums=[];
  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-s"&&args[i+1]) sep=args[++i];
    else if (a==="-w"||a==="--equal-width") pad=true;
    else if ((a==="-f"||a==="--format")&&args[i+1]) fmt=args[++i];
    else if (!a.startsWith("-")||/^-\d/.test(a)) nums.push(parseFloat(a));
  }
  let start=1, step=1, end=1;
  if (nums.length===1) end=nums[0];
  else if (nums.length===2) [start,end]=nums;
  else if (nums.length>=3) [start,step,end]=nums;
  if (!step || (step>0&&start>end) || (step<0&&start<end)) return { output: "", exitCode: 0 };
  const out=[];
  const maxWidth = pad ? Math.max(String(Math.floor(start)).length, String(Math.floor(end)).length) : 0;
  for (let n=start; step>0?n<=end+1e-10:n>=end-1e-10; n+=step) {
    const rounded=Math.round(n*1e10)/1e10;
    let s;
    if (fmt) s=sprintfNum(fmt, rounded);
    else if (pad) s=String(Math.round(rounded)).padStart(maxWidth,"0");
    else s=String(rounded);
    out.push(s);
  }
  return { output: out.join(sep)+"\n", exitCode: 0 };
}

function sprintfNum(fmt, n) {
  return fmt.replace(/%([0-9.]*)([dfe])/, (_, spec, t) => {
    if (t==="d") return String(Math.round(n)).padStart(parseInt(spec)||0,"0");
    if (t==="f") { const [w,p]=spec.split(".").map(Number); return n.toFixed(p??6); }
    if (t==="e") return n.toExponential(parseInt(spec.split(".")[1])||6);
    return String(n);
  });
}
