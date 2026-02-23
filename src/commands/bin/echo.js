// echo [-n] [-e] [-E] [text...]
export const help = `echo [-n] [-e] [-E] [text...]
  Print text to output.
  -n  do not append trailing newline
  -e  enable interpretation of backslash escapes (\\n \\t \\r \\\\ \\0)
  -E  disable escape interpretation (default)
  Examples:
    echo hello world
    echo -n 'no newline'
    echo -e 'line1\\nline2'
    echo -e '\\033[1mbold\\033[0m'
`;

export default function echo(args) {
  let nl = true, interp = false;
  const parts = [];
  for (const a of args) {
    if (a === "-n")      nl = false;
    else if (a === "-e") interp = true;
    else if (a === "-E") interp = false;
    else                 parts.push(a);
  }
  let s = parts.join(" ");
  if (interp) s = s
    .replace(/\\n/g,  "\n")
    .replace(/\\t/g,  "\t")
    .replace(/\\r/g,  "\r")
    .replace(/\\0/g,  "\0")
    .replace(/\\\\/g, "\\");
  return { output: s + (nl ? "\n" : ""), exitCode: 0 };
}
