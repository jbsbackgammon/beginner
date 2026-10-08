#!/usr/bin/env python3
"""Build a fingerprinted, cache-safe static GitHub Pages artifact.

No npm, third-party packages, or network access are necessary.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def short_hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()[:12]


def build(out: Path, revision: str) -> None:
    # Don't allow source overwrites even if someone passes '.' or 'src'.
    if out.resolve() == ROOT.resolve() or ROOT.resolve() in out.resolve().parents and out.resolve().name in {'src', 'tests', '.github'}:
        raise ValueError('Build output must not overwrite source files')
    if out.exists():
        shutil.rmtree(out)
    (out / 'src').mkdir(parents=True, exist_ok=True)
    (out / '.nojekyll').touch()

    ranking = (ROOT / 'src/ranking.mjs').read_bytes()
    ranking_name = f'ranking.{short_hash(ranking)}.mjs'
    (out / 'src' / ranking_name).write_bytes(ranking)

    app = (ROOT / 'src/app.js').read_text(encoding='utf-8')
    old_import = "from './ranking.mjs'"
    if app.count(old_import) != 1:
        raise ValueError('Unexpected ranking module import')
    app = app.replace(old_import, f"from './{ranking_name}'")
    app_raw = app.encode('utf-8')
    app_name = f'app.{short_hash(app_raw)}.js'
    (out / 'src' / app_name).write_bytes(app_raw)

    css = (ROOT / 'style.css').read_bytes()
    css_name = f'style.{short_hash(css)}.css'
    (out / css_name).write_bytes(css)

    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    if index.count('href="style.css"') != 1 or index.count('src="src/app.js"') != 1:
        raise ValueError('Unexpected HTML resource paths')
    index = index.replace('href="style.css"', f'href="{css_name}"')
    index = index.replace('src="src/app.js"', f'src="src/{app_name}"')

    # GitHub SHA when available; local builds have a deterministic asset-based ID.
    version = revision if re.fullmatch(r'[0-9a-fA-F]{7,64}', revision) else short_hash(app_raw + css + ranking)
    manifest = {'version': version, 'app': app_name, 'css': css_name, 'ranking': ranking_name}
    (out / 'build-info.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

    # Old open tabs should never silently reload while staff are entering results.
    # The user may choose an explicit reload, which also cache-busts the document URL.
    checker = r'''<script>
(() => {
  const active = __VERSION__;
  let offered = false;
  async function checkUpdates() {
    if (offered || document.hidden) return;
    try {
      const url = new URL('build-info.json', document.baseURI);
      url.searchParams.set('t', String(Date.now()));
      const response = await fetch(url, {cache: 'no-store'});
      if (!response.ok) return;
      const info = await response.json();
      if (typeof info.version !== 'string' || !/^[a-fA-F0-9]{7,64}$/.test(info.version)) return;
      if (info.version === active) return;
      offered = true;
      const bar = document.createElement('div');
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10000;padding:12px 20px;background:#103d32;color:white;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;font:14px sans-serif;box-shadow:0 -2px 12px #0003';
      const message = document.createElement('span');
      message.textContent = '初級戦管理の更新版が公開されています。必要な入力を保存してから更新してください。';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '最新版に更新';
      button.style.cssText = 'color:#103d32;background:#fff;border:0;border-radius:5px;padding:8px 13px;font:inherit;font-weight:bold;cursor:pointer';
      button.addEventListener('click', () => {
        const next = new URL(window.location.href);
        next.searchParams.set('v', info.version);
        window.location.assign(next.href);
      });
      bar.append(message, button);
      document.body.append(bar);
    } catch (_) { /* A temporary offline state should not interrupt input. */ }
  }
  window.addEventListener('focus', checkUpdates);
  window.addEventListener('pageshow', checkUpdates);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdates(); });
  window.setInterval(checkUpdates, 300000);
  window.setTimeout(checkUpdates, 5000);
})();
</script>'''.replace('__VERSION__', json.dumps(version))
    if '</body>' not in index:
        raise ValueError('HTML body end tag missing')
    index = index.replace('</body>', checker + '\n</body>')
    index = index.replace('<meta name="robots"', '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta name="robots"', 1)
    (out / 'index.html').write_text(index, encoding='utf-8')
    print(f'Pages build: {version}')
    print(f'Asset cache busting: {css_name}, src/{app_name}, src/{ranking_name}')
    print(f'Output: {out}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='_site')
    parser.add_argument('--revision', default=os.getenv('GITHUB_SHA', ''))
    args = parser.parse_args()
    build((ROOT / args.output).resolve(), args.revision)
