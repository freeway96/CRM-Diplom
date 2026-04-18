#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRM_DIR="$ROOT_DIR/frontend/public/CRM"

minify_css() {
  local src="$1"
  local dst="$2"
  node - "$src" "$dst" <<'NODE'
const fs = require('fs');
const [src, dst] = process.argv.slice(2);
let css = fs.readFileSync(src, 'utf8');
css = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>+~])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();
fs.writeFileSync(dst, css + '\n');
NODE
}

minify_js() {
  local src="$1"
  local dst="$2"
  terser "$src" --module --compress --mangle --output "$dst"
}

minify_css "$CRM_DIR/dashboard.css" "$CRM_DIR/dashboard.min.css"
minify_js "$CRM_DIR/js/dashboard-data.js" "$CRM_DIR/js/dashboard-data.min.js"
minify_js "$CRM_DIR/js/dashboard-utils.js" "$CRM_DIR/js/dashboard-utils.min.js"
minify_js "$CRM_DIR/dashboard.js" "$CRM_DIR/dashboard.min.js"
perl -0pi -e 's#\.\/js\/dashboard-data\.js#./js/dashboard-data.min.js#g; s#\.\/js\/dashboard-utils\.js#./js/dashboard-utils.min.js#g' "$CRM_DIR/dashboard.min.js"

echo "Built minified CRM assets."
