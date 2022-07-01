import React from 'react';
// import { Component } from '../App';
import { useNavigate } from 'react-router-dom';
import styles from './Welcome.module.css';

import { store } from '../store';

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`), thislocalization = localization.welcomePage;

export default function Welcome() {
    const navigate = useNavigate();
    const NavigateTo = e => {
        e.preventDefault();

        store.set('hasBeenWelcomed', true);

        navigate('/GetStarted');
    }
    return (
        <main>
            <h1>{thislocalization.welcome}</h1>
            <p>{thislocalization.welcomeText}</p>
            <button className={styles.start} onClick={NavigateTo}>{thislocalization.getStarted}</button>
        </main>
    );
}