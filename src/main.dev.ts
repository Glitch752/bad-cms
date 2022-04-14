/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build:main`, this file is compiled to
 * `./src/main.prod.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import fs from 'fs';

const Handlebars = require("handlebars");

const Store = require('electron-store');

Store.initRenderer();

const ipc = require('electron').ipcMain;

ipc.on('CreateProject', (event, args) => {
  var projectPath = path.join(app.getPath('userData'), "/projects", args.name); //find the projects path
  if (fs.existsSync(projectPath)) {
    event.sender.send('CreateProjectReply', false);
  } else {
    const app = require('electron').app;

    var templatePath = path.join(app.getAppPath(), "/templates", args.template);

    var ncp = require('ncp').ncp;
    fs.mkdirSync(projectPath, { recursive: true })

    ncp(templatePath, projectPath, 
    function (err) {
      if (err) {
          console.log('ncp error');
          return console.error(err);
      }
  
      var files = getFilesFromDirectory(projectPath);
      for(var i = 0; i < files.length; i++) {
        const file = files[i];
        const extnames = [".html", ".js", ".css"];
        if(extnames.includes(path.extname(file))) {
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

 ipc.on('getCssContent', (event, args) => {
   let cssContents = [];
    for(var i = 0; i < args.length; i++) {
      var file = args[i];
      var content = fs.readFileSync(file, 'utf8');
      cssContents.push({
        file: file,
        content: content
      });
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
 });

 ipc.on('getFiles', (event, args) => { //When project folder is given with ipc
    var dirFiles = getFilesFromDirectory(args.directory); // Returns an array of file paths in a directory, including subdirectories
    for(var i = 0; i < dirFiles.length; i++) {
      dirFiles[i] = dirFiles[i].replace(args.directory, ""); //Replace the whole path with just the relative path from the project folder
    }
    event.sender.send('getFilesReply', {files: dirFiles, directory: args.directory});
 });

ipc.on('getAppPath', (event, args) => {
  event.sender.send('getAppPathReply', app.getAppPath());
});

ipc.on('writeFile', (event, args) => {
  fs.writeFileSync(args.file, args.content);
});

 ipc.on('getFile', (event, args) => {
    let imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico"];
    let fileExtension = path.extname(args.file);
    if(imageExtensions.includes(fileExtension)) {
      event.sender.send('getFileReply', {isImage: true, file: args.file});
    } else {
      let file = fs.readFileSync(args.file, 'utf8');
      event.sender.send('getFileReply', {isImage: false, content: file, fileName: args.file});
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
              frame: false,
              webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
              }
            }),
    index: args.index,
  });

  openWindowSender = event.sender;

  let newWinIndex = popoutWindiows.length - 1;

  let newWin = popoutWindiows[newWinIndex].window;

  newWin.loadURL(`file://${__dirname}/index.html#/editorPopout/` + args.file);

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

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
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

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 1024,
    minHeight: 728,
    frame: false,
    // icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  mainWindow.maximize();
  
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
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

app.whenReady().then(createWindow).catch(console.log);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
