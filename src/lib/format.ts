const BYTES_PER_KB = 1024

//file sizes for the admin screens
export function formatBytes(n: number): string {
  if (n < BYTES_PER_KB) return `${n} B`
  if (n < BYTES_PER_KB ** 2) return `${(n / BYTES_PER_KB).toFixed(1)} KB`
  return `${(n / BYTES_PER_KB ** 2).toFixed(1)} MB`
}
