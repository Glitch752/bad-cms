// imports
import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './EditorPopout.module.css';

import CodeEditor, { loader } from "@monaco-editor/react";

import path from 'path';
const ipc = require('electron').ipcRenderer;

// Editor code (js)
export default function Editor() {
    let { file } = useParams();

    //Probably a way to optimize this as well
    let [editorCode, setEditorCode] = React.useState("");
    let [editorLanguage, setEditorLanguage] = React.useState("");

    ipc.send('getFile', {file: file});

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

    return (
        <CodeEditor
          defaultLanguage="html"
          language={editorLanguage}
          width="100vw"
          defaultValue={"Loading editor..."}
          value={editorCode}
          theme="vs-dark"
          className={styles.editor}
        />
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