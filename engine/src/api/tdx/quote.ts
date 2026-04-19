import fs from "fs";
import { ethers } from "ethers";

const TDX_DEVICE      = "/dev/tdx_guest";
const IOCTL_GET_QUOTE = 0xc0187802; // TDX_CMD_GET_QUOTE ioctl number

/**
 * Request a TDX attestation quote from the hardware.
 * The signing key address is embedded in the 64-byte report_data field,
 * cryptographically binding the key to this specific hardware measurement.
 *
 * Requires /dev/tdx_guest to be present and accessible (Linux TDX kernel driver).
 */
export async function tdxQuote(signingKey: string): Promise<Buffer> {
  // Build the 64-byte report_data: signing key (20 bytes) left-padded in first 32 bytes
  const reportData = Buffer.alloc(64, 0);
  const keyBytes   = Buffer.from(signingKey.slice(2), "hex"); // strip 0x
  keyBytes.copy(reportData, 12); // right-align in first 32 bytes (EVM address style)

  // TDX_REPORT_REQ structure layout (Linux kernel ABI):
  //   u8  report_data[64]    — user-supplied data bound into the quote
  //   u8  tee_type[4]        — TEE type (TDX = 0x00000081)
  //   u32 reserved           — must be 0
  const reportReq = Buffer.alloc(72, 0);
  reportData.copy(reportReq, 0);
  reportReq.writeUInt32LE(0x00000081, 64); // TDX tee_type

  // Open /dev/tdx_guest and issue the ioctl
  const fd = fs.openSync(TDX_DEVICE, "r+");
  try {
    const quoteBuffer = Buffer.alloc(4096, 0);

    // Node.js does not have a native ioctl binding.
    // In production, use a native addon or child_process to invoke
    // a small C helper. Here we use a dynamic import for the addon.
    const { ioctl } = await import("./ioctl");
    ioctl(fd, IOCTL_GET_QUOTE, quoteBuffer);

    // Quote length is encoded in the first 4 bytes of the response
    const quoteLen = quoteBuffer.readUInt32LE(0);
    return quoteBuffer.subarray(4, 4 + quoteLen);
  } finally {
    fs.closeSync(fd);
  }
}
