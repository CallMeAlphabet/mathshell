export const help = "whoami\n  Print current user name.\n";
export default function whoami(args, { sh }) {
  return { output: (sh.env.USER || "user").trim() + "\n", exitCode: 0 };
}
