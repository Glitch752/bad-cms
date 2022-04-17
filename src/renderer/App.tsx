import React, { Component, useEffect} from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';

import './style.css'

// import Welcome from './pages/Welcome';
import GetStarted from './pages/GetStarted';
import NotFound from './pages/NotFound';
import Welcome from './pages/Welcome';
import Redirect from './pages/Redirect';
import Dashboard from './pages/Dashboard';
import Template from './pages/Template';
import Editor from './pages/Editor';
import EditorPopout from './pages/EditorPopout';
import Error from './pages/Error';

export default function App() {
  return (
    <div className="mainContent">
      <header id="titlebar">
        <div id="drag-region">
          <Title />
          <div id="window-controls">
            <div className="button" id="min-button"><img className="icon" srcSet="./assets/min-w-10.png 1x, ./assets/min-w-12.png 1.25x, ./assets/min-w-15.png 1.5x, ./assets/min-w-15.png 1.75x, ./assets/min-w-20.png 2x, ./assets/min-w-20.png 2.25x, ./assets/min-w-24.png 2.5x, ./assets/min-w-30.png 3x, ./assets/min-w-30.png 3.5x" draggable="false" /></div>
            <div className="button" id="max-button"><img className="icon" srcSet="./assets/max-w-10.png 1x, ./assets/max-w-12.png 1.25x, ./assets/max-w-15.png 1.5x, ./assets/max-w-15.png 1.75x, ./assets/max-w-20.png 2x, ./assets/max-w-20.png 2.25x, ./assets/max-w-24.png 2.5x, ./assets/max-w-30.png 3x, ./assets/max-w-30.png 3.5x" draggable="false" /></div>
            <div className="button" id="restore-button"><img className="icon" srcSet="./assets/restore-w-10.png 1x, ./assets/restore-w-12.png 1.25x, ./assets/restore-w-15.png 1.5x, ./assets/restore-w-15.png 1.75x, ./assets/restore-w-20.png 2x, ./assets/restore-w-20.png 2.25x, ./assets/restore-w-24.png 2.5x, ./assets/restore-w-30.png 3x, ./assets/restore-w-30.png 3.5x" draggable="false" /></div>
            <div className="button" id="close-button"><img className="icon" srcSet="./assets/close-w-10.png 1x, ./assets/close-w-12.png 1.25x, ./assets/close-w-15.png 1.5x, ./assets/close-w-15.png 1.75x, ./assets/close-w-20.png 2x, ./assets/close-w-20.png 2.25x, ./assets/close-w-24.png 2.5x, ./assets/close-w-30.png 3x, ./assets/close-w-30.png 3.5x" draggable="false" /></div>
          </div>
        </div>
      </header>
      <Script type="text/javascript" src="./renderer.js"></Script>
      <div className="pageArea">
        <HashRouter>
          <Routes>
            <Route path="*" element={<NotFound />} />
            <Route path="/" element={<Redirect />} />
            <Route path="/Welcome" element={<Welcome />} />
            <Route path="/GetStarted" element={<GetStarted />} />
            <Route path="/Dashboard" element={<Dashboard settitle={setTitleTo} />} />
            <Route path="/template/:type" element={<Template />} />
            <Route path="/Editor/project/:id" element={<Editor settitle={setTitleTo} />} />
            <Route path="/editorPopout/:id/:file" element={<EditorPopout settitle={setTitleTo} />} />
            <Route path="/Error" element={<Error />} />
          </Routes>
        </HashRouter>
      </div>
    </div>
  );
}

let setTitleTo = (title) => {
  setTitleNew(title);
}

let setTitleNew;

function Title(props) {
  let [title, setTitle] = React.useState("Bad CMS for devs.");

  // This might not work on slower machines, so there's probably a better way to do this.
  setTitleNew = (title) => {
    setTimeout(() => {
      setTitle(title);
    }, 1);
  }

  return (
    <div id="window-title">
      <span>{ title }</span>
    </div>
  )
}

// react-helmet don't guarantee the scripts execution order
export function Script(props) {

  // Ruels: alwasy use effect at the top level and from React Functions
  useEffect(() => {
    const script = document.createElement('script')

    // src, async, onload
    Object.assign(script, props)

    let { parent='body' } = props

    let parentNode = document.querySelector(parent)
    parentNode.appendChild(script)

    return () => {
      parentNode.removeChild(script)
    }
  } )

  return null  // Return null is necessary for the moment.
}