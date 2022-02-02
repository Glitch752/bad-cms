import React from 'react';
// import { Component } from '../App';
import { useNavigate } from 'react-router-dom';
import styles from './Welcome.module.css';

import { store } from '../store';

// store.delete('unicorn');
// console.log(store.get('unicorn'));

export default function Welcome() {
    const navigate = useNavigate();
    const NavigateTo = e => {
        e.preventDefault();

        store.set('hasBeenWelcomed', true);

        navigate('/GetStarted');
    }
    return (
        <main>
            <h1>Welcome</h1>
            <p>Welcome to Bad CMS for devs! We hope this CMS isn't actually <i>that</i> bad, but it's made for people who want to get their hands dirty with actually editing code. This CMS just helps you make a basic structure for your website! Why don't we get started, then?</p>
            <button className={styles.start} onClick={NavigateTo}>Get started!</button>
        </main>
    );
}