import React, { Component, useEffect} from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
// import Welcome from './pages/Welcome';
import GetStarted from './pages/GetStarted';
import NotFound from './pages/NotFound';
import Welcome from './pages/Welcome';
import Redirect from './pages/Redirect';
import Dashboard from './pages/Dashboard';
import Template from './pages/Template';
import Editor from './pages/Editor';
import EditorPopout from './pages/EditorPopout';


export class App extends Component<any, any> {
  render() {
    return (
      <div className="mainContent">
        <header id="titlebar">
          <div id="drag-region">
            <div id="window-title">
              <span>Bad CMS for devs.</span>
            </div>
            <div id="window-controls">
              <div className="button" id="min-button"><img className="icon" srcSet="../assets/min-w-10.png 1x, ../assets/min-w-12.png 1.25x, ../assets/min-w-15.png 1.5x, ../assets/min-w-15.png 1.75x, ../assets/min-w-20.png 2x, ../assets/min-w-20.png 2.25x, ../assets/min-w-24.png 2.5x, ../assets/min-w-30.png 3x, ../assets/min-w-30.png 3.5x" draggable="false" /></div>
              <div className="button" id="max-button"><img className="icon" srcSet="../assets/max-w-10.png 1x, ../assets/max-w-12.png 1.25x, ../assets/max-w-15.png 1.5x, ../assets/max-w-15.png 1.75x, ../assets/max-w-20.png 2x, ../assets/max-w-20.png 2.25x, ../assets/max-w-24.png 2.5x, ../assets/max-w-30.png 3x, ../assets/max-w-30.png 3.5x" draggable="false" /></div>
              <div className="button" id="restore-button"><img className="icon" srcSet="../assets/restore-w-10.png 1x, ../assets/restore-w-12.png 1.25x, ../assets/restore-w-15.png 1.5x, ../assets/restore-w-15.png 1.75x, ../assets/restore-w-20.png 2x, ../assets/restore-w-20.png 2.25x, ../assets/restore-w-24.png 2.5x, ../assets/restore-w-30.png 3x, ../assets/restore-w-30.png 3.5x" draggable="false" /></div>
              <div className="button" id="close-button"><img className="icon" srcSet="../assets/close-w-10.png 1x, ../assets/close-w-12.png 1.25x, ../assets/close-w-15.png 1.5x, ../assets/close-w-15.png 1.75x, ../assets/close-w-20.png 2x, ../assets/close-w-20.png 2.25x, ../assets/close-w-24.png 2.5x, ../assets/close-w-30.png 3x, ../assets/close-w-30.png 3.5x" draggable="false" /></div>
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
              <Route path="/Dashboard" element={<Dashboard />} />
              <Route path="/template/:type" element={<Template />} />
              <Route path="/Editor/project/:id" element={<Editor />} />
              <Route path="/editorPopout/:file" element={<EditorPopout />} />
            </Routes>
          </HashRouter>
        </div>
      </div>
    );
  }
}

// export const Welcome = (props) => {
//   const navigate = useNavigate();
//   const NavigateTo = e => {
//       e.preventDefault();
//       // navigate(-1);
//       navigate('/GetStarted');
//   }
//   return (
//     <main>
//       <h1>Welcome</h1>
//       <p>Welcome to Bad CMS for devs! We hope this CMS isn't actually <i>that</i> bad, but it's made for people who want to get their hands dirty with actually editing code. This CMS just helps you make a basic structure for your website! Why don't we get started, then?</p>
//       <button className="start" onClick={NavigateTo}>Get started!</button>
//     </main>
//   );
// }

// react-helmet don't guarantee the scripts execution order
export default function Script(props) {

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