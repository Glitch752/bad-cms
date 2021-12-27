import React from 'react';
import { render } from 'react-dom';
import { App } from './App';
import { remote } from 'electron';

//import LogRocket from 'logrocket';
//LogRocket.init('b8unfg/badcmsfordevs');

render(<App />, document.getElementById('root'));