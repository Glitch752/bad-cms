import styles from '../pages/Editor.module.css';

import ContextMenuArea from '../components/contextMenuArea';
import {
  MenuItem,
  MenuDivider,
  MenuHeader
} from '@szhsin/react-menu';

import Creator from '../components/creator';
import Elements from '../components/elements';
import { store } from 'renderer/store';
import { useParams } from 'react-router-dom';
import path from 'path';

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
    let editorTab = state.context.tab;

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

    return (
        <>
            {selectionPane}
        </>
    )
}

export default PaneSelector;