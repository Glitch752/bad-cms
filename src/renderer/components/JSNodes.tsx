import { useState } from "react";
import { Script } from "vm";
import styles from "../pages/Editor.module.css";

const acorn = require("acorn");

import localization, { JSNodesComponent as thislocalization } from "../localization/en/localization.json";

function JSNodes() {
    const [selectedScript, setSelectedScript] = useState(0);
    
    function getContentOfScripts() {
        let scripts = window.frames['editorFrame'].document.scripts;
        let scriptContent = [];
        for(let i = 0; i < scripts.length; i++) {
            if(scripts[i].src) {
                if(scripts[i].src.includes("editorLayoutInjectScript.js")) continue
    
                let xhr = new XMLHttpRequest();
                xhr.open("GET", scripts[i].src, false);
                xhr.send(null);
                scriptContent.push({
                    code: xhr.responseText,
                    index: i,
                    file: scripts[i].src.split("/").pop()
                });
            } else {
                scriptContent.push({
                    code: scripts[i].innerHTML,
                    index: i,
                    file: "index.html"
                });
            }
        }
    
        return scriptContent;
    }

    console.log(acorn.parse(getContentOfScripts()[selectedScript].code, {ecmaVersion: "latest"}));

    return (
        <div className={styles.JSNodesContainer}>
            {
                getContentOfScripts().length > 0 ? <>
                    <div className={styles.JSNodesDropdown}>
                        {
                            // Make it so that the selected script is the first one
                            getContentOfScripts()
                                .map((script, index) => {return {...script, originalIndex: index}})
                                .sort((a, b) =>  a.originalIndex === selectedScript ? -1 : 1)
                                .map((script, index) => {
                                    return (
                                        <div className={styles.JSNodesDropdownItem} key={index} onClick={() => setSelectedScript(script.originalIndex)}>
                                            {script.file}
                                        </div>
                                    )
                            })
                        }
                        <i className={`fa-solid fa-caret-down ${styles.JSNodesDropdownIcon}`}></i>
                    </div>
                </> : <div className={styles.JSNodesDropdownItem}>No scripts found</div>
            }
            <NodeEditor scripts={getContentOfScripts()} selectedScript={selectedScript} />
        </div>
    );
}

function NodeEditor(props) {
    const {scripts, selectedScript} = props;
    return (
        scripts.length > 0 && acorn.parse(scripts[selectedScript].code, {ecmaVersion: "latest"}).body.map((code, index) => {
            return (
                <div key={index} className={styles.JSNodesNode} style={{"left": Math.random() * 100 + "%", "top": Math.random() * 100 + "%"}}>
                    <div className={styles.JSNodesNodeTitle}>
                        {code.type}
                    </div>
                    <div className={styles.JSNodesNodeContent}>
                        Content<br />
                        And stuff<br />
                        And things<br />
                        And stuff<br />
                        And things<br />
                        <div className={styles.JSNodesNodeInputs}>
                            <div className={`${styles.JSNodesNodeInput} ${styles.JSNodeInputBlue}`} />
                            <div className={`${styles.JSNodesNodeInput} ${styles.JSNodeInputGreen}`} />
                            <div className={`${styles.JSNodesNodeInput} ${styles.JSNodeInputBlue}`} />
                            <div className={`${styles.JSNodesNodeInput} ${styles.JSNodeInputGreen}`} />
                        </div>
                        <div className={styles.JSNodesNodeOutputs}>
                            <div className={`${styles.JSNodesNodeOutput} ${styles.JSNodeOutputRed}`} />
                            <div className={`${styles.JSNodesNodeOutput} ${styles.JSNodeOutputOrange}`} />
                            <div className={`${styles.JSNodesNodeOutput} ${styles.JSNodeOutputRed}`} />
                        </div>
                    </div>
                </div>
            );
        })
    )
}

export default JSNodes;