// imports
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './Editor.module.css';
import { createMachine, assign, interpret } from 'xstate';
import { useMachine } from '@xstate/react';

import CodeEditor from 'react-monaco-editor';

import path from 'path';

import { store } from '../store';

import PaneSelector from '../components/PaneSelector';

const ipc = require('electron').ipcRenderer;

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`), thislocalization = localization.editorPage;

// FIXME: I don't know what, but something about loading into the editor ruins the ipc events of the menu bar.
// This means the maximize button doesn't change to a restore button and vice versa.

// Editor code (js)
export default function Editor(props) {
  const navigate = useNavigate();
  const projects = store.get('projects', false);
  let { id } = useParams();

  const stateMachine = createMachine({
    id: 'editor',
    context: {
      tab: 0,
      renamingTab: false,
      renamingFolder: false,
      selectedFolder: false,
      editorTabs: [],
      editorFolders: [],
      monaco: null,
      editor: null,
      image: null,
    },
    type: 'parallel',
    states: {
      editor: {
        initial: 'loading',
        on: {
          addTabData: {
            target: 'addingTab.false',
            actions: [
              (context: any, event: any) => {
                ipc.send('addFile', {
                  directory: projects[id].directory,
                  path: event.tab.path,
                });
              },
            ],
          },
          stopAddingTab: {
            target: 'addingTab.false',
          },
          addFolderData: {
            target: 'addingFolder.false',
            actions: [
              (context: any, event: any) => {
                ipc.send('addFolder', {
                  directory: projects[id].directory,
                  path: event.folder.path,
                });
              },
            ],
          },
          stopAddingFolder: {
            target: 'addingFolder.false',
          },
          deleteTab: {
            actions: [
              (context: any, event: any) => {
                ipc.send('deleteFile', {
                  file: event.tab.path,
                  directory: projects[id].directory,
                });
              },
            ],
          },
          setRenameTab: {
            actions: [
              assign((context: any, event: any) => {
                return {
                  renamingTab: event.tab,
                };
              }),
            ]
          },
          stopRanamingTab: {
            actions: [
              assign((context: any, event: any) => {
                return {
                  renamingTab: false,
                };
              }),
            ]
          },
          renameTab: {
            actions: [
              (context: any, event: any) => {
                ipc.send('renameFile', {
                  path: event.path,
                  name: event.name,
                  directory: projects[id].directory,
                });
              },
              assign((context: any, event: any) => {
                return {
                  renamingTab: false,
                };
              }),
            ],
          },
          setRenameFolder: {
            actions: [
              assign((context: any, event: any) => {
                return {
                  renamingFolder: event.folder,
                };
              }),
            ]
          },
          stopRanamingFolder: {
            actions: [
              assign((context: any, event: any) => {
                return {
                  renamingFolder: false,
                };
              }),
            ]
          },
          renameFolder: {
            actions: [
              (context: any, event: any) => {
                ipc.send('renameFolder', {
                  path: event.path,
                  name: event.name,
                  directory: projects[id].directory,
                });
              },
              assign((context: any, event: any) => {
                return {
                  renamingFolder: false,
                };
              }),
            ],
          },
          setSelectedFolder: {
            actions: [
              assign((context: any, event: any) => {
                return {
                  selectedFolder: event.folder,
                };
              }),
            ]
          },
          deleteFolder: {
            actions: [
              (context: any, event: any) => {
                ipc.send('deleteFolder', {
                  folder: event.folder,
                  directory: projects[id].directory,
                });
              },
            ],
          },
        },
        states: {
          loading: {
            on: {
              editorLoaded: {
                target: 'editor',
                actions: [
                  () => {
                    ipc.send('getFiles', { directory: projects[id].directory });
                  },
                  assign((context, event: { monaco: any; editor: any }) => {
                    return {
                      monaco: event.monaco,
                      editor: event.editor,
                    };
                  }),
                ],
              },
            },
          },
          editor: {
            initial: 'loading',
            on: {
              setTabs: {
                actions: assign((context, event: { tabs: any, folders: any }) => {
                  return {
                    editorTabs: event.tabs,
                    editorFolders: event.folders,
                  };
                }),
              },
              setImage: {
                target: '.image',
                actions: assign((context, event: { image: any }) => {
                  return {
                    image: event.image,
                  };
                }),
              },
              switchTab: [
                {
                  target: '.code',
                  cond: (context, event) => event.tab >= 0,

                  actions: assign((context: any, event: { tab: any }) => {
                    return {
                      tab: event.tab,
                    };
                  }),
                },
                {
                  target: '.layout',
                  cond: (context, event) => event.tab === -2,

                  actions: assign((context, event: { tab: any }) => {
                    return {
                      tab: event.tab,
                    };
                  }),
                },
                {
                  target: '.settings',

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
                  finishedLoading: 'code',
                },
              },
              code: {},
              layout: {
                initial: 'selectionTab',
                on: {
                  selectionTab: {
                    target: '.selectionTab',
                  },
                  creatorTab: {
                    target: '.creatorTab',
                  },
                  elementsTab: {
                    target: '.elementsTab',
                  },
                  JSNodesTab: {
                    target: '.JSNodesTab',
                  }
                },
                states: {
                  selectionTab: {},
                  creatorTab: {},
                  elementsTab: {},
                  JSNodesTab: {},
                },
              },
              image: {},
              settings: {
                initial: 'deleteClosed',
                on: {
                  openDelete: '.deleteOpen',
                  closeDelete: '.deleteClosed',
                },
                states: {
                  deleteClosed: {
                    on: {
                      openDelete: 'deleteOpen',
                    },
                  },
                  deleteOpen: {
                    on: {
                      closeDelete: 'deleteClosed',
                    },
                  },
                },
              },
            },
          },
        },
      },
      addingTab: {
        initial: 'false',
        on: {
          addTab: '.true',
          cancel: '.false',
        },
        states: {
          false: {},
          true: {},
        },
      },
      addingFolder: {
        initial: 'false',
        on: {
          addFolder: '.true',
          cancel: '.false',
        },
        states: {
          false: {},
          true: {},
        },
      }
    },
  });

  const [state, send, service] = useMachine(stateMachine);

  let editor = state.context.editor;
  let monaco = state.context.monaco;

  let programaticChangesMade = false;

  const setEditorUnsaved = () => {
    if (programaticChangesMade) {
      programaticChangesMade = false;
      return;
    }

    if (editorTabs[editorTab].unsaved === false) {
      editorTabs[editorTab].unsaved = true;
      send('setTabs', { tabs: editorTabs, folders: editorFolders });
    }
  };

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
        send('editorLoaded', { monaco: monacoElem, editor: editorElem });
        editor = editorElem;
        monaco = monacoElem;
      }}
    />,
  ];

  const windowResize = () => {
    editor.layout();
  };

  useEffect(() => {
    window.addEventListener('resize', windowResize);
    return () => {
      window.removeEventListener('resize', windowResize);
    };
  }, []);

  ipc.eventNames().forEach((channel: string) => {
    ipc.removeAllListeners(channel);
  });

  // TODO: redo this system to be more efficient and readable
  const getFileStructure = (files, depth = 0, prevIndex = 0) => {
    var loadingSelections = [];
    let loadingFolders = [];

    for (let i = 0; i < files.length; i++) {
      if (files[i].isFile) {
        loadingSelections.splice(prevIndex, 0, ({
          name: files[i].name,
          window: false,
          unsaved: false,
          path: files[i].path,
          indent: depth,
        }));
        prevIndex += 1;
      } else {
        loadingFolders.push({
          name: files[i].name,
          path: files[i].path,
          index: prevIndex,
          indent: depth,
        });
        prevIndex += 1;
        let newLoading = getFileStructure(files[i].children, depth + 1, prevIndex);
        prevIndex = newLoading.prevIndex;

        let newLoadingSelections = newLoading.loadingSelections;
        let newLoadingFolders = newLoading.loadingFolders;

        loadingSelections = loadingSelections.concat(newLoadingSelections);
        loadingFolders = loadingFolders.concat(newLoadingFolders);
      }
    }

    return { loadingSelections, loadingFolders, prevIndex };
  }

  ipc.once('getFilesReply', async (event, args) => {
    const { loadingSelections, loadingFolders } = getFileStructure(args.files);

    // Set text in the editor to Loading file...
    while (editor === null) {
      // Wait for the editor to be loaded
      await sleep(50);
    }
    send('setTabs', { tabs: loadingSelections, folders: loadingFolders });
    if (state.can('finishedLoading')) send('finishedLoading');
    let files = args.files.filter((file) => file.isFile);
    ipc.send('getFile', { file: files[0].path });
  });

  let editorTabs = state.context.editorTabs;
  let editorFolders = state.context.editorFolders;

  let editorTab = state.context.tab;

  let editorName = 'Loading';

  let editingMenu = [];

  let wideVersion = false;

  const saveTab = (tab) => {
    // Send the save event to IPC
    ipc.send('writeFile', {
      file: editorTabs[tab].path,
      content: editor.getValue(),
    });

    editorTabs[tab].unsaved = false;
    send('setTabs', { tabs: editorTabs, folders: editorFolders });
  };

  const keyPressed = (e: any) => {
    if (editorTab >= 0) {
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
    if (args.isImage) {
      send('setImage', { image: args.file });
    } else {
      while (editor === null) {
        // Wait for the editor to be loaded
        await sleep(50);
      }
      let language = null;
      if (args.fileName !== undefined) {
        var extToLang = {
          // List of compatible files with Monaco language support
          '.html': 'html',
          '.css': 'css',
          '.js': 'javascript',
          '.svg': 'html',
        };

        language = extToLang[path.extname(args.fileName)];
        language = language === undefined ? 'plaintext' : language;

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
    send('switchTab', { tab: tab });
    if (tab >= 0) {
      ipc.send('getFile', {
        file: editorTabs[tab].path,
      });
    }
  };

  ipc.once('popoutClose', (event, args) => {
    editorTabs[args].window = false;
    send('setTabs', { tabs: editorTabs, folders: editorFolders });
  });

  const popOut = (tab) => {
    if (editorTab < 0) return;
    ipc.send('editorPopOut', {
      file: editorTabs[tab].path,
      index: tab,
      id: id,
    });
  };

  ipc.once('editorPopoutReply', (event, args) => {
    // Select the first tab that isn't popped out.
    editorTabs[args.index].window = args.window;
    send('setTabs', { tabs: editorTabs, folders: editorFolders });
    for (let i = 0; i < editorTabs.length; i++) {
      if (editorTabs[i].window !== false) {
        continue;
      } else {
        selectTab(i);
        break;
      }
    }
  });

  const InjectJS = () => {
    ipc.send('getAppPath');
  };

  ipc.once('getAppPathReply', (event, args) => {
    var iFrameHead =
      window.frames['editorFrame'].document.getElementsByTagName('head')[0];
    var myscript = document.createElement('script');
    myscript.type = 'text/javascript';
    if(process.env.NODE_ENV === "development") {
      myscript.src = path.join(
        args,
        '../renderer/editorLayoutInjectScript.js'
      );
    } else {
      myscript.src = path.join(
        args,
        './dist/renderer/editorLayoutInjectScript.js'
      );
    }
    iFrameHead.appendChild(myscript);
  });

  const deleteProjectConfirm = () => {
    var currentProjects: any = store.get('projects', []);
    ipc.send('deleteProject', { directory: currentProjects[id].directory });
    currentProjects.splice(id, 1);
    store.set('projects', currentProjects);
  };

  ipc.once('deleteProjectReply', (event, args) => {
    if (args === true) {
      navigate('/');
    } else {
      navigate('/Error', {
        state: { error: thislocalization.errorDeleting, errorMessage: args },
      });
    }
  });

  if(editorTabs[editorTab] === undefined) {
    editorTab = 0;
  }

  if (state.matches({ editor: { editor: 'settings' } })) {
    const isDeleting = state.matches({
      editor: { editor: { settings: 'deleteOpen' } },
    });

    const deleteMenu = isDeleting ? (
      <div className={styles.confirmDelete}>
        <div className={styles.confirmDeleteContainer}>
          <div className={styles.confirmDeleteText}>{localization.confirmDelete}</div>
          <div className={styles.confirmDeleteButtons}>
            <button
              className={`${styles.confirmDeleteButton} ${styles.confirmDeleteButtonCancel}`}
              onClick={() => send('closeDelete')}
            >{localization.buttons.cancel}</button>
            <button
              className={styles.confirmDeleteButton}
              onClick={() => deleteProjectConfirm()}
            >{localization.buttons.delete}</button>
          </div>
        </div>
      </div>
    ) : (
      <></>
    );

    editingMenu = [
      <div key="settings" className={styles.settingsMenu}>
        <div className={styles.settingsMenuSeparator}>{thislocalization.settings.miscellaneous}</div>
        <div className={styles.settingsMenuSection}>
          Some sort of settings menu
        </div>
        <div
          className={`${styles.settingsMenuSeparator} ${styles.settingMenuDanger}`}
        >{thislocalization.settings.dangerZone}</div>
        <div className={styles.settingsMenuSection}>
          <button
            className={styles.deleteProjectButton}
            onClick={() => {
              send('openDelete');
            }}
          >{localization.deleteProject}</button>
        </div>
        {deleteMenu}
      </div>,
    ];
    editorName = 'Settings';
  } else if (state.matches({ editor: { editor: 'layout' } })) {
    editingMenu = [
      <div key="layout" className={styles.layoutEditor}>
        <div className={styles.layoutEditorPage}>
          <iframe
            src={`file://${projects[id].directory}/index.html`}
            className={styles.projectIFrame}
            name="editorFrame"
            id="editorFrame"
            onLoad={() => InjectJS()}
          ></iframe>
        </div>
      </div>,
    ];
    editorName = 'Layout editor';
    wideVersion = true;
  } else if (state.matches({ editor: { editor: 'image' } })) {
    editingMenu = [
      <div key="image" className={styles.imageEditor}>
        <img src={state.context.image} className={styles.imageEditorImage} />
      </div>,
    ];
    editorName = 'Image viewer: ' + editorTabs[editorTab].name;
  } else {
    editingMenu = [];
    if (editorTabs[editorTab] !== undefined) {
      editorName = 'Code editor: ' + editorTabs[editorTab].name;
    }
  }

  props.settitle([
    <span key="left" className="leftText">
      Bad CMS for Devs
    </span>,
    <span key="center" className="centerText">
      {editorName}
    </span>,
    <span key="right" className="rightText">
      {localization.editing} "{projects[id].name}"
    </span>,
  ]);

  return (
    // Actual JSX of the dsahboard
    <div className={wideVersion ? styles.widePane : ''}>
      <div className={styles.editorContainer}>
        <div className={styles.editorOptions}>
          <i
            className={'fa-solid fa-arrow-left ' + styles.leaveIcon}
            onClick={() => navigate('/Dashboard')}
          ></i>
          {/* <span className={styles.editorOptionsName}>{editorName}</span> */}
          {/* <i className={"fa-solid fa-arrow-up-right-from-square " + styles.editorOptionsIcon} onClick={() => {popOut()}}></i> */}
          <i
            className={
              'fa-solid fa-arrow-up-right-from-square ' +
              styles.editorOptionsIcon
            }
            onClick={() => {
              popOut(editorTab);
            }}
          ></i>
        </div>
        {editingMenu}
        {
          editorPane /* Although this seems like a weird way to do this, I can't find another way to fix some weird monaco bugs */
        }
      </div>
      <div className={styles.paneSelector}>
        {/* {finalSelections} */}
        <PaneSelector
          state={state}
          send={send}
          selectTab={selectTab}
          popOut={popOut}
          saveTab={saveTab}
        />
      </div>
      {/* {deleteProjectElement} */}
    </div>
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
