// imports
import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './EditorPopout.module.css';

import CodeEditor, { loader } from "@monaco-editor/react";

import path from 'path';
const ipc = require('electron').ipcRenderer;

import { store } from '../store';

// Editor code (js)
export default function Editor(props) {
    let { file, id } = useParams();

    //Probably a way to optimize this as well
    let [editorCode, setEditorCode] = React.useState("");
    let [editorLanguage, setEditorLanguage] = React.useState("");
    let [unsaved, setUnsaved] = React.useState(false);

    let projects = store.get('projects');

    useEffect(() => {
      ipc.send('getFile', {file: file});
    }, []);

    ipc.removeAllListeners();

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

    props.settitle([
      <span key="left" className="leftText">Bad CMS for Devs</span>,
      <span key="center" className="centerText">Editing {file.substring(projects[id].directory.length)}
        {unsaved ? <i className={"fas fa-circle " + styles.unsavedIcon}></i> : ""}
      </span>,
      <span key="right" className="rightText"></span>
    ]);

    let monaco = null;

    const keyPressed = (e) => {
      if(e.ctrlKey && e.key === "s") {
        e.preventDefault();
        let currentCode = monaco.getValue();
        ipc.send('writeFile', {file: file, content: currentCode});
        setUnsaved(false);
      }
    }

    useEffect(() => {
      document.addEventListener("keydown", keyPressed);
      return () => {
        document.removeEventListener("keydown", keyPressed);
      }
    }, []);

    const codeEditor =
      <CodeEditor
        key="editor"
        language={editorLanguage}
        width="100vw"
        defaultValue={"Loading editor..."}
        value={editorCode}
        theme="vs-dark"
        className={styles.editor}
        onChange={(newValue) => {
          if(!unsaved) setUnsaved(true);
        }}
        onMount={(editor) => {
          monaco = editor;
        }}
      />

    return (
        codeEditor
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