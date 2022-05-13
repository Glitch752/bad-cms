// imports
import React, { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';

import { icons } from '../icons.js';
import { store } from '../store';

// Dashboard code (js)
export default function Dashboard(props) {
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
            <div key={i} className={styles.menusite} onClick={() => navigate("/Editor/Project/" + i)}>
                <i key={i} className={icons[projects[i].icon].faType + " fa-" + icons[projects[i].icon].faIcon + " " + styles.projectIcon}></i>
                <span className={styles.projectText}>{projects[i].name}</span>
                <br />
                <span className={styles.projectDir}>{projects[i].directory}</span>
            </div>
        );
    }
    return (
        // Actual JSX of the dsahboard
        <main>
            <div className={styles.menugrid}>
                <div className={styles.menutop}>
                    <h1>Dashboard</h1>
                </div>
                <div className={styles.menuleft}>
                    <div className={styles.menuleftoption}>
                        <i className="fas fa-angle-right"></i>
                        <p>Projects</p>
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
            </div>
        </main>
    );
}