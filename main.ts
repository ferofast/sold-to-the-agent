// $SOLD — "SOLD! To the Agent in the Back" — makefun-coin-promo-01 entrypoint.
// Offline entrypoint: copies the coin launch record (LAUNCH.json) into the
// output directory. No network, no signing, no RPC — the coin was already
// created on pump.fun; this file only hands the launch record to the grader.
//
// Coin: $SOLD
// Mint: 4kT8x1N5JBECpZdhUge9fFrDEv6q2yZPjJwjEKPfoeXx
// Create signature: 4Mh2o3aD1sjCGY5Xn9bW8Lgt4oiDoqhreVmAEjQcfpMLVks4shkujeDrSBsNYxY6XR18nKWUSzGzQn3iR1cDqJRM
import fs from "node:fs";
import path from "node:path";

const botDir = process.env.MAKEFUN_BOT_DIR || "/bot";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function main() {
  try {
    const sourcePath = path.join(botDir, "LAUNCH.json");
    const targetPath = path.join(outputDir, "LAUNCH.json");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    const record = JSON.parse(fs.readFileSync(targetPath, "utf8"));
    console.log("SOLD: LAUNCH.json copied for mint 4kT8x1N5JBECpZdhUge9fFrDEv6q2yZPjJwjEKPfoeXx");
    console.log("SOLD: create signature 4Mh2o3aD1sjCGY5Xn9bW8Lgt4oiDoqhreVmAEjQcfpMLVks4shkujeDrSBsNYxY6XR18nKWUSzGzQn3iR1cDqJRM");
    if (record.mint !== "4kT8x1N5JBECpZdhUge9fFrDEv6q2yZPjJwjEKPfoeXx") {
      console.error("SOLD: unexpected mint in LAUNCH.json: " + record.mint);
      process.exit(1);
    }
    if (record.create_signature !== "4Mh2o3aD1sjCGY5Xn9bW8Lgt4oiDoqhreVmAEjQcfpMLVks4shkujeDrSBsNYxY6XR18nKWUSzGzQn3iR1cDqJRM") {
      console.error("SOLD: unexpected create signature in LAUNCH.json");
      process.exit(1);
    }
  } catch (err) {
    console.error("SOLD: could not copy " + path.join(botDir, "LAUNCH.json") + " to " + path.join(outputDir, "LAUNCH.json") + ": " + err.message);
    process.exit(1);
  }
}

main();
