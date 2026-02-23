export const help = "timeout DURATION COMMAND [ARGS]\n  Run COMMAND with a time limit.\n  In mash, runs immediately without enforcing the time limit.\n  Examples:\n    timeout 5 sleep 10\n    timeout 1s grep 'pattern' bigfile.txt\n";
export default function timeout(args, { vfs, sh }, execCmd) {
  if (args.length<2) return { output: "timeout: missing operand\n", exitCode: 1 };
  const [_duration, cmd2, ...rest]=args;
  return execCmd(cmd2, rest, null, vfs, sh);
}
