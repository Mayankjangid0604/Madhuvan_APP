const path = require("path");
const { spawn } = require('child_process');
const fs = require("fs");
const { rebuild } = require('@electron/rebuild');

module.exports = async function afterPack(context) {
  console.log("🔧 Running afterPack...");
  
  const backendPath = path.join(context.appOutDir, 'resources', 'backend');
  
  console.log("📦 Backend path:", backendPath);
  
  if (!fs.existsSync(backendPath)) {
    console.error("❌ Backend folder not found!");
    return;
  }
  
  // Install dependencies
  console.log("📦 Installing backend dependencies...");
  
  await new Promise((resolve) => {
    const npm = spawn('npm', ['install', '--production', '--omit=optional'], {
      cwd: backendPath,
      stdio: 'inherit',
      shell: true
    });
    
    npm.on('close', (code) => {
      console.log(`npm install finished with code: ${code}`);
      resolve();
    });
    
    npm.on('error', (err) => {
      console.error("npm error:", err);
      resolve();
    });
  });
  
  // Rebuild native modules for Electron
  console.log(`🔧 Rebuilding native modules for Electron ${context.electronVersion} (${context.arch})...`);
  
  try {
    await rebuild({
      buildPath: backendPath,
      electronVersion: context.electronVersion,
      arch: context.arch,
      force: true
    });
    console.log("✅ Rebuild completed successfully using @electron/rebuild");
  } catch (err) {
    console.error("❌ Rebuild failed using @electron/rebuild:", err);
  }
  
  console.log("✅ afterPack completed");
};