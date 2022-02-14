// imports
import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './Editor.module.css';

import CodeEditor, { loader } from "@monaco-editor/react";

import path from 'path';

import { store } from '../store';

const ipc = require('electron').ipcRenderer;

// Editor code (js)
export default function Editor() {
    const navigate = useNavigate();
    let { id } = useParams();

    //Probably a way to optimize this, but it works for now
    let [selectionLoaded, loadSelection] = React.useState(false);
    let [selections, setSelections] = React.useState([]);
    let [editorCode, setEditorCode] = React.useState("");
    let [editorLanguage, setEditorLanguage] = React.useState("");
    let [selectedTab, setSelectedTab] = React.useState(0);
    //This works, but the entries are added many times. A ton of this code runs many times over.
    let [poppedOutSeletions, setPoppedOutSeletions] = React.useState([]);

    const projects = store.get('projects', false);

    var editorPane = [
      <CodeEditor
        key="editor"
        defaultLanguage="html"
        language={editorLanguage}
        width="calc(100vw - 200px)"
        defaultValue={"Loading editor..."}
        value={editorCode}
        theme="vs-dark"
        className={styles.editor}
      />
    ];
    
    if(selectionLoaded === false) {
      ipc.send('getFiles', {directory: projects[id].directory});
    }

    var editorName = "Code editor";

    ipc.once('getFilesReply', (event, args) => {
      var loadingSelections = [];
      for(let i = 0; i < args.files.length; i++) {
        loadingSelections.push(args.files[i]);
      }
      loadSelection(true);
      setSelections(loadingSelections);
      ipc.send('getFile', {file: path.join(args.directory, args.files[0])});
    });

    let selectTab = (tab) => {
      setSelectedTab(tab);
      ipc.send('getFile', {file: path.join(projects[id].directory, selections[tab])});
    }

    ipc.once('getFileReply', (event, args) => {
      if(args.fileName !== undefined) {
        var extToLang = {
          ".html": "html",
          ".css": "css",
          ".js": "javascript",
          ".svg": "html",
        };
        setEditorLanguage(extToLang[path.extname(args.fileName)]);
      }
      setEditorCode(args.content);
    });

    let popOut = () => {
      ipc.send('editorPopOut', {file: path.join(projects[id].directory, selections[selectedTab]), index: selectedTab});
    }

    var poppedOutSelectionsIndexes = [];
    var poppedOutSelectionsWindows = [];

    let updatePoppedOut = () => {
      poppedOutSelectionsIndexes = poppedOutSeletions.map((selection) => {return selection.index;});
      poppedOutSelectionsWindows = poppedOutSeletions.map((selection) => {return selection.window;});
    };

    updatePoppedOut();

    ipc.once('editorPopoutReply', (event, args) => {
      var poppedOutSelectionsTemp = poppedOutSeletions;
      poppedOutSelectionsTemp.push(args);
      setPoppedOutSeletions(poppedOutSelectionsTemp);
      updatePoppedOut();
      for(let i = 0; i < selections.length; i++) {
        if(poppedOutSelectionsIndexes.includes(i)) {
          continue;
        } else {
          selectTab(i);
          return;
        }
      }
    });

    ipc.once('popoutClose', (event, args) => {
      setPoppedOutSeletions(poppedOutSeletions.filter(x => x.index !== args));
      console.log(poppedOutSeletions);
    });

    let focusWindow = (window) => {
      ipc.send('editorFocusWindow', window);
    }

    var selectMenus = [];

    for(let i = 0; i < selections.length; i++) {
      let isSelected = (selectedTab === i ? styles.selectedSelection : "");
      if(poppedOutSelectionsIndexes.includes(i)) {
        //Add different popped out selection and make it so you can't select it
        selectMenus.push(
          <div key={i} className={styles.editorSelection + " " + isSelected} onClick={() => focusWindow(poppedOutSelectionsWindows[poppedOutSelectionsIndexes.indexOf(i)])}><i className={"fas fa-arrow-up-right-from-square " + styles.editorSelectionIcon}></i>{selections[i]}</div>
        );
      } else {
        selectMenus.push(
          <div key={i} className={styles.editorSelection + " " + isSelected} onClick={() => selectTab(i)}><i className={"fas fa-angle-right " + styles.editorSelectionIcon}></i>{selections[i]}</div>
        );
      }
    }

    return (
        // Actual JSX of the dsahboard
        <div>
            <i className={"fa-solid fa-arrow-left " + styles.leaveIcon} onClick={() => navigate("/Dashboard")}></i>
            <div className={styles.editorContainer}>
              <div className={styles.editorOptions}>
                <span className={styles.editorOptionsName}>{editorName}</span>
                <i className={"fa-solid fa-arrow-up-right-from-square " + styles.editorOptionsIcon} onClick={() => {popOut()}}></i>
              </div>
              {editorPane}
            </div>
            <div className={styles.paneSelector}>
              {selectMenus}
            </div>
        </div>
    );
}

//load monaco editor from node_modules
function ensureFirstBackSlash(str) {
    return str.length > 0 && str.charAt(0) !== "/"
        ? "/" + str
        : str;
}

function uriFromPath(_path) {
    const pathName = path.resolve(_path).replace(/\\/g, "/");
    return encodeURI("file://" + ensureFirstBackSlash(pathName));
}

loader.config({
  paths: {
    vs: uriFromPath(
      path.join(__dirname, "../node_modules/monaco-editor/min/vs")
    )
  }
});