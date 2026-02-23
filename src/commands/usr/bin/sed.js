export const help = `sed [-n] [-e expr] [-i] EXPR [file...]
  Stream editor for transforming text.
  -n  suppress automatic printing
  -e EXPR  add an expression (can repeat)
  Expressions:
    s/pat/rep/[gi]  substitute
    /pat/d          delete matching lines
    /pat/p          print matching lines
    /pat/!d         delete non-matching lines
    /pat/q          quit after first match
    Nd              delete line N
    N,Mp            print lines N through M
    =               print line number
    a\\TEXT         append text after each line
    i\\TEXT         insert text before each line
    y/from/to/      transliterate chars
  Examples:
    echo 'hello world' | sed 's/world/mash/'
    sed 's/foo/bar/g' file.txt
    cat file.txt | sed '/^#/d'
    sed -n '/error/p' log.txt
    sed '2,4d' file.txt
`;

export default function sed(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  const exprs = []; const files = []; let suppress = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "-e") && args[i+1]) exprs.push(args[++i]);
    else if (args[i] === "-n") suppress = true;
    else if (args[i] === "-i") {} // ignored (no in-place in VFS context)
    else if (!exprs.length && !args[i].startsWith("-")) exprs.push(args[i]);
    else if (exprs.length && !args[i].startsWith("-")) files.push(args[i]);
    else files.push(args[i]);
  }

  let text = stdin ?? "";
  if (files.length) { const p = norm(files[0]); if (vfs.isFile(p)) text = vfs.read(p) ?? ""; }

  for (const expr of exprs) {
    const res = applyExpr(expr, text, suppress);
    if (res.error) return { output: res.error + "\n", exitCode: 1 };
    text = res.text;
    suppress = res.suppress ?? suppress;
  }

  return { output: text.endsWith("\n") ? text : text + "\n", exitCode: 0 };
}

function applyExpr(expr, text, suppress) {
  // s/pat/rep/flags
  const sM = expr.match(/^s(.)(.+?)\1(.*?)\1([gi]*)$/s);
  if (sM) {
    const [,,pat,rep,flags] = sM;
    let rflags = ""; if (flags.includes("g")) rflags += "g"; if (flags.includes("i")) rflags += "i";
    let re;
    try { re = new RegExp(pat, rflags); } catch { return { error: "sed: invalid regex" }; }
    const result = text.split("\n").map(l => l.replace(re, rep.replace(/\\n/g,"\n").replace(/\\t/g,"\t"))).join("\n");
    return { text: result };
  }

  // y/from/to/
  const yM = expr.match(/^y(.)(.+?)\1(.+?)\1$/);
  if (yM) {
    const from = yM[2], to = yM[3];
    let result = text;
    for (let i = 0; i < Math.min(from.length, to.length); i++) {
      result = result.split(from[i]).join(to[i]);
    }
    return { text: result };
  }

  // N,Md or N,Mp
  const rangeM = expr.match(/^(\d+),(\d+)([dp])$/);
  if (rangeM) {
    const [,n1s,n2s,cmd] = rangeM;
    const n1 = parseInt(n1s) - 1, n2 = parseInt(n2s) - 1;
    const ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
    if (cmd === "d") { return { text: ls.filter((_,i) => i < n1 || i > n2).join("\n") }; }
    if (cmd === "p") { return { text: ls.slice(n1, n2+1).join("\n") }; }
  }

  // /pat/!d  (negate delete)
  const negDM = expr.match(/^\/(.+)\/!d$/);
  if (negDM) {
    let re; try { re = new RegExp(negDM[1]); } catch { return { error: "sed: invalid regex" }; }
    return { text: text.split("\n").filter(l => re.test(l)).join("\n") };
  }

  // /pat/d
  const dM = expr.match(/^\/(.+)\/d$/);
  if (dM) {
    let re; try { re = new RegExp(dM[1]); } catch { return { error: "sed: invalid regex" }; }
    return { text: text.split("\n").filter(l => !re.test(l)).join("\n") };
  }

  // /pat/p (with -n support: only print matches)
  const pM = expr.match(/^\/(.+)\/p$/);
  if (pM) {
    let re; try { re = new RegExp(pM[1]); } catch { return { error: "sed: invalid regex" }; }
    if (suppress) return { text: text.split("\n").filter(l => re.test(l)).join("\n") };
    // without -n: print matching lines twice
    return { text: text.split("\n").map(l => re.test(l) ? l + "\n" + l : l).join("\n") };
  }

  // /pat/q
  const qM = expr.match(/^\/(.+)\/q$/);
  if (qM) {
    let re; try { re = new RegExp(qM[1]); } catch { return { error: "sed: invalid regex" }; }
    const ls = text.split("\n");
    const idx = ls.findIndex(l => re.test(l));
    return { text: idx >= 0 ? ls.slice(0, idx+1).join("\n") : text };
  }

  // Nd (delete line N)
  const nM = expr.match(/^(\d+)d$/);
  if (nM) {
    const ls = text.split("\n"); ls.splice(parseInt(nM[1]) - 1, 1);
    return { text: ls.join("\n") };
  }

  // = (print line numbers — append to each line)
  if (expr === "=") {
    const ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
    return { text: ls.map((l,i) => `${i+1}\n${l}`).join("\n") };
  }

  // a\TEXT or a TEXT
  const aM = expr.match(/^a[\\]?(.*)$/);
  if (aM) {
    const addText = aM[1]; const ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
    return { text: ls.map(l => l + "\n" + addText).join("\n") };
  }

  // i\TEXT
  const iM = expr.match(/^i[\\]?(.*)$/);
  if (iM) {
    const addText = iM[1]; const ls = text.split("\n"); if (ls[ls.length-1]==="") ls.pop();
    return { text: ls.map(l => addText + "\n" + l).join("\n") };
  }

  return { error: `sed: expression error near: ${expr}` };
}
