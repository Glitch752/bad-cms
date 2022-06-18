// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const ipc = require('electron').ipcRenderer;

// When document has loaded, initialise
waitForWindowControls();

console.log('menu.js loaded');

window.onbeforeunload = (event) => {
    /* If window is reloaded, remove win event listeners
    (DOM element listeners get auto garbage collected but not
    Electron win listeners as the win is not dereferenced unless closed) */
    win.removeAllListeners();
}

function waitForWindowControls() {
    let windowControls = document.getElementById('window-controls') !== null;
    if (windowControls) {
        handleWindowControls();
    } else {
        setTimeout(waitForWindowControls, 100);
    }
}

function handleWindowControls() {
    // Make minimise/maximise/restore/close buttons work when they are clicked
    document.getElementById('min-button').addEventListener("click", event => {
        // win.minimize();
        ipc.send('minimizeWindow');
    });

    document.getElementById('max-button').addEventListener("click", event => {
        // win.maximize();
        ipc.send('maximizeWindow');
    });

    document.getElementById('restore-button').addEventListener("click", event => {
        // win.unmaximize();
        ipc.send('unmaximizeWindow');
    });

    document.getElementById('close-button').addEventListener("click", event => {
        // win.close();
        ipc.send('closeWindow');
        ipc.send('windowClosedRenderer', window.location.href);
    });

    // Toggle maximise/restore buttons when maximisation/unmaximisation occurs
    toggleMaxRestoreButtons(false);

    ipc.on('maximized', () => {
        toggleMaxRestoreButtons(true);
    });
    ipc.on('unmaximized', () => {
        toggleMaxRestoreButtons(false);
    });

    function toggleMaxRestoreButtons(maximized) {
        if (maximized) {
            document.body.classList.add('maximized');
        } else {
            document.body.classList.remove('maximized');
        }
    }
}