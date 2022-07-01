import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store';

const localization = require(`../localization/${store.get('language', 'en')}/localization.json`);

export default function Welcome() {
    const navigate = useNavigate();
    
    useEffect(() => {
        if(store.get('hasBeenWelcomed')) {
            //navigate("/GetStarted");
            navigate("/Dashboard");
        } else {
            navigate("/Welcome");
        }
    });
    return (
        <main>
            <h1>{localization.loading}</h1>
        </main>
    );
}