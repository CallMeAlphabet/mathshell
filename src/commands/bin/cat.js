// cat [-n] [-b] [-A] [file...]
export const help = `cat [-n] [-b] [-A] [file...]
  Concatenate and print file contents.
  -n  number all output lines
  -b  number non-empty lines only
  -A  show non-printing chars; ends lines with $
  -s  squeeze multiple blank lines into one
  With no file or '-', reads from stdin.
  Examples:
    cat README.txt
    cat /etc/os-release
    echo 'hello' | cat
    cat file1 file2
    cat -n /etc/passwd
`;

export default function cat(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let lineNums = false, nonBlank = false, showAll = false, squeeze = false;
  const files = [];
  for (const a of args) {
    if (/^-[nbasAeET]+$/.test(a)) {
      if (a.includes("n")) lineNums = true;
      if (a.includes("b")) nonBlank = true;
      if (a.includes("A") || a.includes("e") || a.includes("E")) showAll = true;
      if (a.includes("s")) squeeze = true;
    } else if (a !== "-") {
      files.push(a);
    }
  }

  const process = text => {
    if (!lineNums && !nonBlank && !showAll && !squeeze) return text;
    let lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    if (squeeze) {
      const sq = []; let prevBlank = false;
      for (const l of lines) { const blank = l === ""; if (blank && prevBlank) continue; sq.push(l); prevBlank = blank; }
      lines = sq;
    }
    if (showAll) lines = lines.map(l => l.replace(/\t/g, "^I") + "$");
    let lineNo = 0;
    lines = lines.map(l => {
      if (nonBlank && l === "") return "";
      lineNo++;
      return (lineNums || nonBlank ? `${String(lineNo).padStart(6)}\t` : "") + l;
    });
    return lines.join("\n") + "\n";
  };

  if (!args.length || (args.length === 1 && args[0] === "-")) {
    return { output: process(stdin ?? ""), exitCode: 0 };
  }

  let out = "", ec = 0;
  for (const a of args) {
    if (a === "-") { out += process(stdin ?? ""); continue; }
    if (a.startsWith("-")) continue; // already parsed
    const p = norm(a);
    if (!vfs.exists(p))    { out += `cat: ${a}: No such file or directory\n`; ec = 1; }
    else if (vfs.isDir(p)) { out += `cat: ${a}: Is a directory\n`; ec = 1; }
    else out += process(vfs.read(p) ?? "");
  }
  return { output: out, exitCode: ec };
}
