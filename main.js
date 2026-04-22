const path = require("path");
const { app, BrowserWindow, nativeImage } = require("electron");

app.setName("RandomFood");

function getWindowIconPath() {
  if (process.platform === "win32") {
    return path.join(__dirname, "img", "RandomSimbol.ico");
  }

  return path.join(__dirname, "img", "RandomSimbol-linux.png");
}

async function createMainWindow() {
  const iconPath = getWindowIconPath();
  const appIcon = nativeImage.createFromPath(iconPath);
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.setIcon(appIcon);

  await window.webContents.session.clearCache();
  await window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    console.error("Falha ao iniciar janela principal:", error);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error("Falha ao recriar janela principal:", error);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
