export const help = "ps [-a] [-u] [-x] [-e] [-f]\n  List running processes.\n  In mash, returns simulated process list.\n  Examples:\n    ps\n    ps aux\n";
export default function ps(args) {
  const full = args.some(a=>a.includes("f"));
  if (args.some(a=>a.includes("a")||a.includes("x")||a.includes("e"))) {
    return { output: "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nuser         1  0.0  0.0  12345  1024 pts/0    Ss   00:00   0:00 mash\nuser         2  0.0  0.0   8765   512 pts/0    R+   00:00   0:00 ps\n", exitCode: 0 };
  }
  return { output: "  PID TTY          TIME CMD\n    1 pts/0    00:00:00 mash\n    2 pts/0    00:00:00 ps\n", exitCode: 0 };
}
