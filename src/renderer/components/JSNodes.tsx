import { useEffect, useRef, useState } from "react";
import { fromPromise } from "xstate/lib/behaviors";
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
    const [offset, setOffset] = useState({x: 0, y: 0, oldX: 0, oldY: 0});
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
            const content = parseNodeContent(node);
            parsedNodes.push({
                ...node,
                x: 100 + 250 * startX,
                y: 170 * (j + startY) + 100,
                inputs: parseNodeInputs(node, parentNode, start),
                outputs: parseNodeOutputs(node, parentNode),
                startNode: start,
                content: content.content
            });

            if(!start) {
                if(j === 0) {
                    parentNode.outputs.push({
                        to: [{
                            node: parsedNodes[parsedNodes.length - 1],
                            type: "codeFlow",
                            text: 1
                        }],
                    });
                } else {
                    parentNode.outputs[parentNode.outputs.length - 1].to.push({
                        node: parsedNodes[parsedNodes.length - 1],
                        type: "codeFlow",
                        text: j + 1
                    });
                }
            }

            if(node.body) {
                const nodesParsed = parseNodes(node.body.body, false, startX + 1, startY + j, parsedNodes[parsedNodes.length - 1]);
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
            } else if(node.type === "IfStatement") {
                const parentNode = parsedNodes[parsedNodes.length - 1];
                let nodeConsequent = node.consequent;
                if(nodeConsequent.type === "BlockStatement") {
                    nodeConsequent = nodeConsequent.body;
                } else {
                    nodeConsequent = [nodeConsequent];
                }
                let nodesParsed = parseNodes(nodeConsequent, false, startX + 1, startY + j, parentNode);
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
                
                if(node.alternate) {
                    let nodeAlternate = node.alternate;
                    if(nodeAlternate.type === "BlockStatement") {
                        nodeAlternate = nodeAlternate.body;
                    } else {
                        nodeAlternate = [nodeAlternate];
                    }
                    nodesParsed = parseNodes(nodeAlternate, false, startX + 1, startY + j, parentNode);
                    parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                    startY += nodesParsed.yOffset;
                }
            }

            if(content.addNodes !== undefined && content.addNodes.length > 0) {
                const nodesParsed = parseNodes(content.addNodes.map(node => node[0]), false, startX + 1, startY + j, parsedNodes[parsedNodes.length - 1]);
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
            }
        };

        if(start) {
            for(let i = 0; i < parsedNodes.length; i++) {
                let node = parsedNodes[i];
                if(node.startNode) {
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
                    for(let j = 0; j < node.inputs.length - 1; j++) {
                        let from = node.inputs[j].from;
                        let outputs;
                        if(from instanceof Array) {
                            for(let k = 0; k < from.length; k++) {
                                outputs = from[k].node.outputs;
                                let output = outputs.find(output => {
                                    if(output.to instanceof Array) {
                                        return output.to.find(to => to.node === node)
                                    } else {
                                        return output.to.node === node
                                    }
                                });
                                if(output) {
                                    if(!output.to.index) output.to.index = 0;
                                    output.to.index++;
                                }
                            }
                        } else {
                            outputs = from.node.outputs;
                            let output = outputs.find(output => {
                                if(output.to instanceof Array) {
                                    return output.to.find(to => to.node === node)
                                } else {
                                    return output.to.node === node
                                }
                            });
                            if(output) {
                                if(!output.to.index) output.to.index = 0;
                                output.to.index++;
                            }
                        }
                    }
                }
                if(node.type === "ExpressionStatement") {
                    if(node.expression.type === "CallExpression") {
                        const callee = node.expression.callee;
                        if(callee.type === "Identifier") {
                            const callFunction = callee.name;

                            for(let j = 0; j < parsedNodes.length; j++) {
                                if(parsedNodes[j].type === "FunctionDeclaration" && parsedNodes[j].id.name === callFunction) {
                                    node.outputs.push({
                                        to: {
                                            node: parsedNodes[j],
                                            type: "functionCall",
                                            index: 1
                                        }
                                    });
                                    if(parsedNodes[j].inputs.length < 2) {
                                        parsedNodes[j].inputs.push({
                                            from: [{
                                                node: node
                                            }]
                                        });
                                    } else {
                                        parsedNodes[j].inputs[1].from.push({
                                            node: node
                                        });
                                    }
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
        if(start) return [];

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
                        return `${parseNodeExpression(param).content} ${param.type === "AssignmentPattern" ? "(Optional)" : ""}\n`;
                    })}` : "No parameters"}`
            };
        } else if(node.type === "VariableDeclaration") {
            const declaration = parseVariableDeclaration(node);
            return {
                content: declaration.declaration,
                addNodes: declaration.nodes
            };
        } else if(node.type === "IfStatement") {
            return {
                content: `\\*If\\*\n${parseNodeExpression(node.test).content}`
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

    const parseNodeExpression = (node) => {
        if(node.type === "CallExpression") {
            const callee = node.callee;
            const args = node.arguments;
            const expressions = args.map(arg => parseNodeExpression(arg));
            return {
                content: `\\*Call\\* "${parseNodeExpression(callee).content}"\n
                    ${(args.length > 0 ? 
                        "With arguments: " + expressions.map(expression => expression.content).join(", ") :
                        "With no arguments")}
                    `,
                addNodes: expressions.map(expression => expression.addNodes).filter(expression => expression !== undefined)
            };
        } else if(node.type === "Literal") {
            return {
                content: node.value
            };
        } else if(node.type === "BinaryExpression") {
            return {
                content: `${parseNodeExpression(node.left).content} ${node.operator} ${parseNodeExpression(node.right).content}`
            };
        } else if(node.type === "Identifier") {
            return {
                content: node.name
            };
        } else if(node.type === "MemberExpression") {
            return {
                content: parseNodeExpression(node.object).content + "." + parseNodeExpression(node.property).content
            };
        } else if(node.type === "AssignmentPattern") {
            return {
                content: `${parseNodeExpression(node.left).content} = ${parseNodeExpression(node.right).content}`
            };
        } else if(node.type === "UpdateExpression") {
            return {
                content: `${parseNodeExpression(node.argument).content} ${node.operator}`
            };
        } else if(node.type === "AssignmentExpression") {
            return {
                content: `${parseNodeExpression(node.left).content} ${node.operator} ${parseNodeExpression(node.right).content}`
            };
        } else if(node.type === "FunctionExpression") {
            return {
                content: "(Inline function)",
                addNodes: [node]
            };
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
                content += parseNodeExpression(node.init).content + "\n";
            }
        } else {
            content += "\\*Initialization:\\* None\n";
        }

        if(node.test) {
            content += "\\*Test:\\*\n" + parseNodeExpression(node.test).content + "\n";
        } else {
            content += "\\*Test:\\* None\n";
        }

        if(node.update) {
            content += "\\*Update:\\*\n" + parseNodeExpression(node.update).content + "\n";
        } else {
            content += "\\*Update:\\* None\n";
        }

        return content;
    }

    function parseWhileStatement(node) {
        return `\\*While\\*\n${parseNodeExpression(node.test).content}`;
    }

    const parseVariableDeclaration = (node) => {
        let content = "";
        let addNodes = [];
        for(let i = 0; i < node.declarations.length; i++) {
            if(node.declarations[i].init) {
                let expression = parseNodeExpression(node.declarations[i].init);
                if(expression.addNodes) addNodes = addNodes.concat(expression.addNodes);
                content += "Initialize " + node.declarations[i].id.name + " to " + expression.content + "\n";
            } else {
                content += ("Define " + node.declarations[i].id.name) + ((i < node.declarations.length - 1) ? ",\n" : "\n");
            }
        }

        return {
            declaration: content,
            nodes: addNodes
        };
    }

    useEffect(() => {
        const nodesAreaElem = nodesArea.current;
        nodesAreaElem.addEventListener("mousedown", nodesMouseDown);
        nodesAreaElem.addEventListener("mousemove", nodesMouseMove);
        nodesAreaElem.addEventListener("mouseup", nodesMouseUp);
        nodesAreaElem.addEventListener("mouseleave", nodesMouseUp);
        window.addEventListener("resize", resizeWindow);

        return () => {
            nodesAreaElem.removeEventListener("mousedown", nodesMouseDown);
            nodesAreaElem.removeEventListener("mousemove", nodesMouseMove);
            nodesAreaElem.removeEventListener("mouseup", nodesMouseUp);
            nodesAreaElem.removeEventListener("mouseleave", nodesMouseUp);
            window.removeEventListener("resize", resizeWindow);
        }
    }, []);

    const resizeWindow = () => {
        setOffset({...offset});
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
        if(dragging) {
            // @ts-ignore
            let currentX = document.offset.x + (e.clientX - document.offset.oldX);
            // @ts-ignore
            let currentY = document.offset.y + (e.clientY - document.offset.oldY);
            setOffset({ x: currentX, y: currentY, oldX: e.clientX, oldY: e.clientY });
        } else if(draggingNode !== null) {
            // @ts-ignore
            let newNodes = [...document.nodes];
            newNodes[draggingNode].x = newNodes[draggingNode].x + e.movementX;
            newNodes[draggingNode].y = newNodes[draggingNode].y + e.movementY;

            setNodes(newNodes);
        }
    }
    const nodesMouseUp = (e) => {
        dragging = false;
        draggingNode = null;
    }

    const drawCanvas = async () => {
        const overlayCanvasElem = overlayCanvas.current;
        if(!overlayCanvasElem) return;
        overlayCanvasElem.width = nodesArea.current.offsetWidth;
        overlayCanvasElem.height = nodesArea.current.offsetHeight;
        const ctx = overlayCanvasElem.getContext("2d");

        // @ts-ignore
        let lines = document.lines;
        
        if(nodesChanged || !lines) {
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
                            lines.push({
                                x1: node.x + document.getElementById(`JSNodesNode${i}`).offsetWidth,
                                y1: node.y + document.getElementById(`JSNodesNodeContent${i}`).offsetHeight / (nodes[i].outputs.length + 1) * (j + 1),
                                x2: outputNode.x,
                                y2: outputNode.y + document.getElementById(`JSNodesNodeContent${outputNodeIndex}`).offsetHeight / (outputNode.inputs.length + 1) * (outputIndex + 1),
                                type: output.to[k].type,
                                text: output.to[k].text
                            });
                        }
                    } else {
                        let outputNode = output.to.node;
                        let outputIndex = output.to.index;
                        if(!outputIndex) outputIndex = 0;
                        let outputNodeIndex = nodes.indexOf(outputNode);
                        lines.push({
                            x1: node.x + document.getElementById(`JSNodesNode${i}`).offsetWidth,
                            y1: node.y + document.getElementById(`JSNodesNodeContent${i}`).offsetHeight / (nodes[i].outputs.length + 1) * (j + 1),
                            x2: outputNode.x,
                            y2: outputNode.y + document.getElementById(`JSNodesNodeContent${outputNodeIndex}`).offsetHeight / (outputNode.inputs.length + 1) * (outputIndex + 1),
                            type: output.to.type,
                            text: output.to.text
                        });
                    }
                }
            }
            // @ts-ignore
            document.lines = lines;
        }

        ctx.lineWidth = 2;

        for(let i = 0; i < lines.length; i++) {
            if(lines[i].type === "codeFlow") {
                ctx.strokeStyle = "#222299";
            } else if(lines[i].type === "number") {
                ctx.strokeStyle = "#229944";
            } else if(lines[i].type === "functionCall") {
                ctx.strokeStyle = "#992244";
            } else {
                ctx.strokeStyle = "#9999";
            }

            const line = lines[i];
            ctx.beginPath();
            let x1 = line.x1 + offset.x, y1 = line.y1 + offset.y, x2 = line.x2 + offset.x, y2 = line.y2 + offset.y;
            ctx.moveTo(x1, y1);
            const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
            // Unnecessarily complicated equation, but it looks really cool
            const cp1x = x1 + (clamp(80 - (x2 - x1), 50, 160))/* + (clamp(-100 + (x2 - x1), 0, 400))*/,
                  cp1y = y1 + ((y2 - y1) / 2) - clamp((x2 - x1) / 3, -200, 0),
                  cp2x = x2 + (clamp(-80 + (x2 - x1), -150, -50))/* + (clamp(100 - (x2 - x1), -400, 0))*/,
                  cp2y = y2 + ((y1 - y2) / 2) - clamp((x1 - x2) / 3, 0, 200);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
            ctx.stroke();
            if(lines[i].text !== undefined) {
                const { x, y } = getBezierXY(0.5, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
                const digits = lines[i].text.toString().length;

                ctx.clearRoundRect(x - ((digits * 5) + 10), y - 15, digits * 10 + 20, 30, 10);
                ctx.beginPath();
                ctx.roundRect(x - ((digits * 5) + 5), y - 10, digits * 10 + 10, 20, 10);
                ctx.stroke();
                ctx.fillStyle = "#ffffff";
                ctx.font = "16px Arial";
                ctx.textAlign = "center";
                ctx.fillText(lines[i].text, x, y + 6);
            }
        }
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

    // @ts-ignore
    CanvasRenderingContext2D.prototype.clearRoundRect = function (x, y, width, height, radius) {
        this.globalCompositeOperation = 'destination-out';
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
        this.fill();
        this.globalCompositeOperation = "source-over";
    }

    const getBezierXY = (t, sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey) => {
        return {
          x: Math.pow(1-t,3) * sx + 3 * t * Math.pow(1 - t, 2) * cp1x 
            + 3 * t * t * (1 - t) * cp2x + t * t * t * ex,
          y: Math.pow(1-t,3) * sy + 3 * t * Math.pow(1 - t, 2) * cp1y 
            + 3 * t * t * (1 - t) * cp2y + t * t * t * ey
        };
    }

    requestAnimationFrame(drawCanvas);

    return (
        <div className={styles.JSNodesNodeArea} ref={nodesArea}>
            {
                nodes.map((code, index) => {
                    return (
                        <div id={"JSNodesNode" + index} key={index} className={styles.JSNodesNode} style={{"left": `${code.x + offset.x}px`, "top": `${code.y + offset.y}px`}}>
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
                                            } else if(inputFrom.type === "number") {
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
                                            } else if(outputTo.type === "number") {
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