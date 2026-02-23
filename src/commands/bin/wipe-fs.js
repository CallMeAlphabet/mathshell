export const help = "wipe-fs\n  Wipe all persisted filesystem data and reset to defaults.\n  WARNING: permanently deletes all files.\n";
export default function wipeFs(args, { vfs }) {
  if (!vfs._db) return { output: "wipe-fs: IndexedDB not available\n", exitCode: 1 };
  return { output: "__WIPEFS__", exitCode: 0 };
}
