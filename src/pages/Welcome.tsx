import React from 'react';
// import { Component } from '../App';
import { useNavigate } from 'react-router-dom';
import './Welcome.css';

export default function Welcome() {
    const navigate = useNavigate();
    console.log(navigate);
    const NavigateTo = e => {
        e.preventDefault();
        // navigate(-1);
        console.log("e");
        navigate('/GetStarted');
    }
    return (
        <main>
            <h1>Welcome</h1>
            <p>Welcome to Bad CMS for devs! We hope this CMS isn't actually <i>that</i> bad, but it's made for people who want to get their hands dirty with actually editing code. This CMS just helps you make a basic structure for your website! Why don't we get started, then?</p>
            <button styleName="start" onClick={NavigateTo}>Get started!</button>
        </main>
    );
}