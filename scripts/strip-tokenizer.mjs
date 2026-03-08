/**
 * Post-build script:
 * 1. Replace o200k_base tokenizer data with minimal stub (saves ~1.1 MB gzip)
 * 2. Replace Mastra default welcome page with our chat UI
 * 3. Remove sensitive Cloudflare vars from generated Wrangler config
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sensitiveCloudflareVars = ['OPENAI_API_KEY'];

// ── 1. Strip tokenizer ──
const buildDirs = ['.mastra/.build', '.mastra/output'];
const stub = `var o200k_base = {
  "pat_str": "[^\\\\r\\\\n\\\\p{L}\\\\p{N}]?[\\\\p{Lu}\\\\p{Lt}\\\\p{Lm}\\\\p{Lo}\\\\p{M}]*[\\\\p{Ll}\\\\p{Lm}\\\\p{Lo}\\\\p{M}]+|\\\\p{N}{1,3}| ?[^\\\\s\\\\p{L}\\\\p{N}]+[\\\\r\\\\n/]*|\\\\s+",
  "special_tokens": {"<|endoftext|>":199999,"<|endofprompt|>":200018},
  "bpe_ranks": ""
};
export default o200k_base;
`;

let replaced = 0;
for (const buildDir of buildDirs) {
  let files;
  try { files = readdirSync(buildDir); } catch { continue; }
  for (const file of files) {
    if (file.includes('o200k_base') && file.endsWith('.mjs')) {
      writeFileSync(join(buildDir, file), stub, 'utf-8');
      console.log(`✅ Stripped tokenizer: ${buildDir}/${file}`);
      replaced++;
    }
  }
}
console.log(`✅ Stripped ${replaced} tokenizer file(s)`);

// ── 2. Replace welcome page with chat UI ──
const chatHtml = readFileSync(join(__dirname, '..', 'src', 'mastra', 'public', 'index.html'), 'utf-8');
// Escape the HTML for embedding in JS string
const escapedHtml = chatHtml
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$');

let pagesReplaced = 0;
for (const buildDir of buildDirs) {
  let files;
  try { files = readdirSync(buildDir); } catch { continue; }
  for (const file of files) {
    if (!file.endsWith('.mjs')) continue;
    const filePath = join(buildDir, file);
    let content = readFileSync(filePath, 'utf-8');
    if (content.includes('Welcome to Mastra')) {
      // Replace the landing page HTML with our chat UI
      // Use case-insensitive match: build output uses <!doctype html> (lowercase)
      content = content.replace(
        /`\s*<!doctype html>\s*<html[^]*?Welcome to Mastra[^]*?<\/html>\s*`/i,
        '`' + escapedHtml.trim() + '`'
      );
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Replaced welcome page in: ${buildDir}/${file}`);
      pagesReplaced++;
    }
  }
}

if (pagesReplaced === 0) {
  console.log('⚠️  Welcome page not found in build output');
} else {
  console.log(`✅ Replaced ${pagesReplaced} welcome page(s) with chat UI`);
}

// ── 3. Remove sensitive vars from generated Wrangler config ──
const wranglerFiles = ['wrangler.jsonc', '.mastra/output/wrangler.json'];

function removeSensitiveVars(content, keys) {
  let nextContent = content;

  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    nextContent = nextContent.replace(
      new RegExp(`^\\s*"${escapedKey}"\\s*:\\s*.*?,?\\s*$`, 'gm'),
      ''
    );
  }

  return nextContent.replace(/,(\s*[}\]])/g, '$1');
}

let sanitizedWranglerFiles = 0;
for (const wranglerFile of wranglerFiles) {
  const filePath = join(__dirname, '..', wranglerFile);
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    continue;
  }

  const sanitizedContent = removeSensitiveVars(content, sensitiveCloudflareVars);
  if (sanitizedContent === content) {
    continue;
  }

  writeFileSync(filePath, sanitizedContent, 'utf-8');
  console.log(`✅ Removed sensitive vars from: ${wranglerFile}`);
  sanitizedWranglerFiles++;
}

if (sanitizedWranglerFiles === 0) {
  console.log('ℹ️  No sensitive Wrangler vars found');
} else {
  console.log(`✅ Sanitized ${sanitizedWranglerFiles} Wrangler config file(s)`);
}
