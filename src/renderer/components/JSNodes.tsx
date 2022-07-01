import { useEffect, useRef, useState } from "react";
import styles from "../pages/Editor.module.css";

const acorn = require("acorn");

import { store } from '../store';

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`), thislocalization = localization.JSNodesComponent;

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
    const [nodes, setNodes] = useState([]);
    const [offset, setOffset] = useState({x: 0, y: 0});
    const nodesArea = useRef(null);
    let dragging = false, draggingNode = null;

    // I don't know why I have to do this to make the data work, but it's the only way I can get it to work
    // FIXME: Find a better way to do this
    // @ts-ignore
    document.offset = offset;
    // @ts-ignore
    document.nodes = nodes;

    useEffect(() => {
        setNodes(scripts.length > 0 ? acorn.parse(scripts[selectedScript].code, {ecmaVersion: "latest"}).body.map((node, index) => {
            return {
                type: node.type,
                x: 200 * index + 100,
                y: 100
            }
        }) : []);
    }, [selectedScript]);

    useEffect(() => {
        const nodesAreaElem = nodesArea.current;
        nodesAreaElem.addEventListener("mousedown", nodesMouseDown);
        nodesAreaElem.addEventListener("mousemove", nodesMouseMove);
        nodesAreaElem.addEventListener("mouseup", nodesMouseUp);
        nodesAreaElem.addEventListener("mouseleave", nodesMouseUp);

        return () => {
            nodesAreaElem.removeEventListener("mousedown", nodesMouseDown);
            nodesAreaElem.removeEventListener("mousemove", nodesMouseMove);
            nodesAreaElem.removeEventListener("mouseup", nodesMouseUp);
            nodesAreaElem.removeEventListener("mouseleave", nodesMouseUp);
        }
    }, []);

    function nodesMouseDown(e) {
        // Check if we clicked on an element with the class styles.JSNodesNodeTitle
        if(e.target.classList.contains(styles.JSNodesNodeTitle)) {
            draggingNode = e.target.dataset.index;
        } else {
            dragging = true;
        }
    }
    function nodesMouseMove(e) {
        if(dragging) {
            // @ts-ignore
            setOffset({x: document.offset.x + e.movementX, y: document.offset.y + e.movementY});
        } else if(draggingNode !== null) {
            // @ts-ignore
            let newNodes = [...document.nodes];
            newNodes[draggingNode].x = newNodes[draggingNode].x + e.movementX;
            newNodes[draggingNode].y = newNodes[draggingNode].y + e.movementY;

            setNodes(newNodes);
        }
    }
    function nodesMouseUp(e) {
        dragging = false;
        draggingNode = null;
    }

    return (
        <div className={styles.JSNodesNodeArea} ref={nodesArea}>
            {
                nodes.map((code, index) => {
                    return (
                        <div key={index} className={styles.JSNodesNode} style={{"left": `${code.x + offset.x}px`, "top": `${code.y + offset.y}px`}}>
                            <div className={styles.JSNodesNodeTitle} data-index={index}>
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
            }
        </div>
        
    )
}

export default JSNodes;