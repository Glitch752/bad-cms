// imports
import React, { useContext, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Editor.module.css';
import { createMachine, assign, interpret } from 'xstate';
import { useMachine } from '@xstate/react';

import CodeEditor, { loader } from "@monaco-editor/react";

import path from 'path';

import { store } from '../store';

const ipc = require('electron').ipcRenderer;

// Editor code (js)
export default function Editor(props) {
    const navigate = useNavigate();
    const projects = store.get('projects', false);
    let { id } = useParams();

    const stateMachine = createMachine({
      id: "editor",
      initial: "loading",
      context: {
        tab: 0,
        editorTabs: [],
        monaco: null,
        editor: null,
        image: null,
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
            setImage: {
              target: ".image",
              actions: assign((context, event: { image: any }) => {
                return {
                  image: event.image,
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
            layout: {
              initial: "selectionTab",
              on: {
                selectionTab: {
                  target: ".selectionTab",
                },
                creatorTab: {
                  target: ".creatorTab",
                }
              },
              states: {
                selectionTab: {},
                creatorTab: {}
              }
            },
            image: {},
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

    let programaticChangesMade = false;

    const setEditorUnsaved = () => {
      if(programaticChangesMade) {
        programaticChangesMade = false;
        return;
      }
      
      if(editorTabs[editorTab].unsaved === false) {
        editorTabs[editorTab].unsaved = true;
        send("setTabs", {tabs: editorTabs});
      }
    }
    
    var editorPane = [
      <CodeEditor
        key="editor"
        defaultLanguage="html"
        // language={editorLanguage}
        width="calc(100vw - var(--menu-width))"
        defaultValue="Loading editor..."
        // value={editorCode}
        theme="vs-dark"
        className={styles.editor}
        // onChange={updateEditorChanges}
        onChange={setEditorUnsaved}
        onMount={(editorElem, monacoElem) => {
          send("editorLoaded", { monaco: monacoElem, editor: editorElem });
        }}
      />
    ];

    // Remove all IPC listeners when the component is mounted again.
    ipc.removeAllListeners();
    
    ipc.once('getFilesReply', async (event, args) => {
      var loadingSelections = [];
      for(let i = 0; i < args.files.length; i++) {
        loadingSelections.push({
          name: args.files[i],
          window: false,
          unsaved: false
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
    
    let editorTabs = state.context.editorTabs;
    let editorTab = state.context.tab;

    let editorName = "Loading";

    let editingMenu = [];

    let wideVersion = false;

    const keyPressed = (e: any) => {
      if(editorTab >= 0) {
        // Check if CTRL + S is pressed
        if (e.ctrlKey && e.key === 's') {
          // Prevent default behavior
          e.preventDefault();
          // Send the save event to IPC
          ipc.send('writeFile', {
            file: path.join(projects[id].directory, editorTabs[editorTab].name),
            content: editor.getValue()
          });
  
          editorTabs[editorTab].unsaved = false;
          send("setTabs", {tabs: editorTabs});
        }
      }
    };

    useEffect(() => {
      // Add event listener for keys pressed
      document.addEventListener('keydown', keyPressed);

      // Remove event listener when the component is unmounted
      return () => {
        document.removeEventListener('keydown', keyPressed);
      };
    });

    ipc.once('getFileReply', async (event, args) => {
      if(args.isImage) {
        send("setImage", { image: args.file });
      } else {
        while(editor === null) {
          // Wait for the editor to be loaded
          await sleep(50);
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
        programaticChangesMade = true;
        editor.setValue(args.content);
      }
    });

    const selectTab = (tab) => {
      send('switchTab', {tab: tab});
      if(tab >= 0) {
        ipc.send('getFile', {file: path.join(projects[id].directory, editorTabs[tab].name)});
      }
    }

    ipc.once('popoutClose', (event, args) => {
        editorTabs[args].window = false;
        send('setTabs', { tabs: editorTabs });
    });

    const focusWindow = (window) => {
      ipc.send('editorFocusWindow', window);
    }

    const popOut = () => {
      if(editorTab < 0) return;
      ipc.send('editorPopOut', {file: path.join(projects[id].directory, editorTabs[editorTab].name), index: editorTab});
    }
    
    ipc.once('editorPopoutReply', (event, args) => {
      // Select the first tab that isn't popped out.
      editorTabs[args.index].window = args.window;
      send("setTabs", { tabs: editorTabs });
      for(let i = 0; i < editorTabs.length; i++) {
        if(editorTabs[i].window !== false) {
          continue;
        } else {
          selectTab(i);
          break;
        }
      }
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
      var currentProjects: any = store.get('projects', []);
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

    if (state.matches("editor.settings")) {
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
    } else if (state.matches("editor.layout")) {
      editingMenu = [
        <div key="layout" className={styles.layoutEditor}> 
          <div className={styles.layoutEditorPage}>
            <iframe src={`file://${projects[id].directory}/index.html`} className={styles.projectIFrame} name="editorFrame" id="editorFrame" onLoad={() => InjectJS()}></iframe>
          </div>
        </div>
      ];
      editorName = "Layout editor";
      wideVersion = true;
    } else if (state.matches("editor.image")) {
      editingMenu = [
        <div key="image" className={styles.imageEditor}>
          <img src={state.context.image} className={styles.imageEditorImage} />
        </div>
      ];
      editorName = "Image viewer: " + editorTabs[editorTab].name;
    } else {
      editingMenu = [];
      if(editorTabs[editorTab] !== undefined) {
        editorName = "Code editor: " + editorTabs[editorTab].name;
      }
    }

    const settingsSelected = (editorTab === -1 ? styles.selectedSelection : "");
    const layoutEditorSelected = (editorTab === -2 ? styles.selectedSelection : "");

    const tabsTabSelected = state.matches("editor.layout.selectionTab") ? styles.selectedTabSelectorItem : "";
    const siteTabSelected = state.matches("editor.layout.creatorTab") ? styles.selectedTabSelectorItem : "";

    let tabSelector = editorTab === -2 ? 
      <div key="tabs" className={styles.tabSelector}>
        <div className={styles.tabSelectorItem + " " + tabsTabSelected} onClick={() => send("selectionTab")}>Tabs</div>
        <div className={styles.tabSelectorItem + " " + siteTabSelected} onClick={() => send("creatorTab")}>Site creator</div>
      </div>
    : null;

    let selectionPane = [
      tabSelector,
      <div key="settings" className={styles.editorSelection + " " + settingsSelected} onClick={() => selectTab(-1)}>
        <i className={"fas fa-gear " + styles.editorSelectionIcon}></i>
        Settings
      </div>,
      <div key="layout" className={styles.editorSelection + " " + layoutEditorSelected} onClick={() => selectTab(-2)}>
        <i className={"fas fa-table " + styles.editorSelectionIcon}></i>
        Layout editor
      </div>
    ];

    // Make selection pane expand and have tabs for pane and layout

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
      
      let unsavedIcon = null;

      if(editorTabs[i].unsaved) {
        unsavedIcon = <i className={"fas fa-circle " + styles.unsavedIcon}></i>;
      }

      selectionPane.push(
        <div key={i} className={styles.editorSelection + " " + selected} onClick={() => clickFunction()}>
          {icon}
          {editorTabs[i].name}
          {unsavedIcon}
        </div>
      );
    }

    selectionPane = !state.matches("editor.layout.creatorTab") ? selectionPane : [
      tabSelector,
      <Creator key="creator" />
    ];
    
    props.settitle([
      <span key="left" className="leftText">Bad CMS for Devs</span>,
      <span key="center" className="centerText">{editorName}</span>,
      <span key="right" className="rightText">Editing "{projects[id].name}"</span>
    ]);

    return (
        // Actual JSX of the dsahboard
        <div className={wideVersion ? styles.widePane : ''}>
            <div className={styles.editorContainer}>
              <div className={styles.editorOptions}>
                <i className={"fa-solid fa-arrow-left " + styles.leaveIcon} onClick={() => navigate("/Dashboard")}></i>
                {/* <span className={styles.editorOptionsName}>{editorName}</span> */}
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

function Creator(props) {
  let creatorMachine = createMachine({
    id: "creator",
    initial: "idle",
    context: {
      editorContent: null,
    },
    on: {
      "click": {
        target: ".editing",
        actions: assign((context, event: { editorContent: any }) => {
          return {
            editorContent: event.editorContent
          };
        })
      }
    },
    states: {
      idle: {},
      editing: {}
    }
  });

  const [state, send, service] = useMachine(creatorMachine);

  const iFrameMessage = (event) => {
    let parsedData;
    try {
      parsedData = JSON.parse(event.data);
    } catch(e) {
      return;
    }

    if(parsedData.type === "clickedElement") {
      // Find all the unique files that the css rules come from.
      // The file is on the cssFile property.
      let cssFiles = new Set();
      for(let i = 0; i < parsedData.styles.length; i++) {
        let style = parsedData.styles[i];
        if(style.cssFile !== undefined) {
          if(style.cssFile.startsWith("file:///")) {
            style.cssFile = style.cssFile.substring(8);
          }
          cssFiles.add(style.cssFile);
        }
      }
      ipc.send("getCssContent", Array.from(cssFiles));
      send("click", {
        editorContent: [
          {
            type: "classList",
            classList: parsedData.classList,
            addingNewClass: false
          },
          {
            type: "stylesPlaceholder",
            styles: parsedData.styles
          }
        ]
      });
    } else if(parsedData.type === "siteHTML") {
      let url = parsedData.currentPage;
      if(url.startsWith("file:///")) {
        url = url.substring(8);
      }

      ipc.send("writeFile", {
        file: url,
        content: parsedData.html
      });
    }
  }

  ipc.removeAllListeners();

  ipc.on("getCssContentReply", (event, arg) => {
    let oldStyles = state.context.editorContent[1].styles;
    let newStyles = arg;

    let newStyleText = [];

    let foundIndex = null;
    let endIndex = null;

    // Loop through all of the old styles, and find the line they are on in the new styles.
    for(let i = 0; i < oldStyles.length; i++) {
      let oldStyle = oldStyles[i];
      let newStyle = newStyles.find(style => style.file === oldStyle.cssFile);

      let oldStyleText = oldStyle.cssText;

      let addLines = [];

      const newStyleLinesTrimmed = newStyle.content.split("\n").map(line => line.trim());
      const newStyleLines = newStyle.content.split("\n");

      for(let j = 0; j < oldStyleText.length; j++) {
        let newFoundIndex = newStyleLinesTrimmed.indexOf(oldStyleText.substring(0, j));
        if(newFoundIndex !== -1) {
          foundIndex = newFoundIndex;
        }
      }

      // Find the end of the CSS rule starting at the found index.
      for(let j = foundIndex; j < newStyleLines.length; j++) {
        addLines.push(newStyleLines[j]);
        if(newStyleLines[j].trim() === "}") {
          endIndex = j;
          break;
        }
      }

      newStyleText.push(addLines.join("\n"));
    }

    let newStyleAttr = oldStyles.map(style => {
      style.cssText = newStyleText.shift();
      style.startIndex = foundIndex;
      style.endIndex = endIndex;
      style.unsaved = false;
      style.unsavedText = "";
      return style;
    });

    send("click", {
      editorContent: [
        {
          type: "classList",
          classList: state.context.editorContent[0].classList,
          addingNewClass: false
        },
        {
          type: "styles",
          styles: newStyleAttr
        }
      ]
    })
  });

  React.useEffect(() => {
    window.addEventListener('message', iFrameMessage);

    return () => {
      window.removeEventListener('message', iFrameMessage);
    }
  }, []);

  const removeClass = (className) => {
    window.frames["editorFrame"].postMessage(JSON.stringify({
      type: "removeClass",
      className: className
    }), "*");
  };

  const addNewClass = () => {
    if(state.context.editorContent.addingNewClass) return;
    let editorContent = state.context.editorContent;
    editorContent[0].addingNewClass = true;
    send("click", {
      editorContent
    });
  };

  const addedClass = (className) => {
    className = className.trim();
    className = className.replace(/\s/g, "-");
    let classList = state.context.editorContent.find(e => e.type === "classList").classList;
    classList.push(className);
    let editorContent = state.context.editorContent;
    editorContent[0].addingNewClass = false;
    editorContent[0].classList = classList;
    send("click", {
      editorContent
    });
    window.frames["editorFrame"].postMessage(JSON.stringify({
      type: "addClass",
      className: className
    }), "*");
  }

  useEffect(() => {
    // Add event listener for keys pressed
    document.addEventListener('keydown', keyPressed);

    // Remove event listener when the component is unmounted
    return () => {
      document.removeEventListener('keydown', keyPressed);
    };
  });

  const keyPressed = (event) => {
    if(event.ctrlKey && event.key === "s") {
      saveEditors();
      event.preventDefault();
    }
  }

  const saveEditors = () => {
    const editors = state.context.editorContent[1].styles;

    let editorContent = state.context.editorContent;

    for(let i = 0; i < editors.length; i++) {
      if(editors[i].unsaved) {
        editorContent[1].styles[i].unsaved = false;
        let file = editors[i].cssFile;
        if(file.startsWith("file:///")) {
          file = file.substring(8);
        }
        ipc.send("modifyCss", {
          file: file,
          startIndex: editors[i].startIndex,
          endIndex: editors[i].endIndex,
          content: editors[i].unsavedText
        })
      }
    }
    send("click", {
      editorContent
    });
  }

  let timerId;
  const debounce = function (func, delay) {
    clearTimeout(timerId);
    timerId  =  setTimeout(func, delay);
  }

  const sendRefreshCss = () => {
    window.frames["editorFrame"].postMessage(JSON.stringify({
      type: "reloadCss"
    }), "*");
  }

  ipc.on("modifyCssReply", (event, arg) => {
    debounce(sendRefreshCss, 200);
  });

  let creatorElement = [<div key="clickElement" className={styles.creatorElementSection}>Click on an element to change it.</div>];

  if(state.matches("editing")) {
    creatorElement = [];
    for(let i = 0; i < state.context.editorContent.length; i++) {
      let element = state.context.editorContent[i];
      if(element.type === "classList") {
        creatorElement.push(
          <div key={i} className={styles.creatorElementSection}>
            <div className={styles.creatorElementSectionName}>Class list</div>
            <i className={"fas fa-plus " + styles.creatorElementSectionIcon} onClick={() => {addNewClass();}}></i>
            <div className={styles.creatorElementSectionList}>
              {element.classList.map((className, index) => {
                return (
                  <div key={index} className={styles.creatorElementSectionListItem}>
                    <span className={styles.creatorElementSectionListItemName}>{className}</span>
                    <i className={"fas fa-times " + styles.creatorElementSectionListItemRemove} onClick={() => {
                      removeClass(className);
                      element.classList.splice(index, 1);
                      send("click", {
                        editorContent: state.context.editorContent
                      });
                    }}></i>
                  </div>
                );
              })}
              {element.addingNewClass ? (
                <div key="add" className={styles.creatorElementSectionListItem}>
                  <input className={styles.creatorElementSectionListItemName} type="text" placeholder="Class name" onBlur={(event) => {addedClass(event.target.value)}}></input>
                </div>
              ) : null}
            </div>
          </div>
        );
      } else if (element.type === "styles") {
        creatorElement.push(
          <div key={i} className={styles.creatorElementSection}>
            <div className={styles.creatorElementSectionName}>Styles</div>
            {
              element.styles.map((style, index) => {
                return (
                  <div key={index} className={styles.creatorElementSectionArea}>
                    <div className={styles.creatorElementSectionSubtitle}>{style.selectorText}:</div>
                    { style.unsaved ? (
                      <i className={"fas fa-save " + styles.creatorElementSectionIcon} onClick={() => {
                        saveEditors();
                      }}></i>
                    ) : null }
                    <CodeEditor 
                      language="css" 
                      value={style.cssText} 
                      className={styles.creatorElementCode} 
                      theme="vs-dark" 
                      onChange={(value) => {
                        let editorContent = state.context.editorContent;
                        editorContent[1].styles[index].unsaved = true;
                        editorContent[1].styles[index].unsavedText = value;

                        send("click", {
                          editorContent
                        });
                      }}
                      onMount={(editor, monaco) => {
                        const editorDefaultWidth = editor.getDomNode().parentElement.offsetWidth;

                        const updateHeight = () => {
                          const contentHeight = Math.min(1000, editor.getContentHeight());
                          editor.layout({ width: editorDefaultWidth, height: contentHeight });

                          const editorParent = editor.getDomNode().parentElement;

                          editorParent.style.height = contentHeight + "px";
                        };

                        editor.updateOptions({
                          scrollBeyondLastLine: false,
                          minimap: {
                            enabled: false
                          }
                        })

                        editor.onDidContentSizeChange(updateHeight);
                        updateHeight();
                      }}
                    ></CodeEditor>
                  </div>
                );
              })
            }
          </div>
        );
      }
    }
  }

  return (
    <div className={styles.creatorContainer}>
      {creatorElement}
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