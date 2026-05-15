// Run once to generate your VAPID key pair:
//   node generate-vapid-keys.js
//
// Then set the printed values as Worker secrets:
//   npx wrangler secret put VAPID_PUBLIC_KEY
//   npx wrangler secret put VAPID_PRIVATE_KEY

const crypto = require("crypto");

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
});

// Export private key as JWK to extract the raw scalar (d)
const privJwk = privateKey.export({ format: "jwk" });

// Export public key as DER (SPKI); the last 65 bytes are the uncompressed EC point
const pubDer = publicKey.export({ type: "spki", format: "der" });
const pubKeyB64url = pubDer.subarray(-65).toString("base64url");
const privKeyB64url = privJwk.d;

console.log("\n=== VAPID Keys (run this once, save them safely) ===\n");
console.log("VAPID_PUBLIC_KEY:");
console.log(pubKeyB64url);
console.log("\nVAPID_PRIVATE_KEY:");
console.log(privKeyB64url);
console.log("\nSet them as Worker secrets:");
console.log("  npx wrangler secret put VAPID_PUBLIC_KEY");
console.log("  npx wrangler secret put VAPID_PRIVATE_KEY");
console.log("  npx wrangler secret put VAPID_SUBJECT      (e.g. mailto:you@example.com)");
console.log("  npx wrangler secret put ALLOWED_ORIGIN     (e.g. https://youruser.github.io)\n");
