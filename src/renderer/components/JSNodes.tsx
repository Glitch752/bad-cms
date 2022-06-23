import styles from "../pages/Editor.module.css";

function JSNodes() {
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
                getContentOfScripts().map((script, index) => {
                    return (
                        <div key={index} className={styles.JSNodesNode}>
                            <div className={styles.JSNodesNodeeader}>
                                <div className={styles.JSNodesNodeHeaderText}>
                                    {script.file}
                                </div>
                            </div>
                            <div className={styles.JSNodesNodeCode}>
                                {script.code}
                            </div>
                        </div>
                    );
                })
            }
        </div>
    );
}

export default JSNodes;