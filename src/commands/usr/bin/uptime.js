export const help = "uptime [-p] [-s]\n  Tell how long the system has been running.\n  -p  show uptime in pretty format\n  -s  show system up since time\n  Example:\n    uptime\n";
export default function uptime(args) {
  const pretty=args.includes("-p");
  const since=args.includes("-s");
  const now=new Date();
  const load="0.00, 0.00, 0.00";
  const mem="1 user";
  if (since) return { output: now.toISOString().replace("T"," ").split(".")[0]+"\n", exitCode: 0 };
  if (pretty) return { output: "up 0 minutes\n", exitCode: 0 };
  return { output: ` ${now.toTimeString().split(" ")[0]} up 0 min,  ${mem},  load average: ${load}\n`, exitCode: 0 };
}
