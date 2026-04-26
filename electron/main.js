const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
    Menu.setApplicationMenu(null);

    const win = new BrowserWindow({
        width: 1600,
        height: 900,
        backgroundColor: "#0F1117",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (!app.isPackaged) {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    }
}

app.whenReady().then(createWindow);