/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

app.commandLine.appendSwitch('disable-site-isolation-trials')

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

import * as remoteMain from '@electron/remote/main';
remoteMain.initialize();

const Store = require('electron-store');
Store.initRenderer();

import fs from 'fs';
import Handlebars from 'handlebars';

const ipc = require('electron').ipcMain;

ipc.on('CreateProject', (event, args) => {
  var projectPath = path.join(app.getPath('userData'), "/projects", args.name); //find the projects path
  if (fs.existsSync(projectPath)) {
    event.sender.send('CreateProjectReply', false);
  } else {
    const app = require('electron').app;

    if(process.env.NODE_ENV === 'development') {
      var templatePath = path.join(app.getAppPath(), "/templates", args.template);
    } else {
      var templatePath = path.join(app.getAppPath(), "/dist/templates", args.template);
    }

    var ncp = require('ncp').ncp;
    fs.mkdirSync(projectPath, { recursive: true });

    ncp(templatePath, projectPath, function (err) {
      if (err) {
          console.log(err);
          return console.error(err);
      }
  
      var files = getFilesFromDirectory(projectPath);
      for(var i = 0; i < files.length; i++) {
        const file = files[i];
        const extnames = [".html", ".js", ".css"];
        if(extnames.includes(path.extname(file))) {
          fs.chmodSync(file, 0o777);
          const template = Handlebars.compile(fs.readFileSync(file, 'utf8'));
          var saveText = template({ 
            name: args.name,
            user: "you",
          });
          fs.writeFileSync(file, saveText);
        }
      }
  
      event.sender.send('CreateProjectReply', projectPath);
    });
  }
});

ipc.on("openInExplorer", (event, args) => {
  shell.showItemInFolder(args);
});

ipc.on('getCssContent', (event, args) => {
  let cssContents = [];
  for(var i = 0; i < args.files.length; i++) {
    var file = args.files[i];
    if(file === "HTML") {
      cssContents.push({
        file: "HTML",
        content: fs.readFileSync(args.projectPath + "/index.html", 'utf8')
      });
    } else if(file === "Unknown") {
      cssContents.push({
        file: "Unknown"
      });
    } else {
      cssContents.push({
        file: file,
        content: fs.readFileSync(file, 'utf8')
      });
    }
  }
  event.sender.send('getCssContentReply', cssContents);
});

ipc.on('modifyCss', (event, args) => {
  let file = args.file;
  let content = args.content;
  let startIndex = args.startIndex;
  let endIndex = args.endIndex;

  var fileContent = fs.readFileSync(file, 'utf8');
  var splitFileContent = fileContent.split("\n");

  var newContent = splitFileContent.slice(0, startIndex).join("\n") + "\n" + content + "\n" + splitFileContent.slice(endIndex + 1).join("\n");

  fs.writeFileSync(file, newContent);

  event.sender.send('modifyCssReply', file.endsWith(".html"));
});

ipc.on('getFiles', (event, args) => { //When project folder is given with ipc
  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

function getFilesAndFolders(dirPath: string): any[] {
  var files = fs.readdirSync(dirPath)

  var arrayOfFiles = [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles.push({
        isFile: false,
        name: file,
        path: path.join(dirPath, "/", file),
        relativePath: path.relative(dirPath, path.join(dirPath, "/", file)),
        children: getFilesAndFolders(dirPath + "/" + file)
      });
    } else {
      arrayOfFiles.push({
        isFile: true,
        path: path.join(dirPath, "/", file),
        relativePath: path.relative(dirPath, path.join(dirPath, "/", file)),
        name: file
      });
    }
  })

  return arrayOfFiles
}

ipc.on('getAppPath', (event, args) => {
  event.sender.send('getAppPathReply', app.getAppPath());
});

ipc.on('getAppPath2', (event, args) => {
  event.sender.send('getAppPathReply2', app.getAppPath());
});

ipc.on('writeFile', (event, args) => {
  fs.writeFileSync(args.file, args.content);
});

ipc.on("addFile", (event, args) => {
  fs.writeFileSync(args.path, "");

  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

ipc.on("addFolder", (event, args) => {
  fs.mkdirSync(args.path, { recursive: true });

  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

ipc.on("deleteFile", (event, args) => {
  var filePath = args.file;
  fs.unlinkSync(filePath);
  // Loop through all the windows and if the file is open, close the window.
  for(var i = 0; i < popoutWindiows.length; i++) {
    var url = popoutWindiows[i].window.webContents.getURL().replace(/%20/g, " ");
    if(url.endsWith(args.file)) {
      popoutWindiows[i].window.close();
    }
  }
  
  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

ipc.on("deleteFolder", (event, args) => {
  var folderPath = args.folder;
  var files = getFilesFromDirectory(folderPath);
  // Close all files inside the folder
  for(let i = 0; i < files.length; i++) {
    for(let j = 0; j < popoutWindiows.length; j++) {
      var url = popoutWindiows[j].window.webContents.getURL().replace(/%20/g, " ");
      if(url.endsWith(files[i])) {
        popoutWindiows[j].window.close();
      }
    }
  }

  // Delete the folder
  fs.rmSync(folderPath, { recursive: true });
  
  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

ipc.on('renameFile', (event, args) => {
  var oldPath = args.path;
  var newPath = path.join(path.dirname(oldPath), args.name);

  fs.renameSync(oldPath, newPath);

  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

ipc.on('renameFolder', (event, args) => {
  let oldPath = args.path;
  let newPath = path.join(path.join(oldPath, ".."), args.name);

  fs.renameSync(oldPath, newPath);

  var dirFiles = getFilesAndFolders(args.directory); // Returns an array of file paths in a directory, including subdirectories
  event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
});

ipc.on('getFile', (event, args) => {
  let imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico"];
  let fileExtension = path.extname(args.file);
  if(imageExtensions.includes(fileExtension)) {
    event.sender.send('getFileReply', {isImage: true, file: args.file});
  } else {
    let file, isError = false;
    try {
      file = fs.readFileSync(args.file, 'utf8');
    } catch(err) {
      event.sender.send('fixTab');
      isError = true;
    }

    if(!isError) {
      event.sender.send('getFileReply', {isImage: false, content: file, fileName: args.file});
    }
  }
});

var popoutWindiows = [];

var openWindowSender = null;

ipc.on('editorPopOut', (event, args) => {
  popoutWindiows.push({
    window: new BrowserWindow({
      show: false,
      width: 1024,
      height: 728,
      minWidth: 1024,
      minHeight: 728,
      icon: getAssetPath('icon.png'),
      webPreferences: {
        backgroundThrottling: false,
        webSecurity: false,
        nodeIntegration: true,
        // contextIsolation is required for preload.js to work correctly, but the application seems to not work when it's enabled.
        contextIsolation: false,
        // preload: app.isPackaged
        //   ? path.join(__dirname, 'preload.js')
        //   : path.join(__dirname, '../../.erb/dll/preload.js'),
      },
      frame: false,
    }),
    index: args.index,
  });

  openWindowSender = event.sender;

  let newWinIndex = popoutWindiows.length - 1;

  let newWin = popoutWindiows[newWinIndex].window;

  newWin.on('maximize', () => {
    newWin.webContents.send('maximized');
  });
  newWin.on('unmaximize', () => {
    newWin.webContents.send('unmaximized');
  });

  newWin.loadURL(`${resolveHtmlPath("index.html")}#/editorPopout/${args.id}/${args.file}`);

  remoteMain.enable(newWin.webContents)

  newWin.webContents.on('did-finish-load', () => {
    if (!newWin) {
      throw new Error('"newWin" is not defined');
    }
    newWin.show();
    newWin.focus();

    event.sender.send('editorPopoutReply', {index: args.index, window: newWinIndex});
  });

});

ipc.on('editorFocusWindow', (event, args) => {
  popoutWindiows[args].window.focus();
});

ipc.on('windowClosedRenderer', (event, args) => {
  //convert the href in args to the window open
  //first, get the part of the string after the #
  var href = args.split("#")[1];
  if(href.startsWith("/editorPopout/")) {
    for(var i = 0; i < popoutWindiows.length; i++) {
      var url = popoutWindiows[i].window.webContents.getURL();
      url = url.substring(url.lastIndexOf('\\'));

      //Probably a better way to figure this out
      if(url === args.substring(args.lastIndexOf('\\'))) {
        if(openWindowSender !== null) {
          openWindowSender.send('popoutClose', popoutWindiows[i].index);
          popoutWindiows.splice(i, 1);
        }
        return;
      }
    }
  }
});

ipc.on('deleteProject', (event, args) => {
  var projectPath = args.directory;
  if (fs.existsSync(projectPath)) {
    fs.rmdirSync(projectPath, { recursive: true });
    event.sender.send('deleteProjectReply', true);
  } else {
    event.sender.send('deleteProjectReply', "Folder does not exist. This is likely due to an error in the project creation process.");
  }
});

ipc.on('minimizeWindow', (event, args) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.minimize();
});
ipc.on('maximizeWindow', (event, args) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.maximize();
});
ipc.on('unmaximizeWindow', (event, args) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.unmaximize();
});
ipc.on('closeWindow', (event, args) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.close();
});


const getFilesFromDirectory = function(dirPath, arrayOfFiles = []) {
  var files = fs.readdirSync(dirPath)

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getFilesFromDirectory(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
  
const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 1024,
    minHeight: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      backgroundThrottling: false,
      webSecurity: false,
      nodeIntegration: true,
      // contextIsolation is required for preload.js to work correctly, but the application seems to not work when it's enabled.
      contextIsolation: false,
      // preload: app.isPackaged
      //   ? path.join(__dirname, 'preload.js')
      //   : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
    frame: false,
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('maximized');
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('unmaximized');
  });
  
  remoteMain.enable(mainWindow.webContents);

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
