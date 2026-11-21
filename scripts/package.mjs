// Zips dist/ into an itch.io-ready HTML5 upload (index.html at the root of the zip).
// Run with: npm run package   (builds first)
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'koalas-retro-space-shooter.zip');

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found - run "npm run build" first.');
  process.exit(1);
}
if (existsSync(out)) rmSync(out);

if (process.platform === 'win32') {
  // Not Compress-Archive: Windows PowerShell 5.1 writes "assets\x.png" entry names, which itch.io's
  // Linux servers treat as file names with backslashes, so the game can't find its assets.
  // Build the zip with .NET directly, using forward slashes.
  const ps = [
    'Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem',
    `$src = '${dist}'`,
    `$zip = [IO.Compression.ZipFile]::Open('${out}', 'Create')`,
    'Get-ChildItem -Recurse -File $src | ForEach-Object {',
    '  $rel = $_.FullName.Substring($src.Length + 1).Replace([char]92, [char]47)',
    '  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel)',
    '}',
    '$zip.Dispose()',
  ].join('; ').replace('{;', '{').replace('; }', ' }');
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', out, '.'], { cwd: dist, stdio: 'inherit' });
}
console.log('Wrote ' + path.relative(root, out) + ' - upload it to itch.io as an HTML5 game.');
