/**
 * Post-build script: Replace the large o200k_base tokenizer data (~2.2MB)
 * with a minimal stub to fit within Cloudflare Workers free plan size limit (3 MiB).
 *
 * Token counting will fall back to estimation but agent functionality is unaffected.
 */
import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

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
  try {
    files = readdirSync(buildDir);
  } catch {
    console.log(`⚠️  Directory ${buildDir} not found, skipping`);
    continue;
  }

  for (const file of files) {
    if (file.includes('o200k_base') && file.endsWith('.mjs')) {
      const filePath = join(buildDir, file);
      writeFileSync(filePath, stub, 'utf-8');
      console.log(`✅ Replaced ${buildDir}/${file} with minimal stub`);
      replaced++;
    }
  }
}

if (replaced === 0) {
  console.log('⚠️  No o200k_base file found in any directory');
} else {
  console.log(`✅ Stripped ${replaced} tokenizer file(s) total`);
}
