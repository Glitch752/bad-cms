import { useEffect, useRef, useState } from "react";
import { Bezier } from "bezier-js";
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
    const [offset, setOffset] = useState({x: 0, y: 0, oldX: 0, oldY: 0, scale: 1});
    const nodesArea = useRef(null);
    const overlayCanvas = useRef(null);
    let dragging = false, draggingNode = null;

    // I don't know why I have to do this to make the data work, but it's the only way I can get it to work
    // FIXME: Find a better way to do this
    // @ts-ignore
    document.offset = offset;

    let nodesChanged = false;
    // @ts-ignore
    if(document.nodes !== nodes) {
        nodesChanged = true;
        // @ts-ignore
        document.nodes = nodes;
    }

    useEffect(() => {
        setNodes(scripts.length > 0 ? parseNodes(acorn.parse(scripts[selectedScript].code, {ecmaVersion: "latest"}).body, true).nodes : []);
        updateOffset();
    }, [selectedScript]);

    // TODO: Refactor because this is a mess

    const parseNodes = (nodesToParse, start, startX = 0, startY = 0, parentNode = null) => {
        let parsedNodes: any[] = start ? [{
            type: "start",
            x: -150,
            y: 100,
            inputs: [],
            outputs: [],
            content: "Program"
        }] : [];
        if(parentNode === null) parentNode = parsedNodes[0];
        for(let j = 0; j < nodesToParse.length; j++) {
            let node = nodesToParse[j];
            let iterationParentNode = parentNode;
            const content: any = parseNodeContent(node);

            let midNodes = content.midNodes;
            let inputNodes = content.inputNodes;
            if(midNodes && midNodes.length > 0) {
                for(let i = 0; i < midNodes.length; i++) {
                    let midNode = midNodes[i];
                    parsedNodes.push({
                        ...midNode,
                        x: 100 + 250 * (startX + i),
                        y: 170 * (j + startY) + 100,
                        inputs: parseNodeInputs(node, iterationParentNode, start || i > 0),
                        outputs: parseNodeOutputs(node, iterationParentNode),
                        startNode: start,
                    });
                    if(!start || i > 0) {
                        if(iterationParentNode.outputs.length < 1) {
                            iterationParentNode.outputs.push({
                                to: [{
                                    node: parsedNodes[parsedNodes.length - 1],
                                    type: "codeFlow",
                                    text: 1
                                }],
                            });
                        } else {
                            iterationParentNode.outputs[iterationParentNode.outputs.length - 1].to.push({
                                node: parsedNodes[parsedNodes.length - 1],
                                type: "codeFlow",
                                text: j + 1
                            });
                        }
                    }
                    iterationParentNode = parsedNodes[parsedNodes.length - 1];
                }
            }

            const currentX = startX + (midNodes ? midNodes.length : 0) + (inputNodes && inputNodes.length > 0 ? 1 : 0),
                  currentY = (j + startY);

            parsedNodes.push({
                ...node,
                x: 100 + 250 * currentX,
                y: 170 * currentY + 100,
                inputs: parseNodeInputs(node, iterationParentNode, start && !(midNodes && midNodes.length > 0)),
                outputs: parseNodeOutputs(node, iterationParentNode),
                startNode: start && !(midNodes && midNodes.length > 0),
                content: content.content
            });
            let childNode = parsedNodes[parsedNodes.length - 1];

            if(inputNodes && inputNodes.length > 0) {
                for(let i = 0; i < inputNodes.length; i++) {
                    let inputNode = inputNodes[i];
                    startY++;
                    parsedNodes.push({
                        ...inputNode,
                        x: 100 + 250 * startX,
                        y: 170 * (j + startY) + 100,
                        inputs: [],
                        outputs: [],
                        startNode: false,
                    });
                    let currentNode = parsedNodes[parsedNodes.length - 1];
                    currentNode.outputs.push({
                        to: {
                            node: childNode,
                            type: inputNode.outputType ? inputNode.outputType : "codeFlow",
                            text: inputNode.text ? inputNode.text : ">",
                            index: childNode.inputs.length
                        }
                    });
                    childNode.inputs.push({
                        from: {
                            node: currentNode
                        }
                    });
                }
            }

            if(!(start && !(midNodes && midNodes.length > 0))) {
                if(iterationParentNode.outputs.length < 1) {
                    iterationParentNode.outputs.push({
                        to: [{
                            node: childNode,
                            type: "codeFlow",
                            text: 1
                        }],
                    });
                } else {
                    iterationParentNode.outputs[iterationParentNode.outputs.length - 1].to.push({
                        node: childNode,
                        type: "codeFlow",
                        text: j + 1
                    });
                }
            }

            if(node.body) {
                const nodesParsed = parseNodes(node.body.body, false, currentX + 1, startY + j, childNode);
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
            } else if(node.type === "IfStatement") {
                let nodeConsequent = node.consequent;
                if(nodeConsequent.type === "BlockStatement") {
                    nodeConsequent = nodeConsequent.body;
                } else {
                    nodeConsequent = [nodeConsequent];
                }
                let nodesParsed = parseNodes(nodeConsequent, false, currentX + 1, startY + j, childNode);
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
                
                if(node.alternate) {
                    let nodeAlternate = node.alternate;
                    if(nodeAlternate.type === "BlockStatement") {
                        nodeAlternate = nodeAlternate.body;
                    } else {
                        nodeAlternate = [nodeAlternate];
                    }
                    nodesParsed = parseNodes(nodeAlternate, false, currentX + 1, startY + j, childNode);
                    parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                    startY += nodesParsed.yOffset;
                }
            }

            if(content.addNodes !== undefined && content.addNodes.length > 0) {
                const nodesParsed = parseNodes(content.addNodes.map(node => node instanceof Array ? node[0] : node), false, currentX + 1, startY + j, parsedNodes[parsedNodes.length - 1]);
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
            }
        };

        if(start) {
            for(let i = 0; i < parsedNodes.length; i++) {
                let node = parsedNodes[i];
                if(node.startNode) {
                    node.inputs.splice(0, 1);
                    node.inputs.unshift({
                        from: {
                            node: parsedNodes[0]
                        }
                    });
                    if(parsedNodes[0].outputs.length < 1) {
                        parsedNodes[0].outputs.push({
                            to: [{
                                node: node, 
                                index: 0,
                                type: "codeFlow",
                                text: 1
                            }],
                        });
                    } else {
                        parsedNodes[0].outputs[0].to.push({
                            node: node, 
                            index: 0,
                            type: "codeFlow",
                            text: parsedNodes[0].outputs[0].to.length + 1
                        });
                    }
                    // Not required... For some reason.
                    // for(let j = 0; j < node.inputs.length; j++) {
                    //     let from = node.inputs[j].from;
                    //     let outputs;
                    //     if(from instanceof Array) {
                    //         for(let k = 0; k < from.length; k++) {
                    //             outputs = from[k].node.outputs;
                    //             let output = outputs.find(output => {
                    //                 if(output.to instanceof Array) {
                    //                     return output.to.find(to => to.node === node)
                    //                 } else {
                    //                     return output.to.node === node
                    //                 }
                    //             });
                    //             if(output) {
                    //                 if(!output.to.index) output.to.index = 0;
                    //                 // output.to.index++;
                    //             }
                    //         }
                    //     } else {
                    //         outputs = from.node.outputs;
                    //         let output = outputs.find(output => {
                    //             if(output.to instanceof Array) {
                    //                 return output.to.find(to => to.node === node)
                    //             } else {
                    //                 return output.to.node === node
                    //             }
                    //         });
                    //         if(output) {
                    //             if(!output.to.index) output.to.index = 0;
                    //             // output.to.index++;
                    //         }
                    //     }
                    // }
                }
                if(node.type === "ExpressionStatement") {
                    if(node.expression.type === "CallExpression") {
                        const callee = node.expression.callee;
                        if(callee.type === "Identifier") {
                            const callFunction = callee.name;

                            for(let j = 0; j < parsedNodes.length; j++) {
                                if(parsedNodes[j].type === "FunctionDeclaration" && parsedNodes[j].id.name === callFunction) {
                                    if(parsedNodes[j].inputs.filter(input => input.type === "functionCall").length < 1) {
                                        parsedNodes[j].inputs.push({
                                            from: [{
                                                node: node
                                            }],
                                            type: "functionCall"
                                        });
                                    } else {
                                        parsedNodes[j].inputs[parsedNodes[j].inputs.indexOf(parsedNodes[j].inputs.filter(input => input.type === "functionCall")[0])].from.push({
                                            node: node
                                        });
                                    }
                                    node.outputs.push({
                                        to: {
                                            node: parsedNodes[j],
                                            type: "functionCall",
                                            index: 1
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            }
            for(let i = 0; i < parsedNodes.length; i++) {
                let node = parsedNodes[i];
                // Set the type of each input that's connected to this node to the same type as the output
                for(let j = 0; j < node.outputs.length; j++) {
                    let output = node.outputs[j];
                    if(output.to instanceof Array) {
                        for(let k = 0; k < output.to.length; k++) {
                            let to = output.to[k];
                            let index = to.index;
                            if(!index) index = 0;
                            let from = to.node.inputs[index].from;
                            if(from instanceof Array) {
                                from.forEach(from => {
                                    from.type = to.type;
                                });
                            } else {
                                from.type = to.type;
                            }
                        }
                    } else {
                        let to = output.to;
                        let index = to.index;
                        if(!index) index = 0;
                        to.node.inputs[index].from.type = to.type;
                    }
                }
            }
        }

        return {
            nodes: parsedNodes,
            yOffset: parsedNodes.length
        };
    }

    const parseNodeInputs = (node, parentNode, start) => {
        if(start) return [{}];

        return [{
            from: {
                node: parentNode
            }
        }];
    }
    const parseNodeOutputs = (node, parentNode) => {
        return [];
    }

    const parseNodeContent = (node) => {
        if(node.type === "start") {
            return {
                content: "\\*Program\\*"
            };
        } else if(node.type === "ExpressionStatement") {
            const expression = parseNodeExpression(node.expression);
            return {
                content: expression.content,
                addNodes: expression.addNodes
            };
        } else if(node.type === "FunctionDeclaration") {
            return {
                content: `Define function \\*${node.id.name}\\*\n
                ${node.params.length > 0 ? `\\*Parameters:\\*\n
                    ${node.params.map(param => {
                        return `${parseNodeExpression(param, false).content} ${param.type === "AssignmentPattern" ? "(Optional)" : ""}\n`;
                    })}` : "No parameters"}`
            };
        } else if(node.type === "VariableDeclaration") {
            const declaration = parseVariableDeclaration(node);
            return {
                content: declaration.declaration,
                addNodes: declaration.nodes,
                // midNodes: declaration.midNodes,
                inputNodes: declaration.inputNodes
            };
        } else if(node.type === "IfStatement") {
            return {
                content: `\\*If\\*\n${parseNodeExpression(node.test, false).content}`
            };
        } else if (node.type === "ForStatement") {
            return {
                content: parseForStatement(node)
            };
        } else if(node.type === "WhileStatement") {
            return {
                content: parseWhileStatement(node)
            };
        } else {
            return {
                content: node.type
            };
        }
    }

    const parseNodeExpression = (node, topLayer = true) => {
        if(node.type === "CallExpression") {
            const callee = node.callee;
            const args = node.arguments;
            const expressions = args.map(arg => parseNodeExpression(arg, false));
            return {
                content: `${!topLayer ? "(" : ""}\\*Call\\* "${parseNodeExpression(callee, false).content}"\n
                    ${(args.length > 0 ? 
                        "With arguments: " + expressions.map(expression => expression.content).join(", ") :
                        "With no arguments")}
                    ${!topLayer ? ")" : ""}`,
                addNodes: expressions.map(expression => expression.addNodes).filter(expression => expression !== undefined)
            };
        } else if(node.type === "Literal") {
            return {
                content: node.value
            };
        } else if(node.type === "BinaryExpression") {
            return {
                content: `${parseNodeExpression(node.left, false).content} ${node.operator} ${parseNodeExpression(node.right, false).content}`
            };
        } else if(node.type === "Identifier") {
            return {
                content: node.name
            };
        } else if(node.type === "MemberExpression") {
            return {
                content: parseNodeExpression(node.object, false).content + "." + parseNodeExpression(node.property, false).content
            };
        } else if(node.type === "AssignmentPattern") {
            const expression = parseNodeExpression(node.right, false);
            return {
                content: `${parseNodeExpression(node.left, false).content} = ${expression.content}`,
                addNodes: expression.addNodes
            };
        } else if(node.type === "UpdateExpression") {
            return {
                content: `${parseNodeExpression(node.argument, false).content} ${node.operator}`
            };
        } else if(node.type === "AssignmentExpression") {
            const expression = parseNodeExpression(node.right, false);
            return {
                content: `${parseNodeExpression(node.left, false).content} ${node.operator} ${expression.content}`,
                addNodes: expression.addNodes
            };
        } else if(node.type === "FunctionExpression") {
            return {
                content: "(Inline function)",
                addNodes: [node]
            };
        } else if(node.type === "ArrayExpression") {
            console.log(node);
            return {
                content: "[" + node.elements.map(element => parseNodeExpression(element, false).content).join(", ") + "]"
            };
        } else if(node.type === "ObjectExpression") {
            console.log(node);
            return {
                content: "\\*Object\\*"
            };
        } else if(node.type === "TemplateLiteral") {
            console.log(node);
            return {
                content: "Template literal"
            }
        } else {
            return {
                content: node.type
            };
        }
    }

    const parseForStatement = (node) => {
        let content = "\\*For\\*\n";

        if(node.init) {
            content += "\\*Initialization:\\*\n";
            if(node.init.type === "VariableDeclaration") {
                content += parseVariableDeclaration(node.init).declaration + "\n";
            } else {
                content += parseNodeExpression(node.init, false).content + "\n";
            }
        } else {
            content += "\\*Initialization:\\* None\n";
        }

        if(node.test) {
            content += "\\*Test:\\*\n" + parseNodeExpression(node.test, false).content + "\n";
        } else {
            content += "\\*Test:\\* None\n";
        }

        if(node.update) {
            content += "\\*Update:\\*\n" + parseNodeExpression(node.update, false).content + "\n";
        } else {
            content += "\\*Update:\\* None\n";
        }

        return content;
    }

    function parseWhileStatement(node) {
        return `\\*While\\*\n${parseNodeExpression(node.test, false).content}`;
    }

    const parseVariableDeclaration = (node) => {
        let content = "";
        let addNodes = [];
        // let midNodes = [{
        //     type: "Type test",
        //     content: "Content test"
        // }];
        let inputNodes = [];
        for(let i = 0; i < node.declarations.length; i++) {
            if(node.declarations[i].init) {
                let expression = parseNodeExpression(node.declarations[i].init, false);
                if(expression.addNodes) addNodes = addNodes.concat(expression.addNodes);
                content += "Initialize " + node.declarations[i].id.name + "\n";
                inputNodes.push({
                    type: "VariableDeclarationInput",
                    content: expression.content.toString(),
                    text: "Initial value of " + node.declarations[i].id.name,
                    outputType: "data"
                });
            } else {
                content += ("Define " + node.declarations[i].id.name) + ((i < node.declarations.length - 1) ? ",\n" : "\n");
            }
        }

        return {
            declaration: content,
            nodes: addNodes,
            // midNodes: midNodes,
            inputNodes: inputNodes
        };
    }

    useEffect(() => {
        const nodesAreaElem = nodesArea.current;
        nodesAreaElem.addEventListener("mousedown", nodesMouseDown);
        nodesAreaElem.addEventListener("mousemove", nodesMouseMove);
        nodesAreaElem.addEventListener("mouseup", nodesMouseUp);
        nodesAreaElem.addEventListener("mouseleave", nodesMouseUp);
        nodesAreaElem.addEventListener("wheel", nodesScroll);
        window.addEventListener("resize", resizeWindow);

        return () => {
            nodesAreaElem.removeEventListener("mousedown", nodesMouseDown);
            nodesAreaElem.removeEventListener("mousemove", nodesMouseMove);
            nodesAreaElem.removeEventListener("mouseup", nodesMouseUp);
            nodesAreaElem.removeEventListener("mouseleave", nodesMouseUp);
            nodesAreaElem.removeEventListener("wheel", nodesScroll);
            window.removeEventListener("resize", resizeWindow);
        }
    }, []);

    const resizeWindow = () => {
        setOffset({...offset});
    }

    const nodesScroll = (e) => {
        // @ts-ignore
        let offset = document.offset;
        let scaleBy = Math.sign(e.deltaY) === 1 ? 1 / 1.1 : 1.1;
        let x = e.clientX - nodesArea.current.getBoundingClientRect().left;
        let y = e.clientY - nodesArea.current.getBoundingClientRect().top;

        setOffset({
            ...offset,
            scale: offset.scale * scaleBy,
            x: x - (x - offset.x) * scaleBy,
            y: y - (y - offset.y) * scaleBy
        });
    }

    const nodesMouseDown = (e) => {
        // Check if we clicked on an element with the class styles.JSNodesNodeTitle
        if(e.target.classList.contains(styles.JSNodesNodeTitle)) {
            draggingNode = e.target.dataset.index;
        } else {
            dragging = true;
            // @ts-ignore
            document.offset.oldX = e.clientX;
            // @ts-ignore
            document.offset.oldY = e.clientY;
        }
    }
    const nodesMouseMove = (e) => {
        if(dragging === true) {
            // @ts-ignore
            let currentX = document.offset.x + (e.clientX - document.offset.oldX);
            // @ts-ignore
            let currentY = document.offset.y + (e.clientY - document.offset.oldY);
            // @ts-ignore
            document.offset = { x: currentX, y: currentY, oldX: e.clientX, oldY: e.clientY, scale: document.offset.scale };
            updateOffset();

            // TODO: Find a better solution for this. For now, it works.
            dragging = null;
            setTimeout(() => {
                if(dragging === false) return;
                dragging = true;
            }, 1000 / 60);
        } else if(draggingNode !== null) {
            // @ts-ignore
            let newNodes = [...document.nodes];
            // @ts-ignore
            newNodes[draggingNode].x = newNodes[draggingNode].x + e.movementX / document.offset.scale;
            // @ts-ignore
            newNodes[draggingNode].y = newNodes[draggingNode].y + e.movementY / document.offset.scale;

            // @ts-ignore
            setOffset({...document.offset});

            setNodes(newNodes);
        }
    }
    const updateOffset = () => {
        const nodesAreaElem = nodesArea.current;
        // @ts-ignore
        const offset = document.offset;
        nodesAreaElem.style.setProperty("--offsetX", `${offset.x}px`);
        nodesAreaElem.style.setProperty("--offsetY", `${offset.y + offset.scale * -25 + 25}px`);
        requestAnimationFrame(drawCanvas);
    }
    const nodesMouseUp = (e) => {
        dragging = false;
        draggingNode = null;

        let x = e.clientX - nodesArea.current.getBoundingClientRect().left;
        let y = e.clientY - nodesArea.current.getBoundingClientRect().top;

        // @ts-ignore
        let { lines, offset } = document;
        let lowestDist = null;
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let { bezier } = line;
            let dist = bezier.project(toWorldCoords(x, y, offset));
            if(lowestDist === null || dist.d < lowestDist.d) {
                lowestDist = dist;
                lowestDist.line = i;
            }
        }
        if(lowestDist.d < 15) {
            lines[lowestDist.line].collapsed = !lines[lowestDist.line].collapsed;
            // @ts-ignore
            document.lines = lines;
            requestAnimationFrame(drawCanvas);
        }
    }

    const drawCanvas = async () => {
        const overlayCanvasElem = overlayCanvas.current;
        if(!overlayCanvasElem) return;
        overlayCanvasElem.width = nodesArea.current.offsetWidth;
        overlayCanvasElem.height = nodesArea.current.offsetHeight;
        const ctx = overlayCanvasElem.getContext("2d");

        ctx.clearRect(0, 0, overlayCanvasElem.width, overlayCanvasElem.height);

        // @ts-ignore
        let lines = document.lines;
        // @ts-ignore
        const offset = document.offset;

        if(nodesChanged || !lines) {
            nodesChanged = false;
            const oldLines = lines ? lines.slice() : [];
            lines = [];
            for(let i = 0; i < nodes.length; i++) {
                let node = nodes[i];

                for(let j = 0; j < node.outputs.length; j++) {
                    let output = node.outputs[j];
                    if(output.to instanceof Array) {
                        for(let k = 0; k < output.to.length; k++) {
                            let outputNode = output.to[k].node;
                            let outputIndex = output.to[k].index;
                            if(!outputIndex) outputIndex = 0;
                            let outputNodeIndex = nodes.indexOf(outputNode);
                            const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
                            const x1 = node.x + document.getElementById(`JSNodesNode${i}`).offsetWidth,
                                  y1 = node.y + document.getElementById(`JSNodesNodeContent${i}`).offsetHeight / (nodes[i].outputs.length + 1) * (j + 1),
                                  x2 = outputNode.x,
                                  y2 = outputNode.y + document.getElementById(`JSNodesNodeContent${outputNodeIndex}`).offsetHeight / (outputNode.inputs.length + 1) * (outputIndex + 1),
                                  cp1x = x1 + (clamp(80 - (x2 - x1), 50, 160))/* + (clamp(-100 + (x2 - x1), 0, 400))*/,
                                  cp1y = y1 + ((y2 - y1) / 2) - clamp((x2 - x1) / 3, -200, 0),
                                  cp2x = x2 + (clamp(-80 + (x2 - x1), -150, -50))/* + (clamp(100 - (x2 - x1), -400, 0))*/,
                                  cp2y = y2 + ((y1 - y2) / 2) - clamp((x1 - x2) / 3, 0, 200),
                                  bezier = new Bezier(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
                            lines.push({
                                x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y,
                                type: output.to[k].type,
                                text: output.to[k].text,
                                bezier: bezier,
                                bounds: bezier.bbox(),
                                collapsed: oldLines[lines.length] ? oldLines[lines.length].collapsed : false
                            });
                        }
                    } else {
                        let outputNode = output.to.node;
                        let outputIndex = output.to.index;
                        if(!outputIndex) outputIndex = 0;
                        let outputNodeIndex = nodes.indexOf(outputNode);
                        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
                        const x1 = node.x + document.getElementById(`JSNodesNode${i}`).offsetWidth,
                                y1 = node.y + document.getElementById(`JSNodesNodeContent${i}`).offsetHeight / (nodes[i].outputs.length + 1) * (j + 1),
                                x2 = outputNode.x,
                                y2 = outputNode.y + document.getElementById(`JSNodesNodeContent${outputNodeIndex}`).offsetHeight / (outputNode.inputs.length + 1) * (outputIndex + 1),
                                cp1x = x1 + (clamp(80 - (x2 - x1), 50, 160))/* + (clamp(-100 + (x2 - x1), 0, 400))*/,
                                cp1y = y1 + ((y2 - y1) / 2) - clamp((x2 - x1) / 3, -200, 0),
                                cp2x = x2 + (clamp(-80 + (x2 - x1), -150, -50))/* + (clamp(100 - (x2 - x1), -400, 0))*/,
                                cp2y = y2 + ((y1 - y2) / 2) - clamp((x1 - x2) / 3, 0, 200),
                                bezier = new Bezier(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
                        lines.push({
                            x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y,
                            type: output.to.type,
                            text: output.to.text,
                            bezier: bezier,
                            bounds: bezier.bbox(),
                            collapsed: oldLines[lines.length] ? oldLines[lines.length].collapsed : false
                        });
                    }
                }
            }
            // @ts-ignore
            document.lines = lines;
        }

        ctx.lineWidth = 2 * offset.scale;

        for(let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if(!rectanglesColliding(
                toScreenCoords(line.bounds.x.min, 0, offset).x,
                toScreenCoords(0, line.bounds.y.min, offset).y,
                toScreenCoords(line.bounds.x.max, 0, offset).x,
                toScreenCoords(0, line.bounds.y.max, offset).y,
                0, 0, overlayCanvasElem.offsetWidth, overlayCanvasElem.offsetHeight
            )) continue;

            if(line.type === "codeFlow") {
                ctx.strokeStyle = "#222299";
            } else if(line.type === "data") {
                ctx.strokeStyle = "#229944";
            } else if(line.type === "functionCall") {
                ctx.strokeStyle = "#992244";
            } else {
                ctx.strokeStyle = "#9999";
            }

            if(!line.collapsed) {
                ctx.beginPath();
                let {x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y, bezier} = line;
                ctx.moveTo(toScreenCoords(x1, 0, offset).x, toScreenCoords(0, y1, offset).y);
                // Unnecessarily complicated equation, but it looks really cool
                ctx.bezierCurveTo(
                    toScreenCoords(cp1x, 0, offset).x, 
                    toScreenCoords(0, cp1y, offset).y, 
                    toScreenCoords(cp2x, 0, offset).x, 
                    toScreenCoords(0, cp2y, offset).y,
                    toScreenCoords(x2, 0, offset).x,
                    toScreenCoords(0, y2, offset).y
                );
                ctx.stroke();
                if(lines[i].text !== undefined) {
                    const { x, y } = bezier.get(0.5);
                    const digits = lines[i].text.toString().length;

                    ctx.beginPath();
                    ctx.fillStyle = "#10191f";
                    ctx.roundRect(
                        toScreenCoords(x - ((digits * 5) + 10), 0, offset).x,
                        toScreenCoords(0, y - 15, offset).y,
                        (digits * 10 + 20) * offset.scale,
                        30 * offset.scale,
                        15 * offset.scale
                    );
                    ctx.fill();
                    ctx.beginPath();
                    ctx.roundRect(
                        toScreenCoords(x - ((digits * 5) + 5), 0, offset).x,
                        toScreenCoords(0, y - 10, offset).y,
                        (digits * 10 + 10) * offset.scale,
                        20 * offset.scale,
                        10 * offset.scale
                    );
                    ctx.stroke();
                    ctx.fillStyle = "#ffffff";
                    ctx.font = `${16 * offset.scale}px monospace`;
                    ctx.textAlign = "center";
                    ctx.fillText(lines[i].text, toScreenCoords(x, 0, offset).x, toScreenCoords(0, y + 6, offset).y);
                }
            } else {
                let { bezier } = line;
                const len = bezier.length();
                let sideLength = 100 / len;
                sideLength = sideLength > 0.3 ? 0.3 : sideLength;
                const bezier1 = bezier.split(0, sideLength);
                const bezier2 = bezier.split(1 - sideLength, 1);

                ctx.beginPath();
                ctx.moveTo(toScreenCoords(bezier1.points[0].x, 0, offset).x, toScreenCoords(0, bezier1.points[0].y, offset).y);
                ctx.bezierCurveTo(
                    toScreenCoords(bezier1.points[1].x, 0, offset).x,
                    toScreenCoords(0, bezier1.points[1].y, offset).y,
                    toScreenCoords(bezier1.points[2].x, 0, offset).x,
                    toScreenCoords(0, bezier1.points[2].y, offset).y,
                    toScreenCoords(bezier1.points[3].x, 0, offset).x,
                    toScreenCoords(0, bezier1.points[3].y, offset).y
                );
                ctx.stroke();
                
                let normalDerivative1 = normaizeVector(bezier1.derivative(1));

                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = `${16 * offset.scale}px monospace`;
                ctx.textAlign = "center";
                ctx.fillText("...", 
                    toScreenCoords(bezier1.points[3].x, 0, offset).x + 20 * offset.scale * normalDerivative1.x, 
                    toScreenCoords(0, bezier1.points[3].y, offset).y + 20 * offset.scale * normalDerivative1.y
                );

                ctx.beginPath();
                ctx.moveTo(toScreenCoords(bezier2.points[0].x, 0, offset).x, toScreenCoords(0, bezier2.points[0].y, offset).y);
                ctx.bezierCurveTo(
                    toScreenCoords(bezier2.points[1].x, 0, offset).x,
                    toScreenCoords(0, bezier2.points[1].y, offset).y,
                    toScreenCoords(bezier2.points[2].x, 0, offset).x,
                    toScreenCoords(0, bezier2.points[2].y, offset).y,
                    toScreenCoords(bezier2.points[3].x, 0, offset).x,
                    toScreenCoords(0, bezier2.points[3].y, offset).y
                );
                ctx.stroke();
                
                let normalDerivative2 = normaizeVector(bezier2.derivative(1));

                ctx.fillText("...", 
                    toScreenCoords(bezier2.points[0].x, 0, offset).x + 20 * offset.scale * -normalDerivative2.x, 
                    toScreenCoords(0, bezier2.points[0].y, offset).y + 20 * offset.scale * -normalDerivative2.y
                );
            }
        }
    }

    const normaizeVector = (vec) => {
        let mag = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
        return {x: vec.x / mag, y: vec.y / mag};
    }

    const toScreenCoords = (x, y, offset) => {
        return {
            x: x * offset.scale + offset.x,
            y: y * offset.scale + offset.y
        }
    }
    const toWorldCoords = (x, y, offset) => {
        return {
            x: (x - offset.x) / offset.scale,
            y: (y - offset.y) / offset.scale
        }
    }

    const rectanglesColliding = (r1x1, r1y1, r1x2, r1y2, r2x1, r2y1, r2x2, r2y2) => {
        return !(r2x1 > r1x2 || r2x2 < r1x1 || r2y1 > r1y2 || r2y2 < r1y1);
    }

    // @ts-ignore
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
        var cornerRadius = { upperLeft: radius, upperRight: radius, lowerLeft: radius, lowerRight: radius };
        if (typeof radius === "object") {
            for (var side in radius) {
                cornerRadius[side] = radius[side];
            }
        }
    
        this.beginPath();
        this.moveTo(x + cornerRadius.upperLeft, y);
        this.lineTo(x + width - cornerRadius.upperRight, y);
        this.quadraticCurveTo(x + width, y, x + width, y + cornerRadius.upperRight);
        this.lineTo(x + width, y + height - cornerRadius.lowerRight);
        this.quadraticCurveTo(x + width, y + height, x + width - cornerRadius.lowerRight, y + height);
        this.lineTo(x + cornerRadius.lowerLeft, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - cornerRadius.lowerLeft);
        this.lineTo(x, y + cornerRadius.upperLeft);
        this.quadraticCurveTo(x, y, x + cornerRadius.upperLeft, y);
    }

    requestAnimationFrame(drawCanvas);

    return (
        // TODO: Figure out why the weird offset.y + offset.scale * -25 + 25 is needed to keep the elements lined up to the canvas
        // @ts-ignore
        <div className={styles.JSNodesNodeArea} ref={nodesArea} style={{"--scale": offset.scale, "--offsetX": `${offset.x}px`, "--offsetY": `${offset.y + document.offset.scale * -25 + 25}px`}}>
            {
                nodes.map((code, index) => {
                    return (
                        // @ts-ignore
                        <div id={"JSNodesNode" + index} key={index} className={styles.JSNodesNode} style={{"--left": `${code.x}px`, "--top": `${code.y}px`}}>
                            <div className={styles.JSNodesNodeTitle} data-index={index}>
                                {code.type}
                            </div>
                            <div id={"JSNodesNodeContent" + index} className={styles.JSNodesNodeContent}>
                                {code.content.split("\n").map((line, index) => {
                                    return (
                                        <div key={index}>{line.split("\\*").map((section, index) => {
                                            if(index % 2 === 0) {
                                                return <span key={index}>{section}</span>;
                                            }
                                            return <b key={index}>{section}</b>;
                                        })}</div>
                                    )
                                })}
                                <div className={styles.JSNodesNodeInputs}>
                                    {
                                        code.inputs.map((input, index) => {
                                            let inputFrom = input.from;
                                            let nodeColor;
                                            if(inputFrom.type === "codeFlow") {
                                                nodeColor = styles.JSNodeBlue;
                                            } else if(inputFrom.type === "data") {
                                                nodeColor = styles.JSNodeGreen;
                                            } else if(inputFrom.type === "functionCall") {
                                                nodeColor = styles.JSNodeRed;
                                            } else {
                                                nodeColor = styles.JSNodeGray;
                                            }
                                            return (
                                                <div key={index} className={`${styles.JSNodesNodeInput} ${nodeColor}`} />
                                            )
                                        })
                                    }
                                </div>
                                <div className={styles.JSNodesNodeOutputs}>
                                    {
                                        code.outputs.map((output, index) => {
                                            let outputTo;
                                            if(output.to instanceof Array) {
                                                outputTo = output.to[0];
                                            } else {
                                                outputTo = output.to;
                                            }
                                            let nodeColor;
                                            if(outputTo.type === "codeFlow") {
                                                nodeColor = styles.JSNodeBlue;
                                            } else if(outputTo.type === "data") {
                                                nodeColor = styles.JSNodeGreen;
                                            } else if(outputTo.type === "functionCall") {
                                                nodeColor = styles.JSNodeRed;
                                            } else {
                                                nodeColor = styles.JSNodeGray;
                                            }
                                            return (
                                                <div key={index} className={`${styles.JSNodesNodeOutput} ${nodeColor}`} />
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        </div>
                    );
                })
            }
            <canvas className={styles.JSNodesOverlayCanvas} ref={overlayCanvas} />
            <div className={styles.JSNodesKey}>
                <div className={styles.JSNodesKeyItem}>
                    <div className={`${styles.JSNodesKeyItemColor} ${styles.JSNodeBlue}`}></div>
                    <div className={styles.JSNodesKeyItemTitle}>Code flow</div>
                </div>
                <div className={styles.JSNodesKeyItem}>
                    <div className={`${styles.JSNodesKeyItemColor} ${styles.JSNodeGreen}`}></div>
                    <div className={styles.JSNodesKeyItemTitle}>Data</div>
                </div>
                <div className={styles.JSNodesKeyItem}>
                    <div className={`${styles.JSNodesKeyItemColor} ${styles.JSNodeRed}`}></div>
                    <div className={styles.JSNodesKeyItemTitle}>Function call</div>
                </div>
            </div>
        </div>
    );
}

export default JSNodes;