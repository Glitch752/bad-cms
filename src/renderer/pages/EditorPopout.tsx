// imports
import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './EditorPopout.module.css';

import CodeEditor from "react-monaco-editor";

import path from 'path';
const ipc = require('electron').ipcRenderer;

import { store } from '../store';

// Editor code (js)
export default function Editor(props) {
    let { file, id } = useParams();

    //Probably a way to optimize this as well
    let [editorCode, setEditorCode] = React.useState("Loading editor...");
    let [editorLanguage, setEditorLanguage] = React.useState("");
    let [unsaved, setUnsaved] = React.useState(false);

    let projects = store.get('projects');

    useEffect(() => {
      ipc.send('getFile', {file: file});
    }, []);

    ipc.eventNames().forEach((channel: string) => {
      ipc.removeAllListeners(channel);
    });

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

    useEffect(() => {
      window.addEventListener('resize', windowResize);
      return () => {
        window.removeEventListener('resize', windowResize);
      }
    }, []);

    const windowResize = () => {
      if(monaco !== null) {
        monaco.layout();
      }
    }

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
        value={editorCode}
        theme="vs-dark"
        className={styles.editor}
        onChange={(newValue) => {
          if(!unsaved) setUnsaved(true);
        }}
        editorDidMount={(editor) => {
          monaco = editor;
          windowResize();
        }}
      />

    return (
        codeEditor
    );
}