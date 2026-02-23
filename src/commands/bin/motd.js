export const help = "motd\n  Display the message of the day.\n";
export default function motd(args, { vfs }) { return { output: vfs.read("/etc/motd") || "", exitCode: 0 }; }
