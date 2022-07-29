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

    const parseNodes = (nodesToParse, start, startX = 0, startY = 0, parentNode = null, callOrder = [0], outputMax = 1) => {
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
            const content: any = parseNodeContent(node, callOrder);

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

            const currentX = startX + (midNodes ? midNodes.length : 0),
                  currentY = (j + startY);
            
            parsedNodes.push({
                ...node,
                x: 100 + 250 * currentX,
                y: 170 * currentY + 100,
                inputs: parseNodeInputs(node, iterationParentNode, start && !(midNodes && midNodes.length > 0)),
                outputs: parseNodeOutputs(node, iterationParentNode),
                startNode: start && !(midNodes && midNodes.length > 0),
                content: content.content,
                inputConnections: content.inputConnections,
                definedVars: content.definedVars,
                callOrder: callOrder.slice()
            });
            let childNode = parsedNodes[parsedNodes.length - 1];

            
            if(inputNodes && inputNodes.length > 0) {
                const inputNodesParsed = parseInputNodes(inputNodes, childNode, startX, startY, j, parsedNodes);

                childNode.x += (inputNodes && inputNodes.length > 0 ? inputNodesParsed.maxRecursiveDepth : 0) * 250;
                startY = inputNodesParsed.startY;
                parsedNodes = inputNodesParsed.parsedNodes;
            }

            if(!(start && !(midNodes && midNodes.length > 0))) {
                if(iterationParentNode.outputs.length < outputMax) {
                    iterationParentNode.outputs.push({
                        to: [{
                            node: childNode,
                            type: "codeFlow",
                            text: 1
                        }],
                    });
                } else {
                    let to = iterationParentNode.outputs[iterationParentNode.outputs.length - 1].to;
                    const newElem = {
                        node: childNode,
                        type: "codeFlow",
                        text: j + 1
                    };
                    if(to instanceof Array) {
                        to.push(newElem);
                    } else {
                        to = [to, newElem];
                    }
                }
            }

            let newCallOrder = callOrder.slice();
            newCallOrder.push(0);
            
            callOrder[callOrder.length - 1]++;

            if(node.body) {
                const nodesParsed = parseNodes(
                    node.body.body, 
                    false, 
                    currentX + 1, 
                    startY + j, 
                    childNode, 
                    newCallOrder
                );
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
            } else if(node.type === "IfStatement") {
                let nodeConsequent = node.consequent;
                if(nodeConsequent.type === "BlockStatement") {
                    nodeConsequent = nodeConsequent.body;
                } else {
                    nodeConsequent = [nodeConsequent];
                }
                let nodesParsed = parseNodes(
                    nodeConsequent, 
                    false, 
                    currentX + 1, 
                    startY + j,
                    childNode, 
                    newCallOrder
                );
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
                
                if(node.alternate) {
                    newCallOrder[newCallOrder.length - 1] = nodesParsed.nodes.length;
                    let nodeAlternate = node.alternate;
                    if(nodeAlternate.type === "BlockStatement") {
                        nodeAlternate = nodeAlternate.body;
                    } else {
                        nodeAlternate = [nodeAlternate];
                    }
                    nodesParsed = parseNodes(
                        nodeAlternate, 
                        false, 
                        currentX + 1, 
                        startY + j, 
                        childNode, 
                        newCallOrder,
                        2
                    );
                    parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                    startY += nodesParsed.yOffset;
                }
            }

            if(content.addNodes !== undefined && content.addNodes.length > 0) {
                const nodesParsed = parseNodes(
                    content.addNodes.map(node => node instanceof Array ? node[0] : node), 
                    false, 
                    currentX + 1, 
                    startY + j, 
                    parsedNodes[parsedNodes.length - 1], 
                    newCallOrder
                );
                parsedNodes = [...parsedNodes, ...nodesParsed.nodes];
                startY += nodesParsed.yOffset;
            }
        };

        if(start) {
            for(let i = 0; i < parsedNodes.length; i++) {
                let node = parsedNodes[i];

                let inputConnections = node.inputConnections;
                if(inputConnections && inputConnections.length > 0) {
                    for(let j = 0; j < inputConnections.length; j++) {
                        let fromNode = null;

                        for(let k = 0; k < parsedNodes.length; k++) {
                            if(inputConnections[j].condition(parsedNodes[k])) {
                                fromNode = parsedNodes[k];
                                break;
                            }
                        }

                        if(fromNode === null) continue;
                        let inputConnection = {
                            from: {
                                node: fromNode,
                            }
                        };
                        node.inputs.push(inputConnection);

                        fromNode.outputs.push({
                            to: {
                                node: node,
                                type: "data",
                                text: inputConnections[j].text,
                                index: node.inputs.length - 1
                            }
                        });
                    }
                }

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

    const parseInputNodes = (inputNodes, childNode, startX, startY, j, parsedNodes, maxRecursiveDepth = 1, currentRecursiveDepth = 1) => {
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
            const setNode = parsedNodes[parsedNodes.length - 1];
            
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

            if(inputNode.inputNodes && inputNode.inputNodes.length > 0) {
                let parsedInputNodes = parseInputNodes(
                    inputNode.inputNodes,
                    parsedNodes[parsedNodes.length - 1],
                    startX,
                    startY,
                    j,
                    parsedNodes,
                    maxRecursiveDepth + 1,
                    currentRecursiveDepth + 1
                );
                startY = parsedInputNodes.startY;
                parsedNodes = parsedInputNodes.parsedNodes;
                if(parsedInputNodes.maxRecursiveDepth > maxRecursiveDepth) maxRecursiveDepth = parsedInputNodes.maxRecursiveDepth;
                setNode.x += 250 * (maxRecursiveDepth - currentRecursiveDepth);
            }
        }
        return {
            maxRecursiveDepth: maxRecursiveDepth,
            startY: startY,
            parsedNodes: parsedNodes
        }
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

    const parseNodeContent = (node, callOrder) => {
        if(node.type === "start") {
            return {
                content: "\\*Program\\*"
            };
        } else if(node.type === "ExpressionStatement") {
            const expression = parseNodeExpression(node.expression, callOrder);
            return {
                content: expression.content,
                addNodes: expression.addNodes,
                inputConnections: expression.inputConnections,
                inputNodes: expression.inputNodes,
            };
        } else if(node.type === "FunctionDeclaration") {
            let inputConnections = [];
            let parametersText = node.params.map(param => {
                const paramExpression = parseNodeExpression(param, callOrder, false);
                if(paramExpression.inputConnections) inputConnections = inputConnections.concat(paramExpression.inputConnections);
                return `${paramExpression.content} ${param.type === "AssignmentPattern" ? "(Optional)" : ""}\n`;
            });
            return {
                content: `Define function \\*${node.id.name}\\*\n
                    ${node.params.length > 0 ? `\\*Parameters:\\*\n
                        ${parametersText}` : "No parameters"}`,
                definedVars: node.params.map(param => {
                    if(param.type === "AssignmentPattern") {
                        return param.left.name;
                    } else {
                        return param.name;
                    }
                })
            };
        } else if(node.type === "VariableDeclaration") {
            const declaration = parseVariableDeclaration(node, callOrder);
            return {
                content: declaration.declaration,
                addNodes: declaration.nodes,
                // midNodes: declaration.midNodes,
                inputNodes: declaration.inputNodes,
                inputConnections: declaration.inputConnections,
                definedVars: declaration.definedVars
            };
        } else if(node.type === "IfStatement") {
            const ifStatement = parseNodeExpression(node.test, callOrder, false);
            return {
                content: `\\*If\\*\n${ifStatement.content}`,
                inputConnections: ifStatement.inputConnections,
            };
        } else if (node.type === "ForStatement") {
            const forStatement = parseForStatement(node, callOrder);
            return {
                content: forStatement.content,
                inputConnections: forStatement.inputConnections,
                definedVars: forStatement.definedVars
            };
        } else if(node.type === "WhileStatement") {
            const whileStatement = parseWhileStatement(node, callOrder);
            return {
                content: whileStatement.content,
                inputConnections: whileStatement.inputConnections
            };
        } else if(node.type === "ClassDeclaration") {
            // TODO: Make references to classes work
            const name = parseNodeExpression(node.id, callOrder).content;
            return {
                content: "\\*Declare class\\* " + 
                    name + 
                    (node.superClass ? (" that inherits it's properties from " + node.superClass.name) : ""),
                definedVars: [name]
            };
        } else if(node.type === "MethodDefinition") {
            return {
                content: (node.static ? 
                        (node.kind === "constructor" ? "\\*Static constructor method\\* " : "\\*Static method\\* ") : 
                        (node.kind === "constructor" ? "\\*Constructor method\\* " : "\\*Method\\* ")) + 
                    parseNodeExpression(node.key).content,
                addNodes: node.value.body.body
            };
        } else {
            return {
                content: node.type
            };
        }
    }

    const parseNodeExpression = (node, callOrder = [], topLayer = true) => {
        if(node.type === "CallExpression") {
            const callee = node.callee;
            const args = node.arguments;
            let inputConnections = [];
            let expressions = args.map(arg => {
                let argExpression = parseNodeExpression(arg, callOrder, false);
                if(argExpression.inputConnections) inputConnections = inputConnections.concat(argExpression.inputConnections);
                return argExpression;
            });
            let callExpression = parseNodeExpression(callee, callOrder, false);
            expressions = expressions.concat(callExpression.inputNodes);
            // if(callExpression.inputConnections) inputConnections = inputConnections.concat(callExpression.inputConnections); 
            //Conflicts with already existing functionCall functionality
            return {
                content: `${!topLayer ? "(" : ""}\\*Call\\* "${callExpression.content}"\n
                    ${(args.length > 0 ? 
                        "With connected arguments" :
                        "With no arguments")}
                    ${!topLayer ? ")" : ""}`,
                addNodes: expressions.map(expression => expression?.addNodes).filter(expression => expression !== undefined),
                inputNodes: expressions.map((expression, index) => {
                    if(!expression || expression.type === "Identifier") return null;
                    return {
                        type: "FunctionArgument",
                        content: expression.content.toString(),
                        text: "Argument" + (index + 1),
                        outputType: "data",
                        inputNodes: expression.inputNodes,
                    };
                }).filter(expression => expression !== null),
                inputConnections: inputConnections
            };
        } else if(node.type === "Literal") {
            return {
                content: node.raw
            };
        } else if(node.type === "BinaryExpression") {
            const leftExpression = parseNodeExpression(node.left, callOrder, false);
            const rightExpression = parseNodeExpression(node.right, callOrder, false);
            let inputConnections = [];
            if(leftExpression.inputConnections) inputConnections = inputConnections.concat(leftExpression.inputConnections);
            if(rightExpression.inputConnections) inputConnections = inputConnections.concat(rightExpression.inputConnections);
            return {
                content: `${leftExpression.content} ${node.operator} ${rightExpression.content}`,
                inputConnections: inputConnections
            };
        } else if(node.type === "Identifier") {
            let identifierPossibilities = [];
            identifierPossibilities.push({
                condition: (testnode) => 
                    testnode.definedVars?.find(definedVar => definedVar === node.name) &&
                    arrayStartsWith(callOrder, testnode.callOrder.slice(0, testnode.callOrder.length - 1)),
                text: `Reference to ${node.name}`,
            });
            return {
                content: node.name,
                inputConnections: identifierPossibilities,
                type: "Identifier",
            };
        } else if(node.type === "MemberExpression") {
            const leftMember = parseNodeExpression(node.object, callOrder, false);
            const rightMember = parseNodeExpression(node.property, callOrder, false);
            let inputConnections = [];
            if(leftMember.inputConnections) inputConnections = inputConnections.concat(leftMember.inputConnections);
            if(rightMember.inputConnections) inputConnections = inputConnections.concat(rightMember.inputConnections);
            let inputNodes = [];
            if(leftMember.inputNodes) inputNodes = inputNodes.concat(leftMember.inputNodes);
            if(rightMember.inputNodes) inputNodes = inputNodes.concat(rightMember.inputNodes);
            return {
                content: leftMember.content + "." + rightMember.content,
                inputConnections: inputConnections,
                inputNodes: inputNodes
            };
        } else if(node.type === "AssignmentPattern") {
            let inputNodes = [];
            const rightExpression = parseNodeExpression(node.right, callOrder, false);
            if(rightExpression.inputNodes) inputNodes = inputNodes.concat(rightExpression.inputNodes);
            const leftExpression = parseNodeExpression(node.left, callOrder, false);
            if(leftExpression.inputNodes) inputNodes = inputNodes.concat(leftExpression.inputNodes);
            let inputConnections = [];
            if(rightExpression.inputConnections) inputConnections = inputConnections.concat(rightExpression.inputConnections);
            if(rightExpression.inputNodes) inputNodes = inputNodes.concat(rightExpression.inputNodes);
            return {
                content: `${leftExpression.content} = ${rightExpression.content}`,
                addNodes: rightExpression.addNodes,
                inputConnections: inputConnections,
                inputNodes: inputNodes,
                definedVars: [node.left.name]
            };
        } else if(node.type === "UpdateExpression") {
            const argumentExpression = parseNodeExpression(node.argument, callOrder, false);
            let inputConnections = [];
            if(argumentExpression.inputConnections) inputConnections = inputConnections.concat(argumentExpression.inputConnections);
            return {
                content: `${argumentExpression.content} ${node.operator}`,
                inputConnections: inputConnections
            };
        } else if(node.type === "AssignmentExpression") {
            const rightExpression = parseNodeExpression(node.right, callOrder, false);
            const leftExpression = parseNodeExpression(node.left, callOrder, false);
            let inputConnections = [];
            let inputNodes = [];
            if(rightExpression.inputConnections) inputConnections = inputConnections.concat(rightExpression.inputConnections);
            if(leftExpression.inputConnections) inputConnections = inputConnections.concat(leftExpression.inputConnections);
            if(rightExpression.inputNodes) inputNodes = inputNodes.concat(rightExpression.inputNodes);
            if(leftExpression.inputNodes) inputNodes = inputNodes.concat(leftExpression.inputNodes);
            return {
                content: `${leftExpression.content} ${node.operator} ${rightExpression.content}`,
                addNodes: rightExpression.addNodes,
                inputNodes: inputNodes,
                inputConnections: inputConnections
            };
        } else if(node.type === "FunctionExpression") {
            return {
                content: "(Inline function)",
                addNodes: [node]
            };
        } else if(node.type === "ArrayExpression") {
            let inputConnections = [];
            const elementsText = node.elements.map(element => {
                const elementExpression = parseNodeExpression(element, callOrder, false);
                if(elementExpression.inputConnections) inputConnections = inputConnections.concat(elementExpression.inputConnections);
                return elementExpression.content;
            });
            return {
                content: "[" + elementsText.join(", ") + "]",
                inputConnections: inputConnections
            };
        } else if(node.type === "ObjectExpression") {
            let inputConnections = [];
            const propertiesText = node.properties.map(property => {
                const keyExpression = parseNodeExpression(property.key, callOrder, false);
                const valueExpression = parseNodeExpression(property.value, callOrder, false);
                if(keyExpression.inputConnections) inputConnections = inputConnections.concat(keyExpression.inputConnections);
                if(valueExpression.inputConnections) inputConnections = inputConnections.concat(valueExpression.inputConnections);
                return `${keyExpression.content}: ${valueExpression.content}`;
            })
            return {
                content: "\\*Object\\*\nProperties:\n" + propertiesText.join("\n")
            };
        } else if(node.type === "TemplateLiteral") {
            let sections = node.quasis.concat(node.expressions);
            sections = sections.sort((a, b) => a.start - b.start);
            sections = sections.map(section => {
                return {
                    content: parseNodeExpression(section, callOrder, false).content,
                    type: section.type
                }
            });
            return {
                content: "Template literal",
                inputNodes: sections.map((expression, index) => {
                    if(expression.content === "") return null;
                    if(expression.content.trim() === "") expression.content = `"${expression.content}"`;
                    return {
                        type: expression.type,
                        content: expression.content,
                        text: "Section" + (index + 1),
                        outputType: "data",
                        inputNodes: expression.inputNodes
                    };
                }).filter(node => node !== null),
            }
        } else if(node.type === "TemplateElement") {
            return {
                content: node.value.raw
            }
        } else if(node.type === "NewExpression") {
            const name = parseNodeExpression(node.callee).content;
            const expressions = node.arguments.map(argument => parseNodeExpression(argument))
            return {
                content: "Create a new instance of " + name +
                    (expressions.length > 0 ? " with connected arguments" : 
                    " with no arguemnts"),
                inputNodes: expressions.map((expression, index) => {
                    if(!expression || expression.type === "Identifier") return null;
                    return {
                        type: "FunctionArgument",
                        content: expression.content.toString(),
                        text: "Argument" + (index + 1),
                        outputType: "data",
                        inputNodes: expression.inputNodes,
                    };
                }).filter(expression => expression !== null),
                inputConnections: [{
                    condition: (testnode) => 
                        testnode.definedVars?.find(definedVar => definedVar === name) &&
                        arrayStartsWith(callOrder, testnode.callOrder.slice(0, testnode.callOrder.length - 1)),
                    text: `Reference to ${name}`,
                }],
            }
        } else {
            return {
                content: node.type
            };
        }
    }

    const arrayStartsWith = (array, startArray) => {
        for(let i = 0; i < startArray.length; i++) {
            if(array[i] !== startArray[i]) return false;
        }
        return true;
    }

    const parseForStatement = (node, callOrder) => {
        let content = "\\*For\\*\n";
        let inputConnections = [];
        let definedVars = [];

        if(node.init) {
            content += "\\*Initialization:\\*\n";
            if(node.init.type === "VariableDeclaration") {
                const variableDeclaration = parseVariableDeclaration(node.init, callOrder);
                if(variableDeclaration.inputConnections) inputConnections = variableDeclaration.inputConnections;
                if(variableDeclaration.definedVars) definedVars = definedVars.concat(variableDeclaration.definedVars);
                content += variableDeclaration.declaration + "\n";
            } else {
                const initExpression = parseNodeExpression(node.init, callOrder, false);
                if(initExpression.inputConnections) inputConnections = inputConnections.concat(initExpression.inputConnections);
                content += initExpression.content + "\n";
            }
        } else {
            content += "\\*Initialization:\\* None\n";
        }

        if(node.test) {
            const testExpression = parseNodeExpression(node.test, callOrder, false);
            if(testExpression.inputConnections) inputConnections = inputConnections.concat(testExpression.inputConnections);
            content += "\\*Test:\\*\n" + testExpression.content + "\n";
        } else {
            content += "\\*Test:\\* None\n";
        }

        if(node.update) {
            const updateExpression = parseNodeExpression(node.update, callOrder, false);
            if(updateExpression.inputConnections) inputConnections = inputConnections.concat(updateExpression.inputConnections);
            content += "\\*Update:\\*\n" + updateExpression.content + "\n";
        } else {
            content += "\\*Update:\\* None\n";
        }

        return {
            content: content,
            inputConnections: inputConnections,
            definedVars: definedVars
        };
    }

    function parseWhileStatement(node, callOrder) {
        let inputConnections = [];
        const testExpression = parseNodeExpression(node.test, callOrder, false);
        if(testExpression.inputConnections) inputConnections = inputConnections.concat(testExpression.inputConnections);
        return {
            content: `\\*While\\*\n${testExpression.content}`,
            inputConnections: inputConnections
        };
    }

    const parseVariableDeclaration = (node, callOrder) => {
        let content = "";
        let addNodes = [];
        // let midNodes = [{
        //     type: "Type test",
        //     content: "Content test"
        // }];
        let inputNodes = [];
        let inputConnections = [];
        let definedVars = [];
        for(let i = 0; i < node.declarations.length; i++) {
            if(node.declarations[i].init) {
                const idType = node.declarations[i].id.type;
                content += "Initialize ";
                if(idType === "Identifier") {
                    const name = parseNodeExpression(node.declarations[i].id, callOrder, false).content;
                    content += name;
                    let expression = parseNodeExpression(node.declarations[i].init, callOrder, false);
                    if(expression.addNodes) addNodes = addNodes.concat(expression.addNodes);
                    inputNodes.push({
                        type: "VariableDeclarationInput",
                        content: expression.content.toString(),
                        text: "Initial value of " + name,
                        outputType: "data",
                        inputNodes: expression.inputNodes,
                        inputConnections: expression.inputConnections
                    });
                    definedVars.push(name);
                } else if(idType === "ArrayPattern") {
                    const elements = node.declarations[i].id.elements;
                    for(let j = 0; j < elements.length; j++) {
                        let elementExpression = parseNodeExpression(elements[j], callOrder, false);
                        definedVars.push(elementExpression.content);
                        content += elementExpression.content;
                        if(elements.length === 2 && j === 0) {
                            content += " and ";
                        } else if(j === elements.length - 2) {
                            content += ", and ";
                        } else if(j !== elements.length - 1) {
                            content += ", ";
                        }
                    }
                    const originalArray = parseNodeExpression(node.declarations[i].init, callOrder, false);
                    if(originalArray.inputConnections) inputConnections = inputConnections.concat(originalArray.inputConnections);
                    content += " from the first " + elements.length + " elements of " + originalArray.content;
                } else if(idType === "ObjectPattern") {
                    const properties = node.declarations[i].id.properties;
                    let listContent = "";
                    for(let j = 0; j < properties.length; j++) {
                        if(properties[j].type === "Property") {
                            listContent += properties[j].key.name;
                            definedVars.push(properties[j].key.name);
                            if(properties.length === 2 && j === 0) {
                                listContent += " and ";
                            } else if(j === properties.length - 2) {
                                listContent += ", and ";
                            } else if(j !== properties.length - 1) {
                                listContent += ", ";
                            }
                        }
                    }
                    content += listContent;
                    const originalObject = parseNodeExpression(node.declarations[i].init, callOrder, false);
                    if(originalObject.inputConnections) inputConnections = inputConnections.concat(originalObject.inputConnections);
                    content += " from the " + listContent + " properties of " + originalObject.content + " respectively";
                } else {
                    content += "unknown";
                }
            } else {
                content += ("Define " + node.declarations[i].id.name);
            }
            content += ((i < node.declarations.length - 1) ? ",\n" : "\n");
        }

        return {
            declaration: content,
            nodes: addNodes,
            // midNodes: midNodes,
            inputNodes: inputNodes,
            inputConnections: inputConnections,
            definedVars: definedVars
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
        // @ts-ignore
        document.offset.oldX = e.clientX;
        // @ts-ignore
        document.offset.oldY = e.clientY;
        if(e.target.classList.contains(styles.JSNodesNodeTitle)) {
            draggingNode = e.target.dataset.index;
        } else {
            dragging = true;
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
            let offset = document.offset;

            let diffX = e.clientX - offset.oldX;
            let diffY = e.clientY - offset.oldY;

            newNodes[draggingNode].x = newNodes[draggingNode].x + diffX / offset.scale;
            newNodes[draggingNode].y = newNodes[draggingNode].y + diffY / offset.scale;

            let newOffset = {...offset, oldX: e.clientX, oldY: e.clientY};

            // @ts-ignore
            document.offset = newOffset;

            setOffset(newOffset);

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