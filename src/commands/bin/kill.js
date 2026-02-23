export const help = "kill [-SIGNAL] PID\n  Send signal to process (no-op in MASH).\n";
export default function kill() { return { output: "", exitCode: 0 }; }
