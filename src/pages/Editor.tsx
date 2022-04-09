// imports
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Editor.module.css';
import { createMachine, assign, interpret } from 'xstate';
import { useMachine } from '@xstate/react';

import CodeEditor, { loader } from "@monaco-editor/react";

import path from 'path';

import { store } from '../store';

const ipc = require('electron').ipcRenderer;

// Editor code (js)
export default function Editor() {
    const navigate = useNavigate();
    const projects = store.get('projects', false);
    let { id } = useParams();

    //Probably a way to optimize this, but it works for now
    // let [selectionLoaded, loadSelection] = React.useState(false);
    // let [selections, setSelections] = React.useState([]);
    // let [editorCode, setEditorCode] = React.useState("");
    // let [editorLanguage, setEditorLanguage] = React.useState("");
    // let [selectedTab, setSelectedTab] = React.useState(0);
    // let [deleteConfirm, setDeleteConfirm] = React.useState(false);
    // //This works, but the entries are added many times. A ton of this code runs many times over.
    // let [poppedOutSeletions, setPoppedOutSeletions] = React.useState([]);
    // let [JSInjected, setJSInjected] = React.useState(false);
    // let [editorChanges, setEditorChanges] = React.useState([]);
    // let [programaticChangeMade, setProgramaticChangeMade] = React.useState(false);
    // All of this, but a state machine now.

    const stateMachine = createMachine({
      id: "editor",
      initial: "loading",
      context: {
        tab: 0,
        editorTabs: [],
        monaco: null,
        editor: null,
      },
      states: {
        loading: {
          on: {
            editorLoaded: {
              target: "editor",
              actions: [
                () => {
                  ipc.send('getFiles', {directory: projects[id].directory});
                },
                assign((context, event: { monaco: any, editor: any }) => {
                  return {
                    monaco: event.monaco,
                    editor: event.editor,
                  }
                })
              ],
            }
          }
        },
        editor: {
          initial: "loading",
          on: {
            setTabs: {
              actions: assign((context, event: { tabs: any }) => {
                return {
                  editorTabs: event.tabs,
                }
              })
            },
            switchTab: [
              {
                target: ".code",
                cond: (context, event) => event.tab >= 0,
    
                actions: assign((context, event: { tab: any }) => {
                  return {
                    tab: event.tab,
                  };
                }),
              },
              {
                target: ".layout",
                cond: (context, event) => event.tab === -2,
    
                actions: assign((context, event: { tab: any }) => {
                  return {
                    tab: event.tab,
                  };
                }),
              },
              {
                target: ".settings",
    
                actions: assign((context, event: { tab: any }) => {
                  return {
                    tab: event.tab,
                  };
                }),
              },
            ],
          },
          states: {
            loading: {
              on: {
                finishedLoading: "code"
              }
            },
            code: {},
            layout: {},
            settings: {
              initial: "deleteClosed",
              on: {
                openDelete: ".deleteOpen",
                closeDelete: ".deleteClosed",
              },
              states: {
                deleteClosed: {
                  on: {
                    openDelete: "deleteOpen"
                  }
                },
                deleteOpen: {
                  on: {
                    closeDelete: "deleteClosed"
                  }
                }
              }
            },
          },
        },
      },
    });

    const [state, send, service] = useMachine(stateMachine);

    let editor = state.context.editor;
    let monaco = state.context.monaco;
    
    var editorPane = [
      <CodeEditor
        key="editor"
        defaultLanguage="html"
        // language={editorLanguage}
        width="calc(100vw - 200px)"
        defaultValue="Loading editor..."
        // value={editorCode}
        theme="vs-dark"
        className={styles.editor}
        // onChange={updateEditorChanges}
        onMount={(editorElem, monacoElem) => {
          send("editorLoaded", { monaco: monacoElem, editor: editorElem });
        }}
      />
    ];

    // Remove all IPC listeners when the component is mounted again.
    ipc.removeAllListeners();
    
    // if(selectionLoaded === false) {
    //   ipc.send('getFiles', {directory: projects[id].directory}); // Send a message getFiles with the directpry of the project
    // }

    // ipc.once('getFilesReply', (event, args) => {
    //   var loadingSelections = [];
    //   var editorChangesTemp = [];
    //   for(let i = 0; i < args.files.length; i++) {
    //     loadingSelections.push(args.files[i]);
    //     editorChangesTemp.push(false);
    //   }
    //   loadSelection(true);
    //   setSelections(loadingSelections);
    //   setEditorChanges(editorChangesTemp);
    //   ipc.send('getFile', {file: path.join(args.directory, args.files[0])});
    // });
    
    ipc.once('getFilesReply', async (event, args) => {
      var loadingSelections = [];
      for(let i = 0; i < args.files.length; i++) {
        loadingSelections.push({
          name: args.files[i],
          window: false
        });
      }
      // Set text in the editor to Loading file...
      while(editor === null) {
        // Wait for the editor to be loaded
        await sleep(50);
      }
      send("setTabs", {tabs: loadingSelections});
      if(state.can('finishedLoading')) send("finishedLoading");
      ipc.send('getFile', {file: path.join(args.directory, args.files[0])});
    });

    // let selectTab = (tab) => {
    //   setSelectedTab(tab);
    //   if(tab >= 0) {
    //     ipc.send('getFile', {file: path.join(projects[id].directory, selections[tab])});
    //   }
    // }

    // ipc.once('getFileReply', (event, args) => {
    //   if(args.fileName !== undefined) {
    //     var extToLang = { // List of compatible files with Monaco language support
    //       ".html": "html",
    //       ".css": "css",
    //       ".js": "javascript",
    //       ".svg": "html",
    //     };
    //     setProgramaticChangeMade(true);
    //     setEditorLanguage(extToLang[path.extname(args.fileName)]);
    //   }
    //   setProgramaticChangeMade(true);
    //   setEditorCode(args.content);
    // });

    ipc.once('getFileReply', async (event, args) => {
      while(editor === null) {
        // Wait for the editor to be loaded
        await sleep(50);
        console.log("Waiting for editor to be loaded...");
      }
      let language = null;
      if(args.fileName !== undefined) {
        var extToLang = { // List of compatible files with Monaco language support
          ".html": "html",
          ".css": "css",
          ".js": "javascript",
          ".svg": "html",
        };

        language = extToLang[path.extname(args.fileName)];
        language = language === undefined ? "plaintext" : language;

        monaco.editor.setModelLanguage(editor.getModel(), language);
      }
      editor.setValue(args.content);
    });

    // let popOut = () => {
    //   ipc.send('editorPopOut', {file: path.join(projects[id].directory, selections[selectedTab]), index: selectedTab});
    // }

    // var poppedOutSelectionsIndexes = [];
    // var poppedOutSelectionsWindows = [];

    // let updatePoppedOut = () => {
    //   poppedOutSelectionsIndexes = poppedOutSeletions.map((selection) => {return selection.index;});
    //   poppedOutSelectionsWindows = poppedOutSeletions.map((selection) => {return selection.window;});
    // };

    // updatePoppedOut();

    // ipc.once('editorPopoutReply', (event, args) => {
    //   var poppedOutSelectionsTemp = poppedOutSeletions;
    //   poppedOutSelectionsTemp.push(args);
    //   setPoppedOutSeletions(poppedOutSelectionsTemp);
    //   updatePoppedOut();
    //   for(let i = 0; i < selections.length; i++) {
    //     if(poppedOutSelectionsIndexes.includes(i)) {
    //       continue;
    //     } else {
    //       selectTab(i);
    //       return;
    //     }
    //   }
    // });

    // ipc.once('popoutClose', (event, args) => {
    //   setPoppedOutSeletions(poppedOutSeletions.filter(x => x.index !== args));
    //   console.log(poppedOutSeletions);
    // });

    // let focusWindow = (window) => {
    //   ipc.send('editorFocusWindow', window);
    // }

    // var selectMenus = [];

    // for(let i = 0; i < selections.length; i++) {
    //   let isSelected = (selectedTab === i ? styles.selectedSelection : "");
    //   if(poppedOutSelectionsIndexes.includes(i)) {
    //     //Add different popped out selection and make it so you can't select it
    //     selectMenus.push(
    //       <div key={i} className={styles.editorSelection + " " + isSelected} onClick={() => focusWindow(poppedOutSelectionsWindows[poppedOutSelectionsIndexes.indexOf(i)])}><i className={"fas fa-arrow-up-right-from-square " + styles.editorSelectionIcon}></i>{selections[i]}</div>
    //     );
    //   } else {
    //     let IsSavedElement = editorChanges[i] ? <i className={"fas fa-save " + styles.editorSelectionIcon}></i> : "";
    //     selectMenus.push(
    //       <div key={i} className={styles.editorSelection + " " + isSelected} onClick={() => selectTab(i)}><i className={"fas fa-angle-right " + styles.editorSelectionIcon}></i>{selections[i]}{IsSavedElement}</div>
    //     );
    //   }
    // }

    // let deleteProjectConfirm = () => {
    //   var currentProjects = store.get('projects', []);
    //   ipc.send('deleteProject', {directory: currentProjects[id].directory});
    //   currentProjects.splice(id, 1);
    //   store.set('projects', currentProjects);
    // }

    // ipc.once('deleteProjectReply', (event, args) => {
    //   if(args === true) {
    //     navigate('/');
    //   } else {
    //     navigate('/Error', {state: {error: "Error deleting project!", errorMessage: args}});
    //   }
    // });

    // let deleteProject = () => {
    //   setDeleteConfirm(true);
    // }

    // // let updateLayoutEditor = () => {
    // //   ipc.send('getLayoutEditorHTML', {directory: projects[id].directory, index: "index.html"});
    // // }

    // // updateLayoutEditor();

    // // ipc.on('getLayoutEditorHTMLReply', (event, args) => {
    // // });

    // let deleteProjectElement = null;

    // let InjectJS = () => {
    //     ipc.send('getAppPath');
    // }

    // if(!JSInjected) {
    //   setJSInjected(true);
    //   ipc.on('getAppPathReply', (event, args) => {
    //       var iFrameHead = window.frames["editorFrame"].document.getElementsByTagName("head")[0];
    //       var myscript = document.createElement('script');
    //       myscript.type = 'text/javascript';
    //       myscript.src = path.join(args, '/pages/editorLayoutInjectScript.js');
    //       iFrameHead.appendChild(myscript);
    //   });
    // }

    // if(deleteConfirm) {
    //   deleteProjectElement =
    //     <div className={styles.confirmDelete}>
    //       <div className={styles.confirmDeleteContainer}>
    //         <div className={styles.confirmDeleteText}>Are you sure you want to delete this project? This action is irreversible.</div>
    //         <div className={styles.confirmDeleteButtons}>
    //           <button className={`${styles.confirmDeleteButton} ${styles.confirmDeleteButtonCancel}`} onClick={() => setDeleteConfirm(false)}>Cancel</button>
    //           <button className={styles.confirmDeleteButton} onClick={() => deleteProjectConfirm()}>Delete</button>
    //         </div>
    //       </div>
    //     </div>
    // } else {
    //   deleteProjectElement = <></>;
    // }

    // const settignsSelected = (selectedTab === -1 ? styles.selectedSelection : "");
    // const layoutEditorSelected = (selectedTab === -2 ? styles.selectedSelection : "");
    // const defaultSelections = [
    //   {
    //     element: [
    //       <div key="settings" className={styles.editorSelection + " " + layoutEditorSelected} onClick={() => selectTab(-2)}>
    //         <i className={"fas fa-table " + styles.editorSelectionIcon}></i>
    //         Layout editor
    //       </div>
    //     ],
    //     menu: [
    //       // Add layout editor: render the files in the project directory.
    //       <div key="layout" className={styles.layoutEditor}> 
    //         <div className={styles.layoutEditorPage}>
    //           <iframe src={`file://${projects[id].directory}/index.html`} className={styles.projectIFrame} name="editorFrame" id="editorFrame" onLoad={() => InjectJS()}></iframe>
    //         </div>
    //       </div>
    //     ],
    //     id: -2,
    //     name: "Layout editor",
    //   },
    //   {
    //     element: [
    //       <div key="settings" className={styles.editorSelection + " " + settignsSelected} onClick={() => selectTab(-1)}>
    //         <i className={"fas fa-gear " + styles.editorSelectionIcon}></i>
    //         Settings
    //       </div>
    //     ],
    //     menu: [
    //       <div key="settings" className={styles.settingsMenu}>
    //         <div className={styles.settingsMenuSeparator}>Misc</div>
    //         <div className={styles.settingsMenuSection}>
    //           Some sort of settings menu idk
    //         </div>
    //         <div className={`${styles.settingsMenuSeparator} ${styles.settingMenuDanger}`}>DANGER ZONE</div>
    //         <div className={styles.settingsMenuSection}>
    //           <button className={styles.deleteProjectButton} onClick={() => deleteProject()}>Delete Project</button>
    //         </div>
    //       </div>
    //     ],
    //     id: -1,
    //     name: "Settings",
    //   },
    // ];

    // const defaultSelectionsElements = defaultSelections.map((selection) => {return selection.element;});
    // const finalSelections = defaultSelectionsElements.concat(selectMenus);

    // let editingMenu = [<div key="loading">Loading</div>];
    // let editorName = "Loading";

    // if(selectedTab >= 0) {
    //   editingMenu = editorPane;
    //   editorName = "Code editor - " + selections[selectedTab];
    // } else {
    //   //Find the element in defaultSelections with the id of selectedTab
    //   let selectionElement = defaultSelections.filter(x => x.id === selectedTab)[0];
    //   editingMenu = selectionElement.menu;
    //   editorName = selectionElement.name;
    // }
    
    let editorTabs = state.context.editorTabs;
    let editorTab = state.context.tab;

    let editorName = "Loading";

    let editingMenu = [];

    ipc.once('popoutClose', (event, args) => {
        editorTabs[args].window = false;
        send('setTabs', { tabs: editorTabs });
    });

    const focusWindow = (window) => {
      ipc.send('editorFocusWindow', window);
    }

    const popOut = () => {
      ipc.send('editorPopOut', {file: path.join(projects[id].directory, editorTabs[editorTab].name), index: editorTab});
    }
    
    ipc.once('editorPopoutReply', (event, args) => {
      // Select the first tab that isn't popped out.
      editorTabs[args.index].window = args.window;
      for(let i = 0; i < editorTabs.length; i++) {
        if(editorTabs[i].window === null) {
          continue;
        } else {
          selectTab(i);
          return;
        }
      }
      send("setTabs", editorTabs);
    });

    const InjectJS = () => {
      ipc.send('getAppPath');
    }

    ipc.once('getAppPathReply', (event, args) => {
        var iFrameHead = window.frames["editorFrame"].document.getElementsByTagName("head")[0];
        var myscript = document.createElement('script');
        myscript.type = 'text/javascript';
        myscript.src = path.join(args, '/pages/editorLayoutInjectScript.js');
        iFrameHead.appendChild(myscript);
    });

    const deleteProjectConfirm = () => {
      var currentProjects = store.get('projects', []);
      ipc.send('deleteProject', {directory: currentProjects[id].directory});
      currentProjects.splice(id, 1);
      store.set('projects', currentProjects);
    }

    ipc.once('deleteProjectReply', (event, args) => {
      if(args === true) {
        navigate('/');
      } else {
        navigate('/Error', {state: {error: "Error deleting project!", errorMessage: args}});
      }
    });

    const selectTab = (tab) => {
      send('switchTab', {tab: tab});
      if(tab >= 0) {
        ipc.send('getFile', {file: path.join(projects[id].directory, editorTabs[tab].name)});
      }
    }

    if (editorTab === -1) {
      const isDeleting = state.matches("editor.settings.deleteOpen");

      const deleteMenu = isDeleting ? 
        <div className={styles.confirmDelete}>
          <div className={styles.confirmDeleteContainer}>
            <div className={styles.confirmDeleteText}>Are you sure you want to delete this project? This action is irreversible.</div>
            <div className={styles.confirmDeleteButtons}>
              <button className={`${styles.confirmDeleteButton} ${styles.confirmDeleteButtonCancel}`} onClick={() => send("closeDelete")}>Cancel</button>
              <button className={styles.confirmDeleteButton} onClick={() => deleteProjectConfirm()}>Delete</button>
            </div>
          </div>
        </div> : <></>;

      editingMenu = [
        <div key="settings" className={styles.settingsMenu}>
          <div className={styles.settingsMenuSeparator}>Misc</div>
          <div className={styles.settingsMenuSection}>
            Some sort of settings menu idk
          </div>
          <div className={`${styles.settingsMenuSeparator} ${styles.settingMenuDanger}`}>DANGER ZONE</div>
          <div className={styles.settingsMenuSection}>
            <button className={styles.deleteProjectButton} onClick={() => { send("openDelete") }}>Delete Project</button>
          </div>
          {deleteMenu}
        </div>
      ];
      editorName = "Settings";
    } else if (editorTab === -2) {
      editingMenu = [
        <div key="layout" className={styles.layoutEditor}> 
          <div className={styles.layoutEditorPage}>
            <iframe src={`file://${projects[id].directory}/index.html`} className={styles.projectIFrame} name="editorFrame" id="editorFrame" onLoad={() => InjectJS()}></iframe>
          </div>
        </div>
      ];
      editorName = "Layout editor";
    } else {
      editingMenu = [];
      if(editorTabs[editorTab] !== undefined) {
        editorName = "Code editor - " + editorTabs[editorTab].name;
      }
    }

    const settingsSelected = (editorTab === -1 ? styles.selectedSelection : "");
    const layoutEditorSelected = (editorTab === -2 ? styles.selectedSelection : "");

    let selectionPane = [
      <div key="settings" className={styles.editorSelection + " " + settingsSelected} onClick={() => selectTab(-1)}>
        <i className={"fas fa-gear " + styles.editorSelectionIcon}></i>
        Settings
      </div>,
      <div key="layout" className={styles.editorSelection + " " + layoutEditorSelected} onClick={() => selectTab(-2)}>
        <i className={"fas fa-table " + styles.editorSelectionIcon}></i>
        Layout editor
      </div>
    ];

    for(let i = 0; i < editorTabs.length; i++) {
      let selected = (i === editorTab ? styles.selectedSelection : "");
      
      let icon = null;
      let clickFunction = null;

      if(editorTabs[i].window !== false) {
        icon = <i className={"fas fa-arrow-up-right-from-square " + styles.editorSelectionIcon}></i>;
        clickFunction = () => {
          focusWindow(editorTabs[i].window);
        }
      } else {
        icon = <i className={"fas fa-angle-right " + styles.editorSelectionIcon}></i>;
        clickFunction = () => {
          selectTab(i);
        };
      }

      selectionPane.push(
        <div key={i} className={styles.editorSelection + " " + selected} onClick={() => clickFunction()}>
          {icon}
          {editorTabs[i].name}
        </div>
      );
    }

    return (
        // Actual JSX of the dsahboard
        <div>
            <i className={"fa-solid fa-arrow-left " + styles.leaveIcon} onClick={() => navigate("/Dashboard")}></i>
            <span className={styles.projectName}>Editing "{projects[id].name}"</span>
            <div className={styles.editorContainer}>
              <div className={styles.editorOptions}>
                {/* <span className={styles.editorOptionsName}>{editorName}</span> */}
                <span className={styles.editorOptionsName}>{editorName}</span>
                {/* <i className={"fa-solid fa-arrow-up-right-from-square " + styles.editorOptionsIcon} onClick={() => {popOut()}}></i> */}
                <i className={"fa-solid fa-arrow-up-right-from-square " + styles.editorOptionsIcon} onClick={() => { popOut() }}></i>
              </div>
              { editingMenu }
              { editorPane /* Although this seems like a wierd way to do this, I can't find another way to fix some wierd monaco bugs */}
            </div>
            <div className={styles.paneSelector}>
              {/* {finalSelections} */}
              { selectionPane }
            </div>
            {/* {deleteProjectElement} */}
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}