// imports
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';

import { icons } from '../icons.js';
import { store } from '../store';

import {
    ControlledMenu,
    MenuItem
} from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';

import localization, { dashboardPage as thislocalization } from "../localization/en/localization.json";

const ipc = require('electron').ipcRenderer;

function HoverMenu(props) {
    const ref = useRef(null);
    const [isOpen, setOpen] = useState(false);

    return (
        <>
          <i ref={ref} onMouseEnter={() => setOpen(true)} className={`fa-solid fa-bars ${styles.menuSettings}`}></i>

          <ControlledMenu
            state={isOpen ? 'open' : 'closed'}
            anchorRef={ref}
            onMouseLeave={() => setOpen(false)}
            onClose={() => setOpen(false)}
          >
            <MenuItem className={`${styles.deleteMenuButton} ${styles.menuButton}`} onClick={(e) => props.deleteProject()}>
                <i className={`fa-solid fa-trash ${styles.deleteIcon}`}></i>{localization.deleteProject}
            </MenuItem>
          </ControlledMenu>
        </>
    );
}

// Dashboard code (js)
export default function Dashboard(props) {
    let [deleting, setDeleting] = useState(-1);
    props.settitle("Bad CMS for Devs");

    const navigate = useNavigate();
    var projects: any = store.get('projects', []);
    var sites = [
        <div key="a" className={styles.menunew} onClick={() => navigate("/GetStarted")}>
            <i key="a" className={"fas fa-plus " + styles.newProjectIcon}></i>
        </div>
    ];
    for(let i = 0; i < projects.length; i++) {
        sites.push(
            // @ts-ignore
            <div key={i} className={styles.menusite}  style={{"--menu-number": projects.length - i}} onClick={() => {
                    // Check if we didn't also click styles.deleteMenuButton
                    if(!(document.activeElement.classList.contains(styles.menuButton))) {
                        navigate("/Editor/Project/" + i);
                    }
                }}>
                <i key={i} className={icons[projects[i].icon].faType + " fa-" + icons[projects[i].icon].faIcon + " " + styles.projectIcon}></i>
                <span className={styles.projectText}>{projects[i].name}</span>
                <HoverMenu deleteProject={() => deleteProject(i)} />
                <br />
                <span className={styles.projectDir}>{projects[i].directory}</span>
            </div>
        );
    }

    const deleteProject = (project) => {
        setDeleting(project);
    }
    const deleteProjectConfirm = () => {
        setDeleting(-1);
        ipc.send('deleteProject', { directory: projects[deleting].directory });
        projects.splice(deleting, 1);
        store.set('projects', projects);
    }
    const deleteMenu = deleting !== -1 ? (
        <div className={styles.confirmDelete}>
          <div className={styles.confirmDeleteContainer}>
            <div className={styles.confirmDeleteText}>{localization.confirmDelete}</div>
            <div className={styles.confirmDeleteButtons}>
              <button
                className={`${styles.confirmDeleteButton} ${styles.confirmDeleteButtonCancel}`}
                onClick={() => setDeleting(-1)}
              >{localization.buttons.cancel}</button>
              <button
                className={styles.confirmDeleteButton}
                onClick={() => deleteProjectConfirm()}
              >{localization.buttons.delete}</button>
            </div>
          </div>
        </div>
      ) : null;
    return (
        // Actual JSX of the dsahboard
        <main>
            <div className={styles.menugrid}>
                <div className={styles.menutop}>
                    <h1>{thislocalization.dashboard}</h1>
                </div>
                <div className={styles.menuleft}>
                    <div className={styles.menuleftoption}>
                        <i className="fas fa-angle-right"></i>
                        <p>{thislocalization.projects}</p>
                    </div>
                    {/* <div className={styles.menuleftoption}>
                        <i className="fas fa-angle-right"></i>
                        <p>User</p>
                    </div>
                    <div className={styles.menuleftoption}>
                        <i className="fas fa-angle-right"></i>
                        <p>Deafults</p>
                    </div> */}
                </div>
                <div className={styles.menusites}>{sites}</div>
                {deleteMenu}
            </div>
        </main>
    );
}