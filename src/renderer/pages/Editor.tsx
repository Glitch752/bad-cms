// imports
import React, { useContext, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Editor.module.css';
import { createMachine, assign, interpret } from 'xstate';
import { useMachine } from '@xstate/react';

import CodeEditor from "react-monaco-editor";

import path from 'path';

import { store } from '../store';

import ContextMenuArea from './contextMenuArea';
import {
  MenuItem,
  MenuDivider,
  MenuHeader
} from '@szhsin/react-menu';

const ipc = require('electron').ipcRenderer;

// Editor code (js)
export default function Editor(props) {
    const navigate = useNavigate();
    const projects = store.get('projects', false);
    let { id } = useParams();

    const stateMachine = createMachine({
      id: "editor",
      context: {
        tab: 0,
        editorTabs: [],
        monaco: null,
        editor: null,
        image: null,
      },
      type: 'parallel',
      states: {
        editor: {
          initial: "loading",
          on: {
            addTabData: {
              target: "addingTab.false",
              actions: [
                (context: any, event: any) => {
                  ipc.send("addFile", {
                    directory: projects[id].directory,
                    file: event.tab.name
                  });
                },
                assign((context: any, event: any) => {
                  return {
                    editorTabs: [...context.editorTabs, event.tab],
                  }
                })
              ],
            },
            deleteTab: {
              actions: [
                (context: any, event: any) => {
                  ipc.send("deleteFile", {
                    directory: projects[id].directory,
                    file: event.tab.name
                  });
                },
                assign((context: any, event: any) => {
                  return {
                    editorTabs: context.editorTabs.filter((tab: any) => tab.name !== event.tab.name),
                    tab: 0,
                  }
                })
              ]
            }
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
        
                    actions: assign((context: any, event: { tab: any }) => {
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
                ]
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
                    },
                    elementsTab: {
                      target: ".elementsTab",
                    }
                  },
                  states: {
                    selectionTab: {},
                    creatorTab: {},
                    elementsTab: {}
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
        },
        addingTab: {
          initial: "false",
          on: {
            addTab: ".true",
            cancel: ".false"
          },
          states: {
            false: {},
            true: {}
          }
        }
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
        // language={editorLanguage}
        width="calc(100vw - var(--menu-width))"
        height="calc(100vh - var(--titlebar-height) - 25px)"
        defaultValue="Loading editor..."
        // value={editorCode}
        theme="vs-dark"
        className={styles.editor}
        // onChange={updateEditorChanges}
        onChange={setEditorUnsaved}
        editorDidMount={(editorElem, monacoElem) => {
          editorElem.layout();
          send("editorLoaded", { monaco: monacoElem, editor: editorElem });
          editor = editorElem;
          monaco = monacoElem;
        }}
      />
    ];

    const windowResize = () => {
      editor.layout();
    }

    useEffect(() => {
      window.addEventListener('resize', windowResize);
      return () => {
        window.removeEventListener('resize', windowResize);
      }
    }, []);

    ipc.eventNames().forEach((channel: string) => {
      ipc.removeAllListeners(channel);
    });
    
    ipc.once('getFilesReply', async (_event, args) => {
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

    const saveTab = (tab) => {
      // Send the save event to IPC
      ipc.send('writeFile', {
        file: path.join(projects[id].directory, editorTabs[tab].name),
        content: editor.getValue()
      });

      editorTabs[tab].unsaved = false;
      send("setTabs", {tabs: editorTabs});
    }

    const keyPressed = (e: any) => {
      if(editorTab >= 0) {
        // Check if CTRL + S is pressed
        if (e.ctrlKey && e.key === 's') {
          // Prevent default behavior
          e.preventDefault();
          
          saveTab(editorTab);
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

    ipc.once('fixTab', async (event, args) => {
      selectTab(0);
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

    const popOut = (tab) => {
      if(editorTab < 0) return;
      ipc.send('editorPopOut', {file: path.join(projects[id].directory, editorTabs[tab].name), index: tab, id: id});
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
      console.log(window.location.href);
      var iFrameHead = window.frames["editorFrame"].document.getElementsByTagName("head")[0];
      var myscript = document.createElement('script');
      myscript.type = 'text/javascript';
      myscript.src = path.join(args, '../renderer/pages/editorLayoutInjectScript.js');
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

    if (state.matches({ editor: { editor: "settings" } })) {
      const isDeleting = state.matches({ editor: { editor: { settings: "deleteOpen" } } });

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
    } else if (state.matches({ editor: { editor: "layout" } })) {
      editingMenu = [
        <div key="layout" className={styles.layoutEditor}> 
          <div className={styles.layoutEditorPage}>
            <iframe src={`file://${projects[id].directory}/index.html`} className={styles.projectIFrame} name="editorFrame" id="editorFrame" onLoad={() => InjectJS()}></iframe>
          </div>
        </div>
      ];
      editorName = "Layout editor";
      wideVersion = true;
    } else if (state.matches({ editor: { editor: "image" } })) {
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

    const tabsTabSelected = state.matches({ editor: { editor: { layout: "selectionTab" } } }) ? styles.selectedTabSelectorItem : "";
    const siteTabSelected = state.matches({ editor: { editor: { layout: "creatorTab" } } }) ? styles.selectedTabSelectorItem : "";
    const elementsTabSelected = state.matches({ editor: { editor: { layout: "elementsTab" } } }) ? styles.selectedTabSelectorItem : "";

    let tabSelector = editorTab === -2 ? 
      <div key="tabs" className={styles.tabSelector}>
        <div className={styles.tabSelectorItem + " " + tabsTabSelected} onClick={() => send("selectionTab")}>Tabs</div>
        <div className={styles.tabSelectorItem + " " + siteTabSelected} onClick={() => send("creatorTab")}>Site creator</div>
        <div className={styles.tabSelectorItem + " " + elementsTabSelected} onClick={() => send("elementsTab")}>Elements</div>
      </div>
    : null;

    const addFile = () => {
      send("addTab");
    }

    let selectionPane = [
      tabSelector,
      <div key="settings" className={styles.editorSelection + " " + settingsSelected} onClick={() => selectTab(-1)}>
        <i className={"fas fa-gear " + styles.editorSelectionIcon}></i>
        Settings
      </div>,
      <div key="layout" className={styles.editorSelection + " " + layoutEditorSelected} onClick={() => selectTab(-2)}>
        <i className={"fas fa-table " + styles.editorSelectionIcon}></i>
        Layout editor
      </div>,
      <div key="buttons" className={styles.editorSelectionTitle}>
        <div className={styles.editorSelectionTitleText}>Files</div>
        <div className={styles.editorSelectionTitleButtons}>
          <i className={styles.editorSelectionTitleButton + " fa-solid fa-file-circle-plus"} onClick={() => {
            addFile();
          }}></i>
          <i className={styles.editorSelectionTitleButton + " fa-solid fa-folder-plus"} onClick={() => {
            console.log("Not implemented");
          }}></i>
        </div>
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
        <ContextMenuArea key={i} menuItems={
          <>
            <MenuHeader>{editorTabs[i].name}</MenuHeader>
            <MenuItem onClick={e => {
              send("deleteTab", { tab: editorTabs[i] });
            }}>Delete file</MenuItem>
            <MenuItem disabled={true}>Rename file</MenuItem>
            <MenuItem disabled={!editorTabs[i].unsaved} onClick={e => {
              saveTab(i);
            }}>Save file</MenuItem>
            <MenuItem onClick={e => {
              ipc.send("openInExplorer", path.join(projects[id].directory, editorTabs[i].name));
            }}>Open in file explorer</MenuItem>
            <MenuDivider />
            <MenuItem disabled={editorTabs[i].window !== false} onClick={e => {
              popOut(i);
            }}>Open in popout window</MenuItem>
          </>
        }>
          <div className={styles.editorSelection + " " + selected} onClick={() => clickFunction()}>
            {icon}
            {editorTabs[i].name}
            {unsavedIcon}
            <div className={styles.editorSelectionHoverButtons}>
              <i className={styles.editorSelectionHoverButton + " fa-solid fa-trash-alt"} onClick={() => {
                send("deleteTab", { tab: editorTabs[i] });
              }}></i>
            </div>
          </div>
        </ContextMenuArea>
      );
    }

    if(state.matches({ addingTab: "true" })) {
      selectionPane.push(
        <div key="adding" className={styles.editorSelection}>
          <i className={"fas fa-plus " + styles.editorSelectionIcon}></i>
          <input type="text" placeholder="file name..." className={styles.editorSelectionInput} onBlur={(event) => {
            // Make sure the file name is valid
            let name = event.target.value;
            if(name.length === 0) {
              name = "new file";
            }

            if(name.indexOf(".") === -1) {
              name += ".txt";
            }

            if(!name.startsWith("\\")) {
              name = "\\" + name;
            }

            // Make sure the file doesn't already exist
            let fileExists = true;
            while(fileExists) {
              let tabNumber = 1;
              let hasNumber = false;
              fileExists = false;
              for(let i = 0; i < editorTabs.length; i++) {
                if(editorTabs[i].name === name) {
                  fileExists = true;
                  if(editorTabs[i].name.split("(")[1] !== undefined) {
                    tabNumber = parseInt(editorTabs[i].name.split("(")[1].split(")")[0]) + 1;
                    hasNumber = true;
                  }
                }
              }

              if(fileExists) {
                if(hasNumber) {
                  name = name.split("(")[0] + name.split(")")[1];
                }
                name = name.split(".")[0] + `(${tabNumber}).` + name.split(".")[1];
              }
            }

            // Create the file
            let newTab = {
              name: name,
              window: false,
              unsaved: false
            };

            send("addTabData", { tab: newTab });
          }}></input>
        </div>
      );
    }

    // selectionPane = !state.matches({ editor: { editor: { layout: "creatorTab" } } }) ? selectionPane : [
    //   tabSelector,
    //   <Creator key="creator" project={projects[id]} />
    // ];
    if(state.matches({ editor: { editor: { layout: "creatorTab" } } })) {
      selectionPane = [
        tabSelector,
        <Creator key="creator" project={projects[id]} />
      ]
    } else if(state.matches({ editor: { editor: { layout: "elementsTab" } } })) {
      selectionPane = [
        tabSelector,
        <Elements key="elements" />
      ]
    }
    
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
                <i className={"fa-solid fa-arrow-up-right-from-square " + styles.editorOptionsIcon} onClick={() => { popOut(editorTab) }}></i>
              </div>
              { editingMenu }
              { editorPane /* Although this seems like a weird way to do this, I can't find another way to fix some weird monaco bugs */}
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
        actions: assign((_context, event: { editorContent: any }) => {
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
      ipc.send("getCssContent", {
        files: Array.from(cssFiles),
        projectPath: props.project.directory
      });
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

  ipc.eventNames().forEach((channel: string) => {
    ipc.removeAllListeners(channel);
  });

  ipc.on("getCssContentReply", (_event, arg) => {
    let oldStyles = state.context.editorContent[1].styles;
    let newStyles = arg;

    let newStyleText = [];

    let foundIndex = null;
    let endIndex = null;

    // Loop through all of the old styles, and find the line they are on in the new styles.
    for(let i = 0; i < oldStyles.length; i++) {
      let oldStyle = oldStyles[i];
      let newStyle = newStyles.find(style => style.file === oldStyle.cssFile);

      if(newStyle.file === "HTML") {
        newStyle = newStyles.find(style => style.file === "HTML");
        let newPath = path.join(props.project.directory, "index.html");
        oldStyles[i].cssFile = newPath;
      } else if(newStyle.file === "Unknown") {
        newStyleText.push(oldStyle.cssText);
        continue;
      }

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
      if(style.cssFile !== "Unknown" && style.cssFile !== "HTML") {
        style.shortCssFile = style.cssFile.substring(props.project.directory.length);
      } else {
        style.shortCssFile = style.cssFile;
      }
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

  const InjectJS = () => {
    ipc.send('getAppPath2');
  }

  ipc.once('getAppPathReply2', (_event, args) => {
    var iFrameHead = window.frames["editorFrame"].document.getElementsByTagName("head")[0];
    var myscript = document.createElement('script');
    myscript.type = 'text/javascript';
    myscript.src = path.join(args, '/pages/editorLayoutInjectScript.js');
    iFrameHead.appendChild(myscript);
  });

  const sendRefreshPage = () => {
    // Reload the page
    window.frames["editorFrame"].location.reload();
    // Inject the script
    InjectJS();
  }

  ipc.on("modifyCssReply", (_event, arg) => {
    if(arg) {
      debounce(sendRefreshPage, 200);
    } else {
      debounce(sendRefreshCss, 200);
    }
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
        let oldCssFile = "";
        creatorElement.push(
          <div key={i} className={styles.creatorElementSection}>
            <div className={styles.creatorElementSectionName}>Styles</div>
            {
              element.styles.map((style, index) => {
                let oldOldCssFile = oldCssFile;
                oldCssFile = style.shortCssFile;
                return (
                  <div key={index} className={styles.creatorElementSectionArea}>
                    <div className={styles.creatorElementSectionSubtitle}>{oldOldCssFile === style.shortCssFile ? null : style.shortCssFile + ":"}</div>
                    { style.unsaved ? (
                      <i className={"fas fa-save " + styles.creatorElementSectionIcon} onClick={() => {
                        saveEditors();
                      }}></i>
                    ) : null }
                    <CodeEditor 
                      language="css" 
                      value={state.context.editorContent[1].styles[index].unsavedText || style.cssText} 
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
                      editorDidMount={(editor, _monaco) => {
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
                    />
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function Elements() {
  // This function gets all the elements from the iframe in the format of the element data and it's children
  const getElements = (element = window.frames["editorFrame"].document) => {
    // Get all children of the element
    let children = element.children;
    // Recursively call this function on all children
    return {
      element: element,
      children: [...children].map(child => getElements(child))
    }
  }

  const getElementTree = () => {
    return (
      <div className={styles.elementsContainer}>
        <Element element={getElements()} />
      </div>
    )
  }

  return (
    <>
      {getElementTree()}
    </>
  )
}

function Element(props) {
  const { element } = props;

  const getTagName = (element, openingTag) => {
    return element.tagName === undefined ? (openingTag ? "<!DOCTYPE html>" : "") : (openingTag ? <span>{"<"}{element.tagName.toLowerCase()}{getElementAttributes(element)}{">"}</span> : `</${element.tagName.toLowerCase()}>`);
  }
  const getElementAttributes = (element) => {
    // Get the attributes as an array of objects with the name and value
    let attributes = [...element.attributes].map(attribute => {
      return {
        name: attribute.name,
        value: attribute.value
      }
    });

    const result = attributes.map(attribute => {
      return (
        <span key={attribute.name} className={styles.elementAttribute}>
          <span> </span>
          <span className={styles.attributeKey}>{attribute.name}</span>
          <span>="<span className={styles.attributeValue}>{attribute.value}</span>"</span>
        </span>
      )
    });

    return result.length > 0 ? <span className={styles.elementAttributes}>{result}</span> : null;
  }

  return (
    <>
      <div className={styles.element}>
        {
          element.children.length > 0 ? (
            <>
              <span className={styles.elementName}>{getTagName(element.element, true)}</span>
              <div className={(element.element.tagName === undefined ? "" : styles.elementChildren)}>
                {element.children.map((child, index) => {
                  return (
                    <Element key={index} element={child} />
                  )
                })}
              </div>
              <span className={styles.elementClosingTag}>{getTagName(element.element, false)}</span>
            </>
          ) : (
            <>
              <span className={styles.elementName}>{getTagName(element.element, true)}</span>
              <span className={styles.elementText}>{element.element.textContent}</span>
              <span className={styles.elementClosingTag}>{getTagName(element.element, false)}</span>
            </>
          )
        }
      </div>
    </>
  )
}