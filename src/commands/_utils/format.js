// ── Formatting helpers ────────────────────────────────────────────────────────

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const fmtDate = ts => {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

export function fmtSize(bytes, human = false) {
  if (!human) return String(bytes ?? 0);
  const b = bytes ?? 0;
  if (b < 1024)                return b + "B";
  if (b < 1024 * 1024)         return (b / 1024).toFixed(1) + "K";
  if (b < 1024 * 1024 * 1024)  return (b / 1024 / 1024).toFixed(1) + "M";
  return (b / 1024 / 1024 / 1024).toFixed(1) + "G";
}

export const fmtLong = (fp, vfs, human = false) => {
  const name = fp.split("/").pop() || fp;
  const n    = vfs.stat(fp);
  if (!n) return `?         ${name}`;
  const perm = n.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--";
  const sz   = fmtSize(n.size ?? 0, human);
  return `${perm}  1 user user ${sz.padStart(human ? 4 : 6)} ${fmtDate(n.mtime ?? Date.now())} ${name}`;
};
