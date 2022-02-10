import { stripBasename } from 'history/PathUtils';
import React, { Component, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './GetStarted.module.css';

import { icons } from '../icons.js';

export default function GetStarted() {
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const [template, setTemplate] = useState(null);

    const SetTemplate = (usedTemplate) => {
        setTemplate(usedTemplate);
        setPage(1);
        // navigate('/tempalte/' + template);
    }
    const goBack = () => {
        setPage(0);
    }
    const SetData = (name, icon) => {
        var isValid = true;
        if (stripWhitespace(name).length > 2) {
            navigate('/template/' + template, { state: { name: name, icon: icon, template: template } });
        } else {
            var nameElement = document.getElementById("shakeName");
            isValid = false;
            nameElement.classList.add(styles.shake);
            setTimeout(function () {
                nameElement.classList.remove(styles.shake);
            }, 1000);
        }
    }
    if(page === 0) {
        return <ChooseTemplate settemplate={SetTemplate} navigate={navigate} />;
    } else if(page === 1) {
        return <ChooseData setdata={SetData} goback={goBack} />;
    }
}

function ChooseData(props) {
    const SetData = props.setdata;
    const goBack = props.goback;
    const [name, setName] = useState("");
    const [icon, setIcon] = useState(0);
    const NameChange = (e) => {
        setName(e.target.value);
    }
    var iconCode = [];
    for (let i = 0; i < icons.length; i++) {
        let isActiveStyles = "";
        if(i == icon) {
            isActiveStyles = " " + styles.activeProjectIcon;
        }
        iconCode.push(<i onClick={() => setIcon(i)} key={i} className={icons[i].faType + " fa-" + icons[i].faIcon + " " + styles.projectIcon + isActiveStyles}></i>);
    }

    return (
        <main>
            <i className={"fa-solid fa-arrow-left " + styles.leaveIcon} onClick={() => goBack()}></i>
            <h1>Project name</h1>
            <input id="shakeName" onChange={NameChange} className={styles.name} type="text" placeholder="Project name" />
            <h1>Project icon</h1>
            <div className={styles.icons}>
                { iconCode }
            </div>
            <button onClick={() => SetData(name, icon)} className={styles.next} >Next</button>
        </main>
    );
}

function ChooseTemplate(props) {
    const SetTemplate = props.settemplate;
    const navigate = props.navigate;
    return (
        <main>
            <i className={"fa-solid fa-arrow-left " + styles.leaveIcon} onClick={() => navigate("/Dashboard")}></i>
            <div className={styles.templates}>
                <div className={styles.template} onClick={() => SetTemplate("Basic")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/basic.png' alt='Basic'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Basic</h1>
                        <p>A basic template with a single page.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => SetTemplate("Blog")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/blog.png' alt='Blog'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Blog</h1>
                        <p>A template for a blog.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => SetTemplate("Portfolio")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/portfolio.png' alt='Portfolio'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Portfolio</h1>
                        <p>A template for a portfolio.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => SetTemplate("Website")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/website.png' alt='Website'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Website</h1>
                        <p>A template for a website.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => SetTemplate("NoTemplate")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/notemplate.png' alt='No template'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>No template</h1>
                        <p>No template, start from scratch.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}

function stripWhitespace(text) {
    return text.replace(/^[ ]+|[ ]+$/g,'');
}
