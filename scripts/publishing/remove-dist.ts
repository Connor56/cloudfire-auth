/**
 * Used to remove the stale dist directory. This is used to ensure the build is
 * clean and ready for publishing.
 */

import { rmSync } from "fs";
import { join } from "path";

// Expects the script to be run from the root of the project
const distPath = join(process.cwd(), "dist");

console.log("Removing dist directory:", distPath);

try {
  rmSync(distPath, { recursive: true, force: true });
  console.log("✓ Removed dist directory");
} catch (error) {
  // Ignore error if directory doesn't exist
  if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
    console.error("Failed to remove dist directory:", error);
    process.exit(1);
  }
}
