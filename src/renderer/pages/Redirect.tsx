import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store';

import localization from '../localization/en/localization.json';

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