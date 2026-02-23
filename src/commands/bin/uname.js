export const help = "uname [-a] [-s] [-n] [-r] [-v] [-m] [-p] [-o]\n  Print system information.\n  -a  all information\n  -s  kernel name\n  -n  node/hostname\n  -r  kernel release\n  -v  kernel version\n  -m  machine hardware\n  -p  processor type\n  -o  operating system\n  Example:\n    uname -a\n";
export default function uname(args, { vfs }) {
  const hostname = (vfs.read("/etc/hostname") || "mash").trim();
  const info = { s:"MASH", n:hostname, r:"1.0.0", v:"#1 MASH", m:"wasm32", p:"wasm32", o:"Mash/1.0" };
  if (!args.length || args[0]==="-s") return { output: "MASH\n", exitCode: 0 };
  if (args.includes("-a")) return { output: `${info.s} ${info.n} ${info.r} ${info.v} ${info.m} ${info.p} ${info.o}\n`, exitCode: 0 };
  const parts = [];
  for (const a of args) {
    if (a==="-s") parts.push(info.s);
    else if (a==="-n") parts.push(info.n);
    else if (a==="-r") parts.push(info.r);
    else if (a==="-v") parts.push(info.v);
    else if (a==="-m") parts.push(info.m);
    else if (a==="-p") parts.push(info.p);
    else if (a==="-o") parts.push(info.o);
  }
  return { output: parts.join(" ")+"\n", exitCode: 0 };
}
