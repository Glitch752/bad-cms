import styles from '../pages/Editor.module.css';
import React, { useState, useEffect } from 'react';

import ContextMenuArea from '../components/contextMenuArea';
import {
  MenuItem,
  MenuDivider,
  MenuHeader
} from '@szhsin/react-menu';



function Elements() {
  const elementHighlight = React.useRef(null);

  // This function gets all the elements from the iframe in the format of the element data and it's children
  const getElements = (
    element = window.frames['editorFrame'].document.children[0]
  ) => {
    let children: Element[] = Array.from(element.childNodes);

    // If the children is exactly one text node, then remove it
    if (children.length === 1 && children[0].nodeType === 3) {
      children = [];
    }

    // If there are any text nodes that are just whitespace, remove them.
    children = children.filter((child) => {
      if (child.nodeType === 3) {
        if (child.textContent.trim() === '') {
          return false;
        }
      }
      return true;
    });

    // Allow text nodes, element nodes, and comment nodes
    const allowedNodeTypes = [3, 1, 8];
    // If any of the children are not one of the allowed node types, then remove it
    children = children.filter((child) => {
      return allowedNodeTypes.includes(child.nodeType);
    });

    // Recursively call this function on all children
    return {
      element: element,
      children: [...children].map((child) => getElements(child)),
      siblings: element.parentNode.children.length - 1,
    };
  };

  const getElementTree = () => {
    console.log(getElements());
    return (
      <div className={styles.elementsContainer}>
        <Element
          element={getElements()}
          setElementHightlight={setElementHightlight}
          depth={0}
        />
      </div>
    );
  };

  const iFrameMessage = (event) => {
    let eventData;
    try {
      eventData = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (eventData.type === 'scroll') {
      if (highlightedElement !== null) {
        setElementHightlight(highlightedElement);
      }
    }
  };

  React.useEffect(() => {
    window.addEventListener('message', iFrameMessage);

    return () => {
      window.removeEventListener('message', iFrameMessage);
    };
  }, []);

  let highlightedElement = null;

  const setElementHightlight = (element) => {
    if (!element.getBoundingClientRect) {
      elementHighlight.current.style.display = 'none';
      return;
    }
    highlightedElement = element;
    const boundingRect = element.getBoundingClientRect();
    // Get the bounding rect of the editorFrame
    const iframePosition = document
      .getElementById('editorFrame')
      .getBoundingClientRect();

    const top = iframePosition.top + boundingRect.top;
    const left = iframePosition.left + boundingRect.left;
    const width = boundingRect.width;
    const height = boundingRect.height;

    elementHighlight.current.style.top = top + 'px';
    elementHighlight.current.style.left = left + 'px';
    elementHighlight.current.style.width = width + 'px';
    elementHighlight.current.style.height = height + 'px';
    elementHighlight.current.style.display = 'inline-block';
  };

  return (
    <>
      <div className={styles.elementHighlight} ref={elementHighlight}></div>
      {getElementTree()}
    </>
  );
}

function Element(props) {
  const { element, depth } = props;

  const [isFolded, setIsFolded]: any = useState(true);

  const contextMenu = (
    <>
      <MenuHeader>Attributes</MenuHeader>
      <MenuItem disabled>Add attribute</MenuItem>
      <MenuItem disabled>Edit attribute</MenuItem>
      <MenuDivider />
      <MenuHeader>Element</MenuHeader>
      <MenuItem disabled>Delete element</MenuItem>
      <MenuItem disabled>Duplicate element</MenuItem>
      <MenuItem disabled>Edit as HTML</MenuItem>
      <MenuDivider />
      <MenuItem disabled>Expand recursively</MenuItem>
      <MenuItem
        onClick={(e) => {
          setIsFolded(
            isFolded === false || isFolded === true ? 2 : isFolded + 1
          );
        }}
      >
        Collapse children
      </MenuItem>
    </>
  );

  const getTagName = (element, content, hasContextMenu = true) => {
    // TODO: fix styling styling on hovering the elements
    switch (element.nodeType) {
      case Node.TEXT_NODE:
        return (
          <>
            {/* @ts-ignore */}
            <span className={`${styles.elementText} ${styles.elementLine}`} style={{ '--depth': depth }}>
              "{content}"
            </span>
          </>
        );
      case Node.COMMENT_NODE:
        return (
          <>
            {/* @ts-ignore */}
            <span className={`${styles.elementComment} ${styles.elementLine}`} style={{ '--depth': depth }}>
              &lt;!--{content}--&gt;
            </span>
          </>
        );
      default:
        return (
          <>
            <ContextMenuArea menuItems={contextMenu}>
              {/* @ts-ignore */}
              <span className={`${styles.elementName} ${styles.elementLine}`} style={{ '--depth': depth }}>
                &lt;{element.tagName.toLowerCase()}
                {getElementAttributes(element)}&gt;
              </span>
            </ContextMenuArea>
            {hasContextMenu ? (
              <ContextMenuArea menuItems={contextMenu}>
                <span className={`${styles.elementText}`}>{content}</span>
              </ContextMenuArea>
            ) : (
              <span className={`${styles.elementText}`}>{content}</span>
            )}
            <ContextMenuArea menuItems={contextMenu}>
              {/* @ts-ignore */}
              <span className={`${styles.elementClosingTag} ${styles.elementLine}`} style={{ '--depth': depth }}>
                &lt;/{element.tagName.toLowerCase()}&gt;
              </span>
            </ContextMenuArea>
          </>
        );
    }
  };
  const getElementAttributes = (element) => {
    let attributes = [...element.attributes];
    const result = attributes.map((attribute) => {
      const attributeCode = ['href', 'src'].includes(attribute.name) ? (
        <span>
          ="<span className={styles.attributeValuePath}>{attribute.value}</span>
          "
        </span>
      ) : (
        <span>
          ="<span className={styles.attributeValue}>{attribute.value}</span>"
        </span>
      );
      return (
        <span key={attribute.name} className={styles.elementAttribute}>
          <span> </span>
          <span className={styles.attributeKey}>{attribute.name}</span>
          {attributeCode}
        </span>
      );
    });

    return result.length > 0 ? (
      <span className={styles.elementAttributes}>{result}</span>
    ) : null;
  };

  const highlightElement = (e, element) => {
    props.setElementHightlight(element);
  };

  return (
    <>
      <div className={styles.element}>
        {element.type === 'text' ? (
          <div onClick={(e) => highlightElement(e, element.element)}>
            <span className={styles.elementText}>
              "{element.element.textContent}"
            </span>
          </div>
        ) : element.children.length > 0 ? (
          depth > 0 && isFolded ? (
            <div onClick={(e) => highlightElement(e, element.element)}>
              {getTagName(element.element, '...')}
              <i
                className={`fa-solid fa-caret-right ${styles.elementFold}`}
                onClick={() => setIsFolded(false)}
              ></i>
            </div>
          ) : (
            <>
              {getTagName(
                element.element,
                <div
                  className={
                    element.element.tagName === undefined
                      ? ''
                      : styles.elementChildren
                  }
                >
                  {element.children.map((child, index) => {
                    return (
                      <Element
                        key={index}
                        element={child}
                        depth={depth + 1}
                        setElementHightlight={props.setElementHightlight}
                      />
                    );
                  })}
                </div>,
                false
              )}
              {depth > 0 ? (
                <i
                  className={`fa-solid fa-caret-down ${styles.elementFold}`}
                  onClick={() => setIsFolded(true)}
                ></i>
              ) : null}
            </>
          )
        ) : (
          <div onClick={(e) => highlightElement(e, element.element)}>
            {getTagName(element.element, element.element.textContent)}
          </div>
        )}
      </div>
    </>
  );
}

export default Elements;