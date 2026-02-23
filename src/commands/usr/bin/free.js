export const help = "free [-h] [-m] [-g] [-k]\n  Display amount of free and used memory.\n  -h  human-readable\n  -m  show in MiB\n  -g  show in GiB\n  -k  show in KiB (default)\n  Example:\n    free -h\n";
export default function free(args) {
  const human=args.includes("-h"), mib=args.includes("-m"), gib=args.includes("-g");
  if (human) return { output: "               total        used        free      shared  buff/cache   available\nMem:           1.0Gi        64Mi       900Mi       0.0Ki        50Mi       950Mi\nSwap:            0.0Ki       0.0Ki       0.0Ki\n", exitCode: 0 };
  const factor=gib?1024*1024:mib?1024:1;
  const total=1048576/factor, used=65536/factor, free2=(1048576-65536)/factor;
  return { output: `               total        used        free      shared  buff/cache   available\nMem:        ${String(Math.round(total)).padStart(12)} ${String(Math.round(used)).padStart(12)} ${String(Math.round(free2)).padStart(12)}            0            0 ${String(Math.round(free2)).padStart(12)}\nSwap:                  0            0            0\n`, exitCode: 0 };
}
