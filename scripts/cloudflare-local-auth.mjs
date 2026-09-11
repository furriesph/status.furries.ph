import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

// Explicit local opt-in only. Never invokes login/browser or copies OAuth to public files.
// Wrangler resolves encrypted Windows credentials and refreshes existing OAuth when needed.
export async function resolveCloudflareLocalAuth({
  env = process.env,
  execFileImpl = promisify(execFile),
  wranglerPath = fileURLToPath(
    new URL(
      "../../partners-api/node_modules/wrangler/bin/wrangler.js",
      import.meta.url,
    ),
  ),
} = {}) {
  if (env.CI)
    throw new Error(
      "Local Wrangler authentication is disabled in CI; configure a dedicated analytics token.",
    );
  try {
    const { stdout } = await execFileImpl(
      process.execPath,
      [wranglerPath, "auth", "token", "--json"],
      {
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 64 * 1024,
        windowsHide: true,
        // Do not let a previously copied OAuth token take precedence over the refreshable store.
        env: {
          ...env,
          CLOUDFLARE_API_TOKEN: "",
          CLOUDFLARE_API_KEY: "",
          CLOUDFLARE_EMAIL: "",
          CF_API_TOKEN: "",
          CF_API_KEY: "",
          CF_EMAIL: "",
          CI: "true",
          WRANGLER_SEND_METRICS: "false",
        },
      },
    );
    const auth = JSON.parse(
      stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1),
    );
    if (
      !["oauth", "api_token"].includes(auth.type) ||
      typeof auth.token !== "string" ||
      !auth.token.trim()
    )
      throw new Error();
    return { ...env, CLOUDFLARE_API_TOKEN: auth.token };
  } catch {
    throw new Error(
      "Existing local Wrangler authentication could not be read or refreshed; configure a dedicated analytics token.",
    );
  }
}
