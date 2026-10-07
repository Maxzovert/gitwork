/**
 * Scaffold a notes/*.md stub when a "feature-like" file is edited,
 * or when invoked manually: node scaffold-feature-note.mjs --name my-feature
 *
 * Cursor afterFileEdit hook: reads JSON from stdin, returns {} (or additional_context if supported).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const NOTES_DIR = path.join(ROOT, "notes");
const TEMPLATE_PATH = path.join(NOTES_DIR, "_TEMPLATE.md");
const README_PATH = path.join(NOTES_DIR, "README.md");

const IGNORE_NOTE_BASENAMES = new Set(["README.md", "_TEMPLATE.md"]);

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    // Safety: don't hang forever if stdin never ends
    setTimeout(() => resolve(data), 2000);
  });
}

function slugify(input) {
  return String(input)
    .replace(/\.[^.]+$/, "")
    .replace(/\(protected\)/gi, "")
    .replace(/[\[\]]/g, "")
    .split(/[/\\]+/)
    .filter(Boolean)
    .pop()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function listNoteFiles() {
  if (!fs.existsSync(NOTES_DIR)) return [];
  return fs
    .readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith(".md") && !IGNORE_NOTE_BASENAMES.has(f));
}

function nextNoteNumber() {
  let max = 0;
  for (const f of listNoteFiles()) {
    const m = /^(\d+)-/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function noteExistsForSlug(slug) {
  const needle = `-${slug}.md`;
  return listNoteFiles().some(
    (f) => f === `${slug}.md` || f.endsWith(needle) || f.includes(`-${slug}.md`),
  );
}

function isFeaturePath(relPosix) {
  const p = relPosix.replace(/\\/g, "/");
  if (!p.startsWith("src/")) return false;
  if (p.includes("/components/ui/")) return false;
  if (p.endsWith("loading.tsx") || p.endsWith("layout.tsx")) return false;

  // New product page under protected app
  if (
    /^src\/app\/\(protected\)\/[^/]+\/page\.tsx$/.test(p) ||
    /^src\/app\/\(protected\)\/[^/]+\/[^/]+\/page\.tsx$/.test(p)
  ) {
    return true;
  }

  // Domain libs (not tiny utils)
  if (/^src\/lib\/(?!utils\.ts$)[^/]+\.ts$/.test(p)) {
    return true;
  }

  // New API routes that aren't the generic tRPC catch-all
  if (
    /^src\/app\/api\/(?!trpc\/).+\/route\.ts$/.test(p)
  ) {
    return true;
  }

  return false;
}

function extractEditedPath(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.file_path,
    payload.filePath,
    payload.path,
    payload.uri,
    payload.file,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  if (Array.isArray(payload.edits) && payload.edits[0]?.file_path) {
    return payload.edits[0].file_path;
  }
  if (Array.isArray(payload.files) && typeof payload.files[0] === "string") {
    return payload.files[0];
  }
  return null;
}

function buildStub({ slug, title, sourcePath }) {
  const today = new Date().toISOString().slice(0, 10);
  let body = fs.existsSync(TEMPLATE_PATH)
    ? fs.readFileSync(TEMPLATE_PATH, "utf8")
    : `# Feature: ${title}\n\n## What is this?\n\n## Why this?\n\n## How it works\n\n## Key files\n\n## Developer notes\n`;

  body = body.replace(/\\?<Name\\?>/g, title);
  body = body.replace(/Status: `stub` \| `draft` \| `complete`/, "Status: `stub`");
  if (!body.includes("Status:")) {
    body = body.replace(
      `# Feature: ${title}`,
      `# Feature: ${title}\n\n> Status: \`stub\`\n> Added: ${today}`,
    );
  } else {
    body = body.replace(/Added: YYYY-MM-DD/, `Added: ${today}`);
  }

  if (sourcePath) {
    body = body.replace(
      /Owners \/ touch points: list primary files/,
      `Auto-scaffolded from \`${sourcePath.replace(/\\/g, "/")}\` — fill in details`,
    );
    if (!body.includes(sourcePath.replace(/\\/g, "/"))) {
      body += `\n\n## Scaffold source\n\n- \`${sourcePath.replace(/\\/g, "/")}\`\n`;
    }
  }

  return body;
}

function appendReadmeRow(num, slug, title, filename) {
  if (!fs.existsSync(README_PATH)) return;
  let readme = fs.readFileSync(README_PATH, "utf8");
  const row = `| ${String(num).padStart(2, "0")} | ${title} | [${filename}](./${filename}) |`;
  if (readme.includes(filename)) return;

  // Insert before the blank line after the table, or before "## Auto-adding"
  if (readme.includes("## Auto-adding notes")) {
    readme = readme.replace(
      "\n## Auto-adding notes",
      `\n${row}\n\n## Auto-adding notes`,
    );
  } else {
    readme += `\n${row}\n`;
  }
  fs.writeFileSync(README_PATH, readme, "utf8");
}

function createNote({ slug, sourcePath }) {
  if (noteExistsForSlug(slug)) {
    return { created: false, reason: "exists", slug };
  }
  const num = nextNoteNumber();
  const filename = `${String(num).padStart(2, "0")}-${slug}.md`;
  const title = titleFromSlug(slug);
  const full = path.join(NOTES_DIR, filename);
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.writeFileSync(full, buildStub({ slug, title, sourcePath }), "utf8");
  appendReadmeRow(num, slug, title, filename);
  return { created: true, filename, slug, title };
}

function deriveSlugFromPath(absOrRel) {
  const rel = path.isAbsolute(absOrRel)
    ? path.relative(ROOT, absOrRel)
    : absOrRel;
  const posix = rel.replace(/\\/g, "/");

  // Prefer folder name for protected pages: meetings, pr-digests, …
  const pageMatch = posix.match(
    /^src\/app\/\(protected\)\/([^/]+)(?:\/[^/]+)*\/page\.tsx$/,
  );
  if (pageMatch) return slugify(pageMatch[1]);

  const apiMatch = posix.match(/^src\/app\/api\/(.+)\/route\.ts$/);
  if (apiMatch) return slugify(apiMatch[1].replace(/\//g, "-"));

  return slugify(path.basename(posix));
}

async function main() {
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf("--name");
  if (nameIdx !== -1 && args[nameIdx + 1]) {
    const result = createNote({ slug: slugify(args[nameIdx + 1]) });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const edited = extractEditedPath(payload);
  const out = { ok: true };

  if (edited) {
    const rel = path.isAbsolute(edited)
      ? path.relative(ROOT, edited)
      : edited;
    const posix = rel.replace(/\\/g, "/");

    if (isFeaturePath(posix)) {
      const slug = deriveSlugFromPath(posix);
      const result = createNote({ slug, sourcePath: posix });
      out.scaffold = result;
      if (result.created) {
        out.additional_context = [
          `Auto-created feature note stub: notes/${result.filename}.`,
          "Fill What / Why / How / Key files before finishing this feature (see notes/_TEMPLATE.md and .cursor/rules/feature-notes.mdc).",
        ].join(" ");
      }
    }
  }

  // Always print JSON for Cursor hooks
  process.stdout.write(JSON.stringify(out) + "\n");
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err) }) + "\n");
  process.exit(0); // fail open
});
