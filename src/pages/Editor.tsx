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

    const projects = store.get('projects', []);

    var editorPane = [
      <CodeEditor
        key="editor"
        defaultLanguage="javascript"
        width="calc(100vw - 200px)"
        defaultValue={"// name: idk\n//icon: idk"}
        theme="vs-dark"
        className={styles.editor}
      />
    ];
    
    ipc.send('getFiles', {directory: projects[id].directory});

    ipc.once('getFilesReply', (event, args) => {
      console.log("files: " + args);
    });

    var editorName = "Code editor";
    var editorPanes = [];
    return (
        // Actual JSX of the dsahboard
        <div>
            <i className={"fa-solid fa-arrow-left " + styles.leaveIcon} onClick={() => navigate("/Dashboard")}></i>
            <div className={styles.editorContainer}>
              <div className={styles.editorOptions}>
                <span className={styles.editorOptionsName}>{editorName}</span>
                <i className={"fa-solid fa-arrow-up-right-from-square " + styles.editorOptionsIcon} onClick={() => {console.log("not implemented")}}></i>
              </div>
              {editorPane}
            </div>
            <div className={styles.paneSelector}>
              {editorPanes}
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