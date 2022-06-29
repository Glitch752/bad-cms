import React from 'react';
// import { Component } from '../App';
import { useNavigate } from 'react-router-dom';
import styles from './Welcome.module.css';

import { store } from '../store';

import { welcomePage as localization } from "../localization/en/localization.json";

export default function Welcome() {
    const navigate = useNavigate();
    const NavigateTo = e => {
        e.preventDefault();

        store.set('hasBeenWelcomed', true);

        navigate('/GetStarted');
    }
    return (
        <main>
            <h1>{localization.welcome}</h1>
            <p>{localization.welcomeText}</p>
            <button className={styles.start} onClick={NavigateTo}>{localization.getStarted}</button>
        </main>
    );
}