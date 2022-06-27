import styles from '../pages/Editor.module.css';

import ContextMenuArea from '../components/contextMenuArea';
import {
  MenuItem,
  MenuDivider,
  MenuHeader
} from '@szhsin/react-menu';

import Creator from './creator';
import Elements from './elements';
import JSNodes from './JSNodes';

import { store } from 'renderer/store';
import { useParams } from 'react-router-dom';
import path from 'path';
import { useRef } from 'react';

const ipc = require('electron').ipcRenderer;

function PaneSelector(props) {
    // TODO: refactor so more of the relevant code is in the components

    let { state, send, selectTab, popOut, saveTab } = props;
    
    const focusWindow = (window) => {
        ipc.send('editorFocusWindow', window);
    }
    
    const projects = store.get('projects', false);
    let { id } = useParams();

    let editorTabs = state.context.editorTabs;
    let editorFolders = state.context.editorFolders;

    let editorTab = state.context.tab;

    const settingsSelected = (editorTab === -1 ? styles.selectedSelection : "");
    const layoutEditorSelected = (editorTab === -2 ? styles.selectedSelection : "");

    const tabsTabSelected = state.matches({ editor: { editor: { layout: "selectionTab" } } }) ? styles.selectedTabSelectorItem : "";
    const siteTabSelected = state.matches({ editor: { editor: { layout: "creatorTab" } } }) ? styles.selectedTabSelectorItem : "";
    const elementsTabSelected = state.matches({ editor: { editor: { layout: "elementsTab" } } }) ? styles.selectedTabSelectorItem : "";
    const JSNodesTabSelected = state.matches({ editor: { editor: { layout: "JSNodesTab" } } }) ? styles.selectedTabSelectorItem : "";

    let tabSelector = editorTab === -2 ? 
      <div key="tabs" className={styles.tabSelector}>
        <div className={styles.tabSelectorItem + " " + tabsTabSelected} onClick={() => send("selectionTab")}>Tabs</div>
        <div className={styles.tabSelectorItem + " " + siteTabSelected} onClick={() => send("creatorTab")}>Site creator</div>
        <div className={styles.tabSelectorItem + " " + elementsTabSelected} onClick={() => send("elementsTab")}>Elements</div>
        <div className={styles.tabSelectorItem + " " + JSNodesTabSelected} onClick={() => send("JSNodesTab")}>Javascript nodes</div>
      </div>
    : null;

    const addFile = () => {
      send("addTab");
      if(state.matches({ addingFolder: true })) {
        send("stopAddingFolder");
      }
    }

    const addFolder = () => {
      send("addFolder");
      if(state.matches({ addingTab: true })) {
        send("stopAddingTab");
      }
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
            addFolder();
          }}></i>
          <i className="fa-solid fa-arrow-rotate-right" onClick={() => {
            ipc.send("getFiles", { directory: projects[id].directory });
          }}></i>
        </div>
      </div>
    ];

    let selectionStartIndex = selectionPane.length;

    // Make selection pane expand and have tabs for pane and layout

    let renameFileWarning = useRef(null);

    for(let i = 0; i < editorTabs.length; i++) {
      let selected = (i === editorTab ? styles.selectedSelection : "");
      
      let icon = null;
      let clickFunction = null;

      if(editorTabs[i].window !== false) {
        icon = <i className={"fas fa-arrow-up-right-from-square " + styles.editorSelectionIcon}></i>;
        clickFunction = () => {
          send("setSelectedFolder", { folder: false });
          focusWindow(editorTabs[i].window);
        }
      } else {
        icon = <i className={"fas fa-angle-right " + styles.editorSelectionIcon}></i>;
        clickFunction = () => {
          send("setSelectedFolder", { folder: false });
          selectTab(i);
        };
      }
      
      let unsavedIcon = null;

      if(editorTabs[i].unsaved) {
        unsavedIcon = <i className={"fas fa-circle " + styles.unsavedIcon}></i>;
      }

      if(state.context.renamingTab === i) {
        selectionPane.push(
          // @ts-ignore
          <div key={i} className={styles.editorSelection + " " + selected} style={{"--indent": editorTabs[i].indent}}>
            {icon}
            <input type="text" className={styles.editorSelectionInput} defaultValue={editorTabs[i].name} onBlur={e => {
              let value = e.target.value;
              let validation = fileNameValid(value);

              if(validation === true) {
                send("renameTab", { name: e.target.value, path: editorTabs[i].path });
              } else {
                send("stopRanamingTab");
              }
            }} onChange={e => {
              let value = e.target.value;
              let validation = fileNameValid(value);
              
              if(validation === true) {
                renameFileWarning.current.style.display = "none";
                return
              }

              renameFileWarning.current.style.display = "block";
              renameFileWarning.current.innerText = validation;
            }} />
            <div className={styles.tabWarningMessage} ref={renameFileWarning}></div>
          </div>
        );
      } else {
        selectionPane.push(
          <ContextMenuArea key={i} menuItems={
            <>
              <MenuHeader>{editorTabs[i].name}</MenuHeader>
              <MenuItem onClick={e => {
                send("deleteTab", { tab: editorTabs[i] });
              }}>Delete file</MenuItem>
              <MenuItem disabled={state.context.renamingTab !== false} onClick={e => {
                send("setRenameTab", { tab: i });
              }}>Rename file</MenuItem>
              <MenuItem disabled={!editorTabs[i].unsaved} onClick={e => {
                saveTab(i);
              }}>Save file</MenuItem>
              <MenuItem onClick={e => {
                ipc.send("openInExplorer", editorTabs[i].path);
              }}>Open in file explorer</MenuItem>
              <MenuDivider />
              <MenuItem disabled={editorTabs[i].window !== false} onClick={e => {
                popOut(i);
              }}>Open in popout window</MenuItem>
            </>
          }>
            {/* @ts-ignore */}
            <div className={styles.editorSelection + " " + selected} style={{"--indent": editorTabs[i].indent}} onClick={() => clickFunction()}>
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
    }

    let renameFolderWarning = useRef(null);

    for(let i = 0; i < editorFolders.length; i++) {
      let folderSelected = state.context.selectedFolder === i ? styles.selectedFolder : "";
      if(state.context.renamingFolder === i) {
        selectionPane.splice(editorFolders[i].index + selectionStartIndex, 0, 
          // @ts-ignore
          <div className={styles.editorSelection + " " + styles.folderSelection + " " + folderSelected} style={{"--indent": editorFolders[i].indent}} key={i + editorTabs.length}>
            <i className={"fas fa-folder " + styles.editorSelectionIcon}></i>
            <input type="text" className={styles.editorSelectionInput} defaultValue={editorFolders[i].name} onBlur={e => {
              let value = e.target.value;
              let validation = folderNameValid(value);

              if(validation === true) {
                send("renameFolder", { name: value, path: editorFolders[i].path });
              } else {
                send("stopRanamingFolder");
              }
            }} onChange={e => {
              let value = e.target.value;
              let validation = folderNameValid(value);
              
              if(validation === true) {
                renameFolderWarning.current.style.display = "none";
                return
              }

              renameFolderWarning.current.style.display = "block";
              renameFolderWarning.current.innerText = validation;
            }} />
            <div className={styles.tabWarningMessage} ref={renameFolderWarning}></div>
          </div>
        );
      } else {
        selectionPane.splice(editorFolders[i].index + selectionStartIndex, 0, 
          <ContextMenuArea key={i + editorTabs.length} menuItems={
            <>
              <MenuHeader>{editorFolders[i].name}</MenuHeader>
              <MenuItem onClick={e => {
                send("deleteFolder", { folder: editorFolders[i].path });
              }}>Delete folder</MenuItem>
              <MenuItem disabled={state.context.renamingFolder !== false} onClick={e => {
                send("setRenameFolder", { folder: i });
              }}>Rename folder</MenuItem>
              <MenuDivider />
              <MenuItem onClick={e => {
                ipc.send("openInExplorer", editorFolders[i].path);
              }}>Open in file explorer</MenuItem>
            </>
          }>
            {/* @ts-ignore */}
            <div className={styles.editorSelection + " " + styles.folderSelection + " " + folderSelected} style={{"--indent": editorFolders[i].indent}} onClick={() => {
              // TODO: collapse / expand folder
              send("setSelectedFolder", { folder: i });
            }}>
              <i className={"fas fa-folder " + styles.editorSelectionIcon}></i>
              {editorFolders[i].name}
              <div className={styles.editorSelectionHoverButtons}>
                <i className={styles.editorSelectionHoverButton + " fa-solid fa-trash-alt"} onClick={() => {
                  send("deleteFolder", { folder: editorFolders[i].path });
                }}></i>
              </div>
            </div>
          </ContextMenuArea>
        );
      }
    }

    const fileNameValid = (name: string) => {
      if((name.lastIndexOf(".") !== -1 && name.substring(0, name.lastIndexOf(".")).length < 1) || name.length < 1) {
        return "File must have a name";
      }

      if(name.substring(name.lastIndexOf(".") + 1, name.length).length < 1) {
        return "Extension must not be empty";
      }
      
      if(name.length > 100) {
        return "File name must be 100 characters or less";
      }

      let invalidCharacters = ["/", "\\", ":", "*", "?", "\"", "<", ">", "|"];

      for(let i = 0; i < invalidCharacters.length; i++) {
        if(name.indexOf(invalidCharacters[i]) !== -1) {
          return "File name cannot contain the chataracter \"" + invalidCharacters[i] + "\"";
        }
      }

      return true;
    }

    const folderNameValid = (name: string) => {
      if(name.length < 1) {
        return "Folder must have a name";
      }

      if(name.length > 100) {
        return "Folder name must be 100 characters or less";
      }

      let invalidCharacters = ["/", "\\", ":", "*", "?", "\"", "<", ">", "|"];

      for(let i = 0; i < invalidCharacters.length; i++) {
        if(name.indexOf(invalidCharacters[i]) !== -1) {
          return "Folder name cannot contain the chataracter \"" + invalidCharacters[i] + "\"";
        }
      }

      return true;
    }

    let tabWarningMessage = useRef(null);

    if(state.matches({ addingTab: "true" })) {
      let index = state.context.selectedFolder === false ? 
        state.context.editorTabs.length + state.context.editorFolders.length 
        : state.context.editorFolders[state.context.selectedFolder].index + 1;
      selectionPane.splice(index + selectionStartIndex, 0,
        // @ts-ignore
        <div key="adding" className={styles.editorSelection} style={{"--indent": state.context.selectedFolder === false ? 0 : state.context.editorFolders[state.context.selectedFolder].indent + 1}}>
          <i className={"fas fa-plus " + styles.editorSelectionIcon}></i>
          <input type="text" placeholder="file name..." className={styles.editorSelectionInput} onChange={(event) => {
            let name = event.target.value;
            let validation = fileNameValid(name);

            if(validation === true) {
              tabWarningMessage.current.style.display = "none";
              return
            }

            tabWarningMessage.current.style.display = "block";
            tabWarningMessage.current.innerText = validation;
          }} onBlur={(event) => {
            let name = event.target.value;

            if(fileNameValid(name) !== true) {
              send("stopAddingTab");
              return;
            }

            if(name.indexOf(".") === -1) {
              name += ".txt";
            }

            let basepath = state.context.selectedFolder === false ? projects[id].directory : state.context.editorFolders[state.context.selectedFolder].path;

            // Make sure the file doesn't already exist
            let fileExists = true;
            while(fileExists) {
              let tabNumber = 1;
              let hasNumber = false;
              fileExists = false;
              for(let i = 0; i < editorTabs.length; i++) {
                if(editorTabs[i].path === path.join(basepath, name)) {
                  fileExists = true;
                  if(editorTabs[i].name.split("(")[1] !== undefined) {
                    tabNumber = parseInt(editorTabs[i].name.split("(")[1].split(")")[0]) + 1;
                    if(isNaN(tabNumber)) {
                      tabNumber = 1;
                    }
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
              path: path.join(basepath, name),
            };

            send("addTabData", { tab: newTab });
          }}></input>
          <div className={styles.tabWarningMessage} ref={tabWarningMessage}></div>
        </div>
      );
    }

    let folderWarningMessage = useRef(null);

    if(state.matches({ addingFolder: "true" })) {
      let index = state.context.selectedFolder === false ? 
        state.context.editorTabs.length + state.context.editorFolders.length 
        : state.context.editorFolders[state.context.selectedFolder].index + 1;
      selectionPane.splice(index + selectionStartIndex, 0,
        // @ts-ignore
        <div key="addingFolder" className={styles.editorSelection} style={{"--indent": state.context.selectedFolder === false ? 0 : state.context.editorFolders[state.context.selectedFolder].indent + 1}}>
          <i className={"fas fa-plus " + styles.editorSelectionIcon}></i>
          <input type="text" placeholder="folder name..." className={styles.editorSelectionInput} onChange={(event) => {
            let name = event.target.value;
            let validation = folderNameValid(name);

            if(validation === true) {
              folderWarningMessage.current.style.display = "none";
              return
            }

            folderWarningMessage.current.style.display = "block";
            folderWarningMessage.current.innerText = validation;
          }} onBlur={(event) => {
            let name = event.target.value;

            if(folderNameValid(name) !== true) {
              send("stopAddingFolder");
              return;
            }

            let basepath = state.context.selectedFolder === false ? projects[id].directory : state.context.editorFolders[state.context.selectedFolder].path;

            // Make sure the file doesn't already exist
            let folderExists = true;
            while(folderExists) {
              let tabNumber = 1;
              let hasNumber = false;
              folderExists = false;
              for(let i = 0; i < editorFolders.length; i++) {
                if(editorFolders[i].path === path.join(basepath, name)) {
                  folderExists = true;
                  if(editorFolders[i].name.split("(")[1] !== undefined) {
                    tabNumber = parseInt(editorFolders[i].name.split("(")[1].split(")")[0]) + 1;
                    if(isNaN(tabNumber)) {
                      tabNumber = 1;
                    }
                    hasNumber = true;
                  }
                }
              }

              if(folderExists) {
                if(hasNumber) {
                  name = name.split("(")[0] + name.split(")")[1];
                }
                name = name + `(${tabNumber})`;
              }
            }

            // Create the file
            let newFolder = {
              path: path.join(basepath, name),
            };

            send("addFolderData", { folder: newFolder });
          }}></input>
          <div className={styles.tabWarningMessage} ref={folderWarningMessage}></div>
        </div>
      );
    }
    
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
    } else if(state.matches({ editor: { editor: { layout: "JSNodesTab" } } })) {
      selectionPane = [
        tabSelector,
        <JSNodes key="jsnodes" />
      ]
    }

    return (
        <>
            {selectionPane}
        </>
    )
}

export default PaneSelector;