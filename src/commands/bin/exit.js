export const help = "exit [CODE]\n  Exit the shell.\n";
export default function exit(args) {
  const code = parseInt(args[0] ?? "0");
  return { output: `__EXIT__${isNaN(code)?0:code}`, exitCode: isNaN(code)?0:code };
}
