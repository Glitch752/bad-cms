import React, { useLayoutEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import path from 'path';

import localization, { templatePage as thislocalization } from "../localization/en/localization.json";

import { store } from '../store';

const ipc = require('electron').ipcRenderer;

export default function Template() {
    let { type } = useParams();
    const navigate = useNavigate();
    const location: any = useLocation();

    var projectName = location.state.name !== undefined ? location.state.name : "Unnamed Project";
    var projectIcon = location.state.icon !== undefined ? location.state.icon : 0;

    ipc.send('CreateProject', {name: projectName, icon: projectIcon, template: type});

    ipc.once('CreateProjectReply', (event, args) => {
        if(args == false) {
            navigate("/GetStarted");
            return;
        }
        var currentProjects: any = store.get('projects', []);
        currentProjects.push({
            name: location.state.name,
            icon: location.state.icon,
            directory: args,
        });
        store.set('projects', currentProjects);
        navigate("/Editor/Project/" + (currentProjects.length - 1));
    });

    return (
        <main>
            <h1>{thislocalization.creatingProject}</h1>
        </main>
    );
}