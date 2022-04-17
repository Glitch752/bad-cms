import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Error.module.css';


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
            <h1>Oh no! {location.state.error}</h1>
            <p>{location.state.errorMessage}</p>
            <button className={styles.goHome} onClick={NavigateTo}>Go back home</button>
        </main>
    );
}