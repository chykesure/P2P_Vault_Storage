const fs = require('fs');
const path = require('path');

function fixZodMini(base) {
  const miniDir = path.join(base, 'node_modules', 'zod', 'mini');
  if (!fs.existsSync(miniDir)) return;
  const pkgPath = path.join(miniDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const mainFile = path.join(miniDir, pkg.main || 'index.cjs');
  if (fs.existsSync(mainFile)) return;
  
  // Find parent CJS entry
  const parentCjs = path.join(base, 'node_modules', 'zod', 'index.cjs');
  const parentJs = path.join(base, 'node_modules', 'zod', 'index.js');
  const parentEntry = fs.existsSync(parentCjs) ? parentCjs : parentJs;
  
  if (fs.existsSync(parentEntry)) {
    const relative = path.relative(miniDir, parentEntry).replace(/\\/g, '/');
    fs.writeFileSync(mainFile, 'module.exports = require("' + relative + '");');
    console.log('[fix-zod] Created ' + mainFile + ' -> ' + relative);
  }
}

fixZodMini(__dirname);

// Also fix nested copies
const portoDir = path.join(__dirname, 'node_modules', 'porto');
if (fs.existsSync(portoDir)) fixZodMini(portoDir);