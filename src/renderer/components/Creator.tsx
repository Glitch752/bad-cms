import styles from '../pages/Editor.module.css';
import React, { useEffect } from 'react';
import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';
import path from 'path';

import CodeEditor from "react-monaco-editor";

const ipc = require('electron').ipcRenderer;

function Creator(props) {
  let creatorMachine = createMachine({
    id: 'creator',
    initial: 'idle',
    context: {
      editorContent: null,
    },
    on: {
      click: {
        target: '.editing',
        actions: assign((_context, event: { editorContent: any }) => {
          return {
            editorContent: event.editorContent,
          };
        }),
      },
    },
    states: {
      idle: {},
      editing: {},
    },
  });

  const [state, send, service] = useMachine(creatorMachine);

  const iFrameMessage = (event) => {
    let parsedData;
    try {
      parsedData = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (parsedData.type === 'clickedElement') {
      // Find all the unique files that the css rules come from.
      // The file is on the cssFile property.
      let cssFiles = new Set();
      for (let i = 0; i < parsedData.styles.length; i++) {
        let style = parsedData.styles[i];
        if (style.cssFile !== undefined) {
          if (style.cssFile.startsWith('file:///')) {
            style.cssFile = style.cssFile.substring(8);
          }
          cssFiles.add(style.cssFile);
        }
      }
      ipc.send('getCssContent', {
        files: Array.from(cssFiles),
        projectPath: props.project.directory,
      });
      send('click', {
        editorContent: [
          {
            type: 'classList',
            classList: parsedData.classList,
            addingNewClass: false,
          },
          {
            type: 'stylesPlaceholder',
            styles: parsedData.styles,
          },
        ],
      });
    } else if (parsedData.type === 'siteHTML') {
      let url = parsedData.currentPage;
      if (url.startsWith('file:///')) {
        url = url.substring(8);
      }

      ipc.send('writeFile', {
        file: url,
        content: parsedData.html,
      });
    }
  };

  ipc.eventNames().forEach((channel: string) => {
    ipc.removeAllListeners(channel);
  });

  ipc.on('getCssContentReply', (_event, arg) => {
    let oldStyles = state.context.editorContent[1].styles;
    let newStyles = arg;

    let newStyleText = [];

    let foundIndex = null;
    let endIndex = null;

    // Loop through all of the old styles, and find the line they are on in the new styles.
    for (let i = 0; i < oldStyles.length; i++) {
      let oldStyle = oldStyles[i];
      let newStyle = newStyles.find((style) => style.file === oldStyle.cssFile);

      if (newStyle.file === 'HTML') {
        newStyle = newStyles.find((style) => style.file === 'HTML');
        let newPath = path.join(props.project.directory, 'index.html');
        oldStyles[i].cssFile = newPath;
      } else if (newStyle.file === 'Unknown') {
        newStyleText.push(oldStyle.cssText);
        continue;
      }

      let oldStyleText = oldStyle.cssText;

      let addLines = [];

      const newStyleLinesTrimmed = newStyle.content
        .split('\n')
        .map((line) => line.trim());
      const newStyleLines = newStyle.content.split('\n');

      for (let j = 0; j < oldStyleText.length; j++) {
        let newFoundIndex = newStyleLinesTrimmed.indexOf(
          oldStyleText.substring(0, j)
        );
        if (newFoundIndex !== -1) {
          foundIndex = newFoundIndex;
        }
      }

      // Find the end of the CSS rule starting at the found index.
      for (let j = foundIndex; j < newStyleLines.length; j++) {
        addLines.push(newStyleLines[j]);
        if (newStyleLines[j].trim() === '}') {
          endIndex = j;
          break;
        }
      }

      newStyleText.push(addLines.join('\n'));
    }

    let newStyleAttr = oldStyles.map((style) => {
      style.cssText = newStyleText.shift();
      style.startIndex = foundIndex;
      style.endIndex = endIndex;
      style.unsaved = false;
      style.unsavedText = '';
      if (style.cssFile !== 'Unknown' && style.cssFile !== 'HTML') {
        style.shortCssFile = style.cssFile.substring(
          props.project.directory.length
        );
      } else {
        style.shortCssFile = style.cssFile;
      }
      return style;
    });

    send('click', {
      editorContent: [
        {
          type: 'classList',
          classList: state.context.editorContent[0].classList,
          addingNewClass: false,
        },
        {
          type: 'styles',
          styles: newStyleAttr,
        },
      ],
    });
  });

  React.useEffect(() => {
    window.addEventListener('message', iFrameMessage);

    return () => {
      window.removeEventListener('message', iFrameMessage);
    };
  }, []);

  const removeClass = (className) => {
    window.frames['editorFrame'].postMessage(
      JSON.stringify({
        type: 'removeClass',
        className: className,
      }),
      '*'
    );
  };

  const addNewClass = () => {
    if (state.context.editorContent.addingNewClass) return;
    let editorContent = state.context.editorContent;
    editorContent[0].addingNewClass = true;
    send('click', {
      editorContent,
    });
  };

  const addedClass = (className) => {
    className = className.trim();
    className = className.replace(/\s/g, '-');
    let classList = state.context.editorContent.find(
      (e) => e.type === 'classList'
    ).classList;
    classList.push(className);
    let editorContent = state.context.editorContent;
    editorContent[0].addingNewClass = false;
    editorContent[0].classList = classList;
    send('click', {
      editorContent,
    });
    window.frames['editorFrame'].postMessage(
      JSON.stringify({
        type: 'addClass',
        className: className,
      }),
      '*'
    );
  };

  useEffect(() => {
    // Add event listener for keys pressed
    document.addEventListener('keydown', keyPressed);

    // Remove event listener when the component is unmounted
    return () => {
      document.removeEventListener('keydown', keyPressed);
    };
  });

  const keyPressed = (event) => {
    if (event.ctrlKey && event.key === 's') {
      saveEditors();
      event.preventDefault();
    }
  };

  const saveEditors = () => {
    const editors = state.context.editorContent[1].styles;

    let editorContent = state.context.editorContent;

    for (let i = 0; i < editors.length; i++) {
      if (editors[i].unsaved) {
        editorContent[1].styles[i].unsaved = false;
        let file = editors[i].cssFile;
        if (file.startsWith('file:///')) {
          file = file.substring(8);
        }
        ipc.send('modifyCss', {
          file: file,
          startIndex: editors[i].startIndex,
          endIndex: editors[i].endIndex,
          content: editors[i].unsavedText,
        });
      }
    }
    send('click', {
      editorContent,
    });
  };

  let timerId;
  const debounce = function (func, delay) {
    clearTimeout(timerId);
    timerId = setTimeout(func, delay);
  };

  const sendRefreshCss = () => {
    window.frames['editorFrame'].postMessage(
      JSON.stringify({
        type: 'reloadCss',
      }),
      '*'
    );
  };

  const InjectJS = () => {
    ipc.send('getAppPath2');
  };

  ipc.once('getAppPathReply2', (_event, args) => {
    var iFrameHead =
      window.frames['editorFrame'].document.getElementsByTagName('head')[0];
    var myscript = document.createElement('script');
    myscript.type = 'text/javascript';
    myscript.src = path.join(args, '/pages/editorLayoutInjectScript.js');
    iFrameHead.appendChild(myscript);
  });

  const sendRefreshPage = () => {
    // Reload the page
    window.frames['editorFrame'].location.reload();
    // Inject the script
    InjectJS();
  };

  ipc.on('modifyCssReply', (_event, arg) => {
    if (arg) {
      debounce(sendRefreshPage, 200);
    } else {
      debounce(sendRefreshCss, 200);
    }
  });

  let creatorElement = [
    <div key="clickElement" className={styles.creatorElementSection}>
      Click on an element to change it.
    </div>,
  ];

  if (state.matches('editing')) {
    creatorElement = [];
    for (let i = 0; i < state.context.editorContent.length; i++) {
      let element = state.context.editorContent[i];
      if (element.type === 'classList') {
        creatorElement.push(
          <div key={i} className={styles.creatorElementSection}>
            <div className={styles.creatorElementSectionName}>Class list</div>
            <i
              className={'fas fa-plus ' + styles.creatorElementSectionIcon}
              onClick={() => {
                addNewClass();
              }}
            ></i>
            <div className={styles.creatorElementSectionList}>
              {element.classList.map((className, index) => {
                return (
                  <div
                    key={index}
                    className={styles.creatorElementSectionListItem}
                  >
                    <span className={styles.creatorElementSectionListItemName}>
                      {className}
                    </span>
                    <i
                      className={
                        'fas fa-times ' +
                        styles.creatorElementSectionListItemRemove
                      }
                      onClick={() => {
                        removeClass(className);
                        element.classList.splice(index, 1);
                        send('click', {
                          editorContent: state.context.editorContent,
                        });
                      }}
                    ></i>
                  </div>
                );
              })}
              {element.addingNewClass ? (
                <div key="add" className={styles.creatorElementSectionListItem}>
                  <input
                    className={styles.creatorElementSectionListItemName}
                    type="text"
                    placeholder="Class name"
                    onBlur={(event) => {
                      addedClass(event.target.value);
                    }}
                  ></input>
                </div>
              ) : null}
            </div>
          </div>
        );
      } else if (element.type === 'styles') {
        let oldCssFile = '';
        creatorElement.push(
          <div key={i} className={styles.creatorElementSection}>
            <div className={styles.creatorElementSectionName}>Styles</div>
            {element.styles.map((style, index) => {
              let oldOldCssFile = oldCssFile;
              oldCssFile = style.shortCssFile;
              return (
                <div key={index} className={styles.creatorElementSectionArea}>
                  <div className={styles.creatorElementSectionSubtitle}>
                    {oldOldCssFile === style.shortCssFile
                      ? null
                      : style.shortCssFile + ':'}
                  </div>
                  {style.unsaved ? (
                    <i
                      className={
                        'fas fa-save ' + styles.creatorElementSectionIcon
                      }
                      onClick={() => {
                        saveEditors();
                      }}
                    ></i>
                  ) : null}
                  <CodeEditor
                    language="css"
                    value={
                      state.context.editorContent[1].styles[index]
                        .unsavedText || style.cssText
                    }
                    className={styles.creatorElementCode}
                    theme="vs-dark"
                    onChange={(value) => {
                      let editorContent = state.context.editorContent;
                      editorContent[1].styles[index].unsaved = true;
                      editorContent[1].styles[index].unsavedText = value;

                      send('click', {
                        editorContent,
                      });
                    }}
                    editorDidMount={(editor, _monaco) => {
                      const editorDefaultWidth =
                        editor.getDomNode().parentElement.offsetWidth;

                      const updateHeight = () => {
                        const contentHeight = Math.min(
                          1000,
                          editor.getContentHeight()
                        );
                        editor.layout({
                          width: editorDefaultWidth,
                          height: contentHeight,
                        });

                        const editorParent = editor.getDomNode().parentElement;

                        editorParent.style.height = contentHeight + 'px';
                      };

                      editor.updateOptions({
                        scrollBeyondLastLine: false,
                        minimap: {
                          enabled: false,
                        },
                      });

                      editor.onDidContentSizeChange(updateHeight);
                      updateHeight();
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      }
    }
  }

  return <div className={styles.creatorContainer}>{creatorElement}</div>;
}

export default Creator;