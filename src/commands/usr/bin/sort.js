export const help = `sort [-rnufhbizRM] [-k KEY] [-t SEP] [file...]
  Sort lines of text.
  -r  reverse order
  -n  numeric sort
  -u  unique lines only (deduplicate)
  -f  fold case (case-insensitive)
  -h  human-numeric sort (2K < 1M)
  -b  ignore leading blanks
  -i  ignore non-printable chars
  -z  null-delimited input
  -R  random shuffle
  -M  month name sort (Jan < Feb ...)
  -k POS[,ENDPOS]  sort by field key (1-based)
  -t SEP  field separator (default: whitespace)
  Examples:
    sort names.txt
    sort -rn numbers.txt
    sort -k2 -t: /etc/passwd
    sort -u file.txt
    sort -h sizes.txt
`;

const MONTH_ORDER = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export default function sort(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let rev = false, num = false, uniq = false, fold = false, human = false;
  let random = false, month = false, ignoreBlank = false;
  let keySpec = null, fieldSep = null;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-k" || a === "--key") { keySpec = args[++i]; }
    else if (a === "-t" || a === "--field-separator") { fieldSep = args[++i]; }
    else if (/^-[rnufhbizRM]+$/.test(a)) {
      if (a.includes("r")) rev = true;
      if (a.includes("n")) num = true;
      if (a.includes("u")) uniq = true;
      if (a.includes("f")) fold = true;
      if (a.includes("h")) human = true;
      if (a.includes("R")) random = true;
      if (a.includes("M")) month = true;
      if (a.includes("b")) ignoreBlank = true;
    } else if (!a.startsWith("-")) files.push(a);
  }

  let text = stdin ?? "";
  if (files.length) {
    const parts = [];
    for (const f of files) {
      const p = norm(f);
      if (!vfs.isFile(p)) return { output: `sort: ${f}: No such file or directory\n`, exitCode: 1 };
      parts.push(vfs.read(p) ?? "");
    }
    text = parts.join("");
  }

  let ls = text.split("\n"); if (ls[ls.length-1] === "") ls.pop();

  const getKey = (line) => {
    if (!keySpec) return line;
    const sep = fieldSep ?? /\s+/;
    const fields = typeof sep === "string" ? line.split(sep) : line.trim().split(sep);
    const [k1s, k2s] = keySpec.split(",");
    const k1 = Math.max(1, parseInt(k1s)) - 1;
    const k2 = k2s ? Math.max(1, parseInt(k2s)) - 1 : fields.length - 1;
    return fields.slice(k1, k2+1).join(fieldSep ?? " ");
  };

  const parseHuman = s => {
    const m = s.trim().match(/^([\d.]+)([KMGTPE]?)$/i);
    if (!m) return parseFloat(s) || 0;
    const units = { "": 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776, P: 1125899906842624 };
    return parseFloat(m[1]) * (units[m[2].toUpperCase()] ?? 1);
  };

  if (random) {
    ls.sort(() => Math.random() - 0.5);
  } else if (month) {
    ls.sort((a, b) => {
      const ai = MONTH_ORDER.indexOf(getKey(a).trim().slice(0,3).toLowerCase());
      const bi = MONTH_ORDER.indexOf(getKey(b).trim().slice(0,3).toLowerCase());
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  } else if (human) {
    ls.sort((a, b) => parseHuman(getKey(a)) - parseHuman(getKey(b)));
  } else if (num) {
    ls.sort((a, b) => parseFloat(getKey(a)) - parseFloat(getKey(b)));
  } else {
    ls.sort((a, b) => {
      let ka = getKey(a), kb = getKey(b);
      if (ignoreBlank) { ka = ka.trimStart(); kb = kb.trimStart(); }
      if (fold) { ka = ka.toLowerCase(); kb = kb.toLowerCase(); }
      return ka.localeCompare(kb);
    });
  }

  if (rev) ls.reverse();
  if (uniq) ls = [...new Set(ls)];
  return { output: ls.join("\n") + "\n", exitCode: 0 };
}
