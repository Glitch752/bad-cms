import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store';

// store.delete('unicorn');
// console.log(store.get('unicorn'));

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
            <h1>Loading...</h1>
        </main>
    );
}