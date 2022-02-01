import React, { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './GetStarted.module.css';

export default function GetStarted() {
    const navigate = useNavigate();
    return (
        <main>
            <div className={styles.templates}>
                <div className={styles.template} onClick={() => navigate("/template/basic")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/basic.png' alt='Basic'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Basic</h1>
                        <p>A basic template with a single page.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => navigate("/template/blog")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/blog.png' alt='Blog'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Blog</h1>
                        <p>A template for a blog.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => navigate("/template/portfolio")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/portfolio.png' alt='Portfolio'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Portfolio</h1>
                        <p>A template for a portfolio.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => navigate("/template/website")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/website.png' alt='Website'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>Website</h1>
                        <p>A template for a website.</p>
                    </div>
                </div>
                <div className={styles.template} onClick={() => navigate("/template/notemplate")}>
                    <div className={styles.templateimage}>
                        <img src='../assets/templates/notemplate.png' alt='No template'/>
                    </div>
                    <div className={styles.templatename}>
                        <h1>No template</h1>
                        <p>No template, start from scratch.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}