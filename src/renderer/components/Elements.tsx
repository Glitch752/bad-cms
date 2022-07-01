import styles from '../pages/Editor.module.css';
import React, { useState, useEffect } from 'react';

import ContextMenuArea from '../components/contextMenuArea';
import {
  MenuItem,
  MenuDivider,
  MenuHeader
} from '@szhsin/react-menu';

import { store } from '../store';

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`), thislocalization = localization.elementsComponent;

function Elements() {
  const elementHighlightRef = React.useRef(null);

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

  useEffect(() => {
    window.addEventListener('resize', resizeHighlight);
    return () => {
      window.removeEventListener('resize', resizeHighlight);
    }
  });

  const resizeHighlight = () => {
    if (highlightedElement !== null) {
      setElementHightlight(highlightedElement);
    }
  }

  const getElementTree = () => {
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
    let highlight: any = {};
    if (!element.getBoundingClientRect) {
      highlight.display = 'none';
      elementHighlightRef.current(highlight);
      return;
    }
    highlightedElement = element;
    const boundingRect = element.getBoundingClientRect();
    // Get the bounding rect of the editorFrame
    const iframePosition = document
      .getElementById('editorFrame')
      .getBoundingClientRect();

    highlight.top = iframePosition.top + boundingRect.top;
    highlight.left = iframePosition.left + boundingRect.left;
    highlight.width = boundingRect.width;
    highlight.height = boundingRect.height;

    highlight.display = 'inline-block';

    highlight.paddingTop = parseInt(window.getComputedStyle(element).getPropertyValue('padding-top'));
    highlight.paddingLeft = parseInt(window.getComputedStyle(element).getPropertyValue('padding-left'));
    highlight.paddingRight = parseInt(window.getComputedStyle(element).getPropertyValue('padding-right'));
    highlight.paddingBottom = parseInt(window.getComputedStyle(element).getPropertyValue('padding-bottom'));

    highlight.marginTop = parseInt(window.getComputedStyle(element).getPropertyValue('margin-top'));
    highlight.marginLeft = parseInt(window.getComputedStyle(element).getPropertyValue('margin-left'));
    highlight.marginRight = parseInt(window.getComputedStyle(element).getPropertyValue('margin-right'));
    highlight.marginBottom = parseInt(window.getComputedStyle(element).getPropertyValue('margin-bottom'));

    elementHighlightRef.current(highlight);
  };

  return (
    <>
      <ElementHighlight elementHighlightRef={elementHighlightRef} />
      {getElementTree()}
    </>
  );
}

function ElementHighlight({ elementHighlightRef }) {
  const [highlight, setHighlightState]: any = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  
    display: 'none',

    paddingTop: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,

    marginTop: 0,
    marginLeft: 0,
    marginRight: 0,
    marginBottom: 0,
  });

  const setHighlight = (style) => {
    setHighlightState(style);
  }

  useEffect(() => {
    elementHighlightRef.current = setHighlight
  }, []);

  return (
    <div className={styles.elementHighlight} style={{
      "top": highlight.top + highlight.paddingTop, 
      "left": highlight.left + highlight.paddingLeft, 
      "width": highlight.width - highlight.paddingLeft - highlight.paddingRight,
      "height": highlight.height - highlight.paddingTop - highlight.paddingBottom,
      "display": highlight.display
    }}>
      {/* Left */}
      <div className={styles.elementHighlightMargin} style={{
        "top": highlight.top - highlight.marginTop,
        "left": highlight.left - highlight.marginLeft,
        "width": highlight.marginLeft,
        "height": highlight.height + highlight.marginTop + highlight.marginBottom
      }}></div>
      {/* Right */}
      <div className={styles.elementHighlightMargin} style={{
        "top": highlight.top - highlight.marginTop,
        "left": highlight.left + highlight.width,
        "width": highlight.marginRight,
        "height": highlight.height + highlight.marginTop + highlight.marginBottom
      }}></div>
      {/* Top */}
      <div className={styles.elementHighlightMargin} style={{
        "top": highlight.top - highlight.marginTop,
        "left": highlight.left,
        "width": highlight.width,
        "height": highlight.marginTop
      }}></div>
      {/* Bottom */}
      <div className={styles.elementHighlightMargin} style={{
        "top": highlight.top + highlight.height,
        "left": highlight.left,
        "width": highlight.width,
        "height": highlight.marginBottom
      }}></div>

      {/* Padding */}
      {/* Left */}
      <div className={styles.elementHighlightPadding} style={{
        "top": highlight.top + highlight.paddingTop,
        "left": highlight.left,
        "width": highlight.paddingLeft,
        "height": highlight.height - highlight.paddingTop - highlight.paddingBottom
      }}></div>
      {/* Right */}
      <div className={styles.elementHighlightPadding} style={{
        "top": highlight.top + highlight.paddingTop,
        "left": highlight.left + highlight.width - highlight.paddingRight,
        "width": highlight.paddingRight,
        "height": highlight.height - highlight.paddingTop - highlight.paddingBottom
      }}></div>
      {/* Top */}
      <div className={styles.elementHighlightPadding} style={{
        "top": highlight.top,
        "left": highlight.left,
        "width": highlight.width,
        "height": highlight.paddingTop
      }}></div>
      {/* Bottom */}
      <div className={styles.elementHighlightPadding} style={{
        "top": highlight.top + highlight.height - highlight.paddingBottom,
        "left": highlight.left,
        "width": highlight.width,
        "height": highlight.paddingBottom
      }}></div>
    </div>
  );
}

function Element(props) {
  const { element, depth } = props;

  const [isFolded, setIsFolded]: any = useState(true);

  const contextMenu = (
    <>
      {/* TODO: add features to this menu */}
      <MenuHeader>{thislocalization.attributes}</MenuHeader>
      <MenuItem disabled>{thislocalization.addAttribute}</MenuItem>
      <MenuItem disabled>{thislocalization.editAttribute}</MenuItem>
      <MenuDivider />
      <MenuHeader>{thislocalization.element}</MenuHeader>
      <MenuItem disabled>{thislocalization.deleteElement}</MenuItem>
      <MenuItem disabled>{thislocalization.duplicateElement}</MenuItem>
      <MenuItem disabled>{thislocalization.editAsHTML}</MenuItem>
      <MenuDivider />
      <MenuItem disabled>{thislocalization.expandRecursively}</MenuItem>
      <MenuItem
        onClick={(e) => {
          setIsFolded(
            isFolded === false || isFolded === true ? 2 : isFolded + 1
          );
        }}
      >{thislocalization.collapseChildren}</MenuItem>
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
            {/* @ts-ignore */}
            <div className={`${hasContextMenu ? styles.elementLine : ""}`} style={{ '--depth': depth }}>
                {/* @ts-ignore */}
              <span onMouseEnter={(e) => highlightElement(e, element)} className={`${hasContextMenu ? "" : styles.elementLine}`} style={{ '--depth': depth }}>
                <ContextMenuArea menuItems={contextMenu}>
                  {/* @ts-ignore */}
                  <span className={`${styles.elementName}`} style={{ '--depth': depth }}>
                    &lt;{element.tagName.toLowerCase()}
                    {getElementAttributes(element)}&gt;
                  </span>
                </ContextMenuArea>
              </span>
              {hasContextMenu ? (
                <ContextMenuArea menuItems={contextMenu}>
                  <span className={`${styles.elementText}`} onMouseEnter={(e) => highlightElement(e, element)}>{content}</span>
                </ContextMenuArea>
              ) : (
                <span className={`${styles.elementText}`}>{content}</span>
              )}
              {/* @ts-ignore */}
              <span onMouseEnter={(e) => highlightElement(e, element)} className={`${hasContextMenu ? "" : styles.elementLine}`} style={{ '--depth': depth }}>
                <ContextMenuArea menuItems={contextMenu}>
                  {/* @ts-ignore */}
                  <span className={`${styles.elementClosingTag}`} style={{ '--depth': depth }}>
                    &lt;/{element.tagName.toLowerCase()}&gt;
                  </span>
                </ContextMenuArea>
              </span>
            </div>
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
          <div>
            <span className={styles.elementText}>
              "{element.element.textContent}"
            </span>
          </div>
        ) : element.children.length > 0 ? (
          depth > 0 && isFolded ? (
            <div>
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
          <div>
            {getTagName(element.element, element.element.textContent)}
          </div>
        )}
      </div>
    </>
  );
}

export default Elements;