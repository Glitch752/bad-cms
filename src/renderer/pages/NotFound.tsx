import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NotFound.module.css';

import { store } from '../store';

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`), thislocalization = localization.notFoundPage;

export default function NotFound(props) {
    const navigate = useNavigate();
    const NavigateTo = e => {
        e.preventDefault();
        // navigate(-1);
        navigate('/');
    }
    return (
        <main>
            <h1>404</h1>
            <p>{thislocalization.couldNotFindPage}</p>
            <p>{thislocalization.page} {window.location.href.substring(window.location.href.indexOf('#') + 1)}</p>
            <button className={styles.goHome} onClick={NavigateTo}>{thislocalization.goBackHome}</button>
        </main>
    );
}