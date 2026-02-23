export const help = "nproc [--all]\n  Print the number of processing units.\n  Example:\n    nproc\n";
export default function nproc() {
  return { output: (navigator.hardwareConcurrency||4)+"\n", exitCode: 0 };
}
