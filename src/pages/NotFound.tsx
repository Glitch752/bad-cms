import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';


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
            <p>Couldn't find the page you're looking for!</p>
            <button styleName="goHome" onClick={NavigateTo}>Go back home</button>
        </main>
    );
}