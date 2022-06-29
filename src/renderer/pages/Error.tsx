import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Error.module.css';
import localization, { errorPage as thislocalization } from "../localization/en/localization.json";


export default function NotFound(props) {
    const navigate = useNavigate();
    const location: any = useLocation();
    const NavigateTo = e => {
        e.preventDefault();
        // navigate(-1);
        navigate('/');
    }
    return (
        <main>
            <h1>{thislocalization.ohno} {location.state.error}</h1>
            <p>{location.state.errorMessage}</p>
            <button className={styles.goHome} onClick={NavigateTo}>{thislocalization.gobackhome}</button>
        </main>
    );
}