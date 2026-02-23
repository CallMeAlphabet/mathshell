export const help = "history [n]\n  Show command history.\n";
export default function history(args, { sh }) {
  const n = args[0] ? parseInt(args[0]) : sh.history.length;
  const slice = sh.history.slice(-n); const off = sh.history.length - slice.length;
  return { output: slice.map((h,i)=>`  ${String(off+i+1).padStart(4)}  ${h}`).join("\n")+"\n", exitCode: 0 };
}
