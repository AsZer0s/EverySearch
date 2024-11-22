const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, dialog, shell} = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const iconv = require('iconv-lite');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'assets', 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
    useContentSize: true,
  });

  mainWindow.loadFile('index.html');

  ipcMain.on('update-height', (event, itemCount) => {
    const maxItems = 6;
    const itemHeight = 50;
    const newHeight = Math.min(itemCount, maxItems) * itemHeight + 80;
    mainWindow.setBounds({
      ...mainWindow.getBounds(),
      height: newHeight,
    });
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('blur', () => {
    mainWindow.hide();
  });
};

function createTray() {
  const trayIcon = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(trayIcon);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: '隐藏窗口',
      click: () => {
        mainWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('EverySearch');
  tray.setContextMenu(trayMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

async function searchEverything(query, limit, offset = 0) {
  if (!app.isReady()) {
    throw new Error("App is not ready yet.");
  }

  return new Promise((resolve, reject) => {
    const esPath = path.join(process.resourcesPath, 'assets', 'es.exe');
    if (!query.trim()) {  
      resolve([]);
      return;
    }

    const searchProcess = spawn(esPath, [query]);

    let stdout = '';
    let stderr = '';

    searchProcess.stdout.on('data', (data) => {
      stdout += iconv.decode(data, 'gbk');
    });

    searchProcess.on('close', (code) => {
      if (code !== 0 || stderr) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }

      // Process the results from stdout
      const results = stdout.split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(offset, offset + limit);

      // Prioritize .ink and .exe files by sorting them to the top
      const prioritizedResults = results.sort((a, b) => {
        const isAInk = a.toLowerCase().endsWith('.ink');
        const isBInk = b.toLowerCase().endsWith('.ink');
        const isAExe = a.toLowerCase().endsWith('.exe');
        const isBExe = b.toLowerCase().endsWith('.exe');

        // Priority sorting logic: .ink and .exe should appear first
        if (isAInk && !isBInk) return -1;  // A is .ink, B is not
        if (!isAInk && isBInk) return 1;   // A is not .ink, B is
        if (isAExe && !isBExe) return -1;  // A is .exe, B is not
        if (!isAExe && isBExe) return 1;   // A is not .exe, B is

        return 0; // If both are either .ink or .exe or neither, maintain order
      });

      resolve(prioritizedResults);
    });
  });
}


app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('Alt+Space', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('focus-input');
    }
  });

  ipcMain.handle('search-everything', async (event, { query, limit = 50 }) => {
    try {
      const results = await searchEverything(query, limit);
      return results;
    } catch (err) {
      console.error('Error in searchEverything handler:', err.message);
      throw new Error(`搜索失败: ${err.message}`);
    }
  });

  ipcMain.on('open-file', (event, filePath) => {
    if (!filePath) {
      dialog.showErrorBox('错误', '文件路径为空或未定义！');
      return;
    }
    const command = `start "" "${filePath}"`;
    const process = spawn(command, { shell: true });
    process.on('error', (err) => {
      dialog.showErrorBox('错误', `无法打开文件: ${err.message}`);
    });
    process.on('close', (code) => {
      if (code !== 0) {
        dialog.showErrorBox('错误', `文件打开失败，退出码: ${code}`);
      }
    });
  });
  
  app.on('before-quit', () => {
    app.isQuitting = true;
    if (mainWindow) {
      mainWindow.destroy();
    }
  });
});

app.on('will-quit', () => {
  if (global.backgroundProcess) {
    global.backgroundProcess.kill('SIGTERM');
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
