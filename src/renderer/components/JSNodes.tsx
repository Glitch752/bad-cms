import { useState } from "react";
import { Script } from "vm";
import styles from "../pages/Editor.module.css";

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
    
            let code = scriptContent[scriptContent.length - 1].code;
            // Remove all comments
            code = code.replace(/\/\*[\s\S]*?\*\//g, "");
            code = code.replace(/\/\/.*/g, "");
            // Remove all unnecessary whitespace
            code = code.replace(/\s+/g, " ");
            // Remove all newlines
            code = code.replace(/\n/g, "");
            // Trim
            code = code.trim();
            scriptContent[scriptContent.length - 1].code = code;
        }
    
        return scriptContent;
    }

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
            {
                getContentOfScripts().length > 0 && getContentOfScripts()[selectedScript].code.split(";").map((code, index) => {
                    return (
                        <div key={index} className={styles.JSNodesNode}>
                            <div className={styles.JSNodesNodeCode}>
                                {code}
                            </div>
                        </div>
                    );
                })
            }
        </div>
    );
}

export default JSNodes;