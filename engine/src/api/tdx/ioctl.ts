/**
 * Thin ioctl wrapper.
 *
 * In production on a real TDX machine, this should use a native Node.js addon
 * (e.g. node-ioctl or a custom .node binding) to issue the ioctl syscall.
 *
 * For now this module throws a clear error if called without the native addon,
 * which only happens in TEE_MODE=tdx — dev mode never reaches this code.
 */

export function ioctl(fd: number, request: number, buffer: Buffer): void {
  try {
    // Try to load a native ioctl addon if available
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require("node-ioctl");
    native.ioctl(fd, request, buffer);
  } catch {
    throw new Error(
      "node-ioctl native addon not found. " +
      "On a real TDX machine, install it with: npm install node-ioctl. " +
      "For dev/testnet use TEE_MODE=dev instead.",
    );
  }
}
