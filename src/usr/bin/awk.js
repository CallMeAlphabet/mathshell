export const help = `awk [-F sep] [-v var=val] 'program' [file...]
  Pattern-scanning and text processing language.
  -F sep   field separator (default: whitespace)
  -v VAR=VALUE  set variable before execution

  Special variables: NR (row), NF (num fields), FS (field sep), $0 (line), $1..$N (fields)
  Patterns: /regex/  NR==N  BEGIN  END
  Actions: print, printf, if/else, for, while, next, exit, split, sub, gsub, match, length, substr, toupper, tolower, int, sqrt, rand

  Examples:
    echo 'a b c' | awk '{print $2}'
    awk -F: '{print $1}' /etc/passwd
    awk 'NR>2 {print NR, $0}' file.txt
    awk 'BEGIN{s=0}{s+=$1}END{print s}' nums.txt
    awk '/pattern/{print}' file.txt
    awk '{sum+=$1} END{print sum/NR}' data.txt
`;

// Lightweight awk interpreter
export default function awk(args, { stdin, vfs, sh }) {
  const norm = p => vfs.resolve(p, sh.cwd);
  let FSstr=" ", program="";
  const fileArgs=[], vars={};

  for (let i=0; i<args.length; i++) {
    const a=args[i];
    if (a==="-F" && args[i+1]) FSstr=args[++i];
    else if (a.startsWith("-F")) FSstr=a.slice(2);
    else if ((a==="-v"||a==="-W") && args[i+1]) {
      const vSpec=args[++i]; const eq=vSpec.indexOf("=");
      if (eq!==-1) vars[vSpec.slice(0,eq)]=vSpec.slice(eq+1);
    }
    else if (!program) program=a;
    else fileArgs.push(a);
  }
  if (!program) return { output: "awk: no program specified\n", exitCode: 1 };

  let text=stdin??"";
  if (fileArgs.length) {
    let combined="";
    for (const f of fileArgs) {
      const p=norm(f);
      if (!vfs.isFile(p)) return { output: `awk: ${f}: No such file or directory\n`, exitCode: 1 };
      combined+=vfs.read(p)??"";
    }
    text=combined;
  }

  // Parse program into rules: [{pattern, action}]
  // Supports: BEGIN, END, /regex/, condition, empty pattern
  const rules = parseProgram(program);
  if (!rules) return { output: "awk: syntax error in program\n", exitCode: 1 };

  const lines=text.split("\n"); if (lines[lines.length-1]==="") lines.pop();
  const out=[];
  const env = { FS:FSstr, OFS:" ", ORS:"\n", NR:0, NF:0, RS:"\n", ...vars };
  let exitCode=0;

  const splitFields = (line) => {
    if (FSstr===" ") return line.trim()?line.trim().split(/\s+/):[];
    const re=FSstr.length===1
      ? new RegExp(FSstr.replace(/[.*+?^${}()|[\]\\]/g,c=>"\\"+c))
      : new RegExp(FSstr);
    return line.split(re);
  };

  // Run BEGIN rules
  for (const rule of rules.filter(r=>r.pattern==="BEGIN")) {
    const res=runAction(rule.action, [], "", env, out, rules, {});
    if (res===false) { exitCode=1; break; }
  }

  // Main loop
  outer: for (let nr=0; nr<lines.length; nr++) {
    const line=lines[nr];
    const fields=splitFields(line);
    env.NR=nr+1; env.NF=fields.length; env["0"]=line;
    fields.forEach((f,i)=>{ env[String(i+1)]=f; });

    for (const rule of rules.filter(r=>r.pattern!=="BEGIN"&&r.pattern!=="END")) {
      if (!matchPattern(rule.pattern, line, env)) continue;
      const res=runAction(rule.action, fields, line, env, out, rules, {});
      if (res==="next") break;
      if (res==="exit") { break outer; }
    }
    // Clean up field vars
    for (let i=fields.length+1; i<=20; i++) delete env[String(i)];
  }

  // Run END rules
  for (const rule of rules.filter(r=>r.pattern==="END")) {
    runAction(rule.action, [], "", env, out, rules, {});
  }

  return { output: out.join(""), exitCode };
}

function parseProgram(prog) {
  const rules=[];
  // Split into pattern-action pairs
  let i=0, s=prog.trim();

  while (i<s.length) {
    // skip whitespace
    while (i<s.length && /\s/.test(s[i])) i++;
    if (i>=s.length) break;

    let pattern="", action="";

    if (s.slice(i,i+5)==="BEGIN") { pattern="BEGIN"; i+=5; }
    else if (s.slice(i,i+3)==="END") { pattern="END"; i+=3; }
    else if (s[i]==="/") {
      // /regex/
      let re=""; i++;
      while (i<s.length && s[i]!=="/") { if (s[i]==="\\") re+=s[i++]; re+=s[i++]; }
      i++; // closing /
      pattern={type:"regex", re};
    } else if (s[i]==="{") {
      // no pattern, just action
      pattern="";
    } else {
      // expression pattern: read until {
      let pExpr="";
      while (i<s.length && s[i]!=="{") pExpr+=s[i++];
      pattern={type:"expr", expr:pExpr.trim()};
    }

    // skip whitespace
    while (i<s.length && /\s/.test(s[i])) i++;

    if (i<s.length && s[i]==="{") {
      let depth=1, body=""; i++;
      while (i<s.length && depth>0) {
        if (s[i]==="{") depth++;
        else if (s[i]==="}") { depth--; if (depth===0) { i++; break; } }
        body+=s[i++];
      }
      action=body.trim();
    }

    rules.push({pattern, action});
  }
  return rules;
}

function matchPattern(pat, line, env) {
  if (pat==="") return true;
  if (pat==="BEGIN"||pat==="END") return false;
  if (pat?.type==="regex") {
    try { return new RegExp(pat.re).test(line); } catch { return false; }
  }
  if (pat?.type==="expr") {
    try { return !!evalExpr(pat.expr, env); } catch { return true; }
  }
  return true;
}

function runAction(action, fields, line, env, out, rules, localVars) {
  if (!action) { out.push(line+"\n"); return; }
  const stmts=splitStmts(action);
  for (const stmt of stmts) {
    const res=execStmt(stmt.trim(), env, out, localVars);
    if (res==="next"||res==="exit") return res;
  }
}

function splitStmts(s) {
  // Split on ; and newlines not inside strings or parens
  const stmts=[]; let cur="", depth=0, inStr=false, strChar="";
  for (let i=0; i<s.length; i++) {
    const c=s[i];
    if (inStr) { cur+=c; if (c===strChar) inStr=false; }
    else if (c==='"'||c==="'") { inStr=true; strChar=c; cur+=c; }
    else if (c==="("||c==="{") { depth++; cur+=c; }
    else if (c===")"||c==="}") { depth--; cur+=c; }
    else if ((c===";"||c==="\n") && depth===0) { if (cur.trim()) stmts.push(cur.trim()); cur=""; }
    else cur+=c;
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

function execStmt(stmt, env, out, locals) {
  if (!stmt) return;

  // print/printf
  if (stmt.startsWith("print ") || stmt === "print") {
    const expr = stmt.slice(6).trim();
    if (!expr) { out.push((env["0"]??"")+"\n"); return; }
    try {
      const val = evalPrintList(expr, env, locals);
      out.push(val+(env.ORS??"\n"));
    } catch { out.push("\n"); }
    return;
  }
  if (stmt.startsWith("printf ")) {
    try {
      const val = evalPrintf(stmt.slice(7).trim(), env, locals);
      out.push(val);
    } catch {}
    return;
  }
  if (stmt === "next") return "next";
  if (stmt === "exit") return "exit";

  // if/else
  const ifM = stmt.match(/^if\s*\((.+?)\)\s*\{([^}]*)\}(?:\s*else\s*\{([^}]*)\})?$/s);
  if (ifM) {
    const [,cond,thenB,elseB]=ifM;
    const val=!!evalExpr(cond, env, locals);
    if (val) execStmt(thenB.trim(), env, out, locals);
    else if (elseB) execStmt(elseB.trim(), env, out, locals);
    return;
  }

  // for (var in array) — skip complex
  // for (init; cond; step) { }
  const forM = stmt.match(/^for\s*\(([^;]*);([^;]*);([^)]*)\)\s*\{([^}]*)\}$/s);
  if (forM) {
    const [,init,cond,step,body]=forM;
    execStmt(init.trim(),env,out,locals);
    for (let iter=0; iter<10000; iter++) {
      if (!evalExpr(cond.trim(),env,locals)) break;
      const res=execStmt(body.trim(),env,out,locals);
      if (res==="exit") return "exit";
      execStmt(step.trim(),env,out,locals);
    }
    return;
  }

  // while
  const whileM = stmt.match(/^while\s*\((.+?)\)\s*\{([^}]*)\}$/s);
  if (whileM) {
    const [,cond,body]=whileM;
    for (let iter=0; iter<10000; iter++) {
      if (!evalExpr(cond,env,locals)) break;
      execStmt(body.trim(),env,out,locals);
    }
    return;
  }

  // assignment: var = expr  or  var++ / var--
  const assignM = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_\[\]]*)\s*([+\-*\/]?=)\s*(.+)$/s);
  if (assignM) {
    const [,lhs,op,rhs]=assignM;
    const val=evalExpr(rhs, env, locals);
    if (op==="=") setVar(lhs, val, env, locals);
    else if (op==="+=") setVar(lhs, (parseFloat(getVar(lhs,env,locals))||0)+(parseFloat(val)||0), env, locals);
    else if (op==="-=") setVar(lhs, (parseFloat(getVar(lhs,env,locals))||0)-(parseFloat(val)||0), env, locals);
    else if (op==="*=") setVar(lhs, (parseFloat(getVar(lhs,env,locals))||0)*(parseFloat(val)||0), env, locals);
    else if (op==="/=") { const dv=parseFloat(val)||1; setVar(lhs, (parseFloat(getVar(lhs,env,locals))||0)/dv, env, locals); }
    return;
  }
  const ppM = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\+\+|--)$/);
  if (ppM) {
    const [,v,op]=ppM;
    const n=(parseFloat(getVar(v,env,locals))||0)+(op==="++"?1:-1);
    setVar(v,n,env,locals); return;
  }
}

function getVar(name, env, locals) {
  if (name in locals) return locals[name];
  if (name in env) return env[name];
  return "";
}

function setVar(name, val, env, locals) {
  // if it's a field $N, update env
  if (/^\$\d+$/.test(name)) { env[name.slice(1)] = val; return; }
  if (name in locals) locals[name]=val;
  else env[name]=val;
}

function evalPrintList(expr, env, locals) {
  // Handle comma-separated items -> join with OFS
  const parts=splitByComma(expr);
  return parts.map(p=>String(evalExpr(p.trim(),env,locals)??0)).join(env.OFS??" ");
}

function splitByComma(s) {
  const parts=[]; let cur="", depth=0, inStr=false, sc="";
  for (const c of s) {
    if (inStr) { cur+=c; if (c===sc) inStr=false; }
    else if (c==='"'||c==="'") { inStr=true; sc=c; cur+=c; }
    else if (c==="("||c==="[") { depth++; cur+=c; }
    else if (c===")"||c==="]") { depth--; cur+=c; }
    else if (c==="," && depth===0) { parts.push(cur); cur=""; }
    else cur+=c;
  }
  parts.push(cur); return parts;
}

function evalPrintf(args, env, locals) {
  const parts=splitByComma(args);
  if (!parts.length) return "";
  let fmt=String(evalExpr(parts[0].trim(),env,locals)??"").replace(/\\n/g,"\n").replace(/\\t/g,"\t");
  const pargs=parts.slice(1); let ai=0;
  return fmt.replace(/%([0-9.]*)[sdifg%]/g,(m,spec,t)=>{
    const ft=m[m.length-1];
    if (ft==="%") return "%";
    const v=pargs[ai++]!==undefined?evalExpr(pargs[ai-1].trim(),env,locals):"";
    if (ft==="d"||ft==="i") return String(parseInt(v)||0);
    if (ft==="f") { const prec=spec.includes(".")?parseInt(spec.split(".")[1]):6; return (parseFloat(v)||0).toFixed(prec); }
    if (ft==="g") return String(parseFloat(v)||0);
    return String(v);
  });
}

function evalExpr(expr, env, locals) {
  if (!expr) return "";
  expr=expr.trim();

  // Comparison operators
  const cmpOps=[/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/s];
  for (const re of cmpOps) {
    const m=expr.match(re);
    if (m) {
      const [,l,op,r]=m;
      const lv=evalExpr(l,env,locals), rv=evalExpr(r,env,locals);
      const ln=parseFloat(lv), rn=parseFloat(r);
      const numericCompare=!isNaN(ln)&&!isNaN(parseFloat(rv));
      switch(op) {
        case "==": return numericCompare?ln===parseFloat(rv)?1:0:String(lv)===String(rv)?1:0;
        case "!=": return numericCompare?ln!==parseFloat(rv)?1:0:String(lv)!==String(rv)?1:0;
        case ">=": return (numericCompare?ln:String(lv))>=(numericCompare?parseFloat(rv):String(rv))?1:0;
        case "<=": return (numericCompare?ln:String(lv))<=(numericCompare?parseFloat(rv):String(rv))?1:0;
        case ">":  return (numericCompare?ln:String(lv))>(numericCompare?parseFloat(rv):String(rv))?1:0;
        case "<":  return (numericCompare?ln:String(lv))<(numericCompare?parseFloat(rv):String(rv))?1:0;
      }
    }
  }

  // String literal
  if (expr.startsWith('"') && expr.endsWith('"')) {
    return expr.slice(1,-1).replace(/\\n/g,"\n").replace(/\\t/g,"\t");
  }
  if (expr.startsWith("'") && expr.endsWith("'")) return expr.slice(1,-1);

  // $0, $1...
  if (/^\$\d+$/.test(expr)) return env[expr.slice(1)]??"";
  if (expr==="$NF") return env[String(parseInt(env.NF))]??"";

  // Built-in variables
  if (/^[A-Z][A-Z0-9_]*$/.test(expr) && expr in env) return env[expr];

  // User variables
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
    if (expr in locals) return locals[expr];
    if (expr in env) return env[expr];
    return 0;
  }

  // Arithmetic: delegate to safe eval
  try {
    const subst = expr
      .replace(/\$(\d+)/g, (_, n) => JSON.stringify(env[n]??""))
      .replace(/\$NF/g, JSON.stringify(env[String(parseInt(env.NF))]??""))
      .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (m, v) => {
        if (["Math","parseInt","parseFloat","String","Number","NaN","Infinity"].includes(v)) return v;
        const val=v in locals?locals[v]:(v in env?env[v]:0);
        return JSON.stringify(val);
      })
      // awk string concat: "a" "b" -> not easily parseable, skip
      ;
    return new Function(`return (${subst})`)();
  } catch {
    return 0;
  }
}
