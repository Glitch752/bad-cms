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

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`), thislocalization = localization.dashboardPage;

const ipc = require('electron').ipcRenderer;

// Dashboard code (js)
export default function Dashboard(props) {
    const [deleting, setDeleting] = useState(-1);
    const [menuOpen, setMenuOpen] = useState(0);
    props.settitle("Bad CMS for Devs");

    const navigate = useNavigate();
    var projects: any = store.get('projects', []);
    if(menuOpen === 0) {
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
                    <div className={`${styles.menuleftoption} ${menuOpen === 0 ? styles.menuleftactive : ""}`} onClick={() => setMenuOpen(0)}>
                        <i className="fas fa-angle-right"></i>
                        <p>{thislocalization.projects}</p>
                    </div>
                    <div className={`${styles.menuleftoption} ${menuOpen === 1 ? styles.menuleftactive : ""}`} onClick={() => setMenuOpen(1)}>
                        <i className="fas fa-angle-right"></i>
                        <p>{thislocalization.settings}</p>
                    </div>
                </div>
                {
                    menuOpen === 0 ? <div className={styles.menusites}>{sites}</div> : <Settings />
                }
                {deleteMenu}
            </div>
        </main>
    );
}

const languages = [
    { language: "Afrikaans", code: "af-ZA" },
    { language: "Arabic", code: "ar-SA" },
    { language: "Catalan", code: "ca-ES" },
    { language: "Czech", code: "cs-CZ" },
    { language: "Danish", code: "da-DK" },
    { language: "German", code: "de-DE" },
    { language: "Greek", code: "el-GR" },
    { language: "English", code: "en" },
    { language: "Spanish", code: "es-ES" },
    { language: "Finnish", code: "fi-FI" },
    { language: "French", code: "fr-FR" },
    { language: "Hebrew", code: "he-IL" },
    { language: "Hungarian", code: "hu-HU" },
    { language: "Italian", code: "it-IT" },
    { language: "Japanese", code: "ja-JP" },
    { language: "Korean", code: "ko-KR" },
    { language: "Dutch", code: "nl-NL" },
    { language: "Norwegian", code: "no-NO" },
    { language: "Polish", code: "pl-PL" },
    { language: "Portuguese, Brazilian", code: "pt-BR" },
    { language: "Portuguese", code: "pt-PT" },
    { language: "Romanian", code: "ro-RO" },
    { language: "Russian", code: "ru-RU" },
    { language: "Serbian (Cyrillic)", code: "sr-SP" },
    { language: "Swedish", code: "sv-SE" },
    { language: "Turkish", code: "tr-TR" },
    { language: "Ukrainian", code: "uk-UA" },
    { language: "Vietnamese", code: "vi-VN" },
    { language: "Chinese (Simplified)", code: "zh-CN" },
    { language: "Chinese (Traditional)", code: "zh-TW" }
]

function Settings() {
    return (
        <div className={styles.menusites}>
            <div className={styles.settingsMenu}>
                <div className={styles.settingsMenuSeparator}>{thislocalization.settingsMenu.language}</div>
                <div className={styles.settingsMenuSection}>
                    <img src="./assets/localizationAtCrowdin.svg" alt="Localized at Crowdin" className={styles.settingsMenuCrowdinLogo} />
                    {thislocalization.settingsMenu.translation.start} <a href="https://crowdin.com/project/badcms" target="_blank">Crowdin</a>. {thislocalization.settingsMenu.translation.end}
                    <select className={styles.settingsMenuDropdown} defaultValue={store.get('language', 'en').toString()} onChange={(e) => {
                        store.set('language', e.target.value);
                        window.location.reload();
                    }}>
                        {
                            languages.map((language, index) => {
                                return (
                                    <option key={index} value={language.code}>{language.language}</option>
                                );
                            })
                        }
                    </select>
                </div>
            </div>
        </div>
    )
}

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