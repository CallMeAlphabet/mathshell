import { mathEval, fmtNum } from "../../_utils/math.js";
export const help = "expr EXPR\n  Evaluate expressions (arithmetic, string, comparison).\n  Supports: + - * / % arithmetic\n            = != < > <= >= comparison\n            length STR, substr STR POS LEN, index STR CHARS, match STR REGEX\n            : regex match\n  Examples:\n    expr 2 + 2\n    expr 10 '*' 5\n    expr length 'hello'\n    expr 5 '>' 3\n    expr 'hello' : 'h.*'\n";
export default function expr(args) {
  if (!args.length) return { output: "expr: missing operand\n", exitCode: 2 };
  
  // String operations
  if (args[0]==="length") return { output: String((args[1]??"").length)+"\n", exitCode: 0 };
  if (args[0]==="substr") {
    const s=args[1]??"", pos=parseInt(args[2]??1)-1, len=parseInt(args[3]??s.length);
    return { output: s.slice(pos,pos+len)+"\n", exitCode: 0 };
  }
  if (args[0]==="index") {
    const s=args[1]??"", chars=args[2]??"";
    for (let i=0; i<s.length; i++) { if (chars.includes(s[i])) return { output: (i+1)+"\n", exitCode: 0 }; }
    return { output: "0\n", exitCode: 0 };
  }
  if (args[0]==="match") {
    const s=args[1]??"", re=new RegExp(args[2]??"");
    const m=re.exec(s); if (!m) return { output: "0\n", exitCode: 1 };
    return { output: (m.index+1)+"\n", exitCode: 0 };
  }

  // a : regex
  if (args.length===3 && args[1]===":") {
    const s=args[0], re=new RegExp("^"+args[2]);
    const m=re.exec(s); if (!m) return { output: "0\n", exitCode: 1 };
    return { output: (m[1]??m[0].length)+"\n", exitCode: 0 };
  }

  // Comparison
  const cmp=["=","!=","<",">","<=",">="];
  if (args.length===3 && cmp.includes(args[1])) {
    const [l,op,r]=args;
    const ln=parseFloat(l), rn=parseFloat(r);
    const num=!isNaN(ln)&&!isNaN(rn);
    let result;
    switch(op) {
      case "=": case "==": result=num?ln===rn:l===r; break;
      case "!=":  result=num?ln!==rn:l!==r; break;
      case "<":   result=num?ln<rn:l<r; break;
      case ">":   result=num?ln>rn:l>r; break;
      case "<=":  result=num?ln<=rn:l<=r; break;
      case ">=":  result=num?ln>=rn:l>=r; break;
    }
    return { output: (result?1:0)+"\n", exitCode: result?0:1 };
  }

  // Arithmetic
  try {
    const r=mathEval(args.join(" "));
    return { output: fmtNum(r)+"\n", exitCode: r===0?1:0 };
  } catch {
    return { output: "expr: syntax error\n", exitCode: 2 };
  }
}
