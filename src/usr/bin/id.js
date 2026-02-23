export const help = "id\n  Print user identity.\n";
export default function id(args, { sh }) {
  const u = (sh.env.USER || "user").trim();
  return { output: `uid=1000(${u}) gid=1000(${u}) groups=1000(${u})\n`, exitCode: 0 };
}
