import { fmtSize } from "../_utils/format.js";
export const help = "df [-h] [filesystem]\n  Show available disk space.\n  -h  human-readable sizes\n  Examples:\n    df\n    df -h\n";
export default function df(args) {
  const human=args.includes("-h");
  if (human) return { output: "Filesystem      Size  Used Avail Use% Mounted on\nmashfs          1.0G  256K  1.0G   1% /\n", exitCode: 0 };
  return { output: "Filesystem     1K-blocks  Used Available Use% Mounted on\nmashfs           1048576   256   1048320   1% /\n", exitCode: 0 };
}
