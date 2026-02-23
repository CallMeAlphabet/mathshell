export const help = "hostname\n  Print the system hostname.\n  Example:\n    hostname\n";
export default function hostname(args, { vfs }) {
  return { output: (vfs.read("/etc/hostname") || "mash\n").trim()+"\n", exitCode: 0 };
}
