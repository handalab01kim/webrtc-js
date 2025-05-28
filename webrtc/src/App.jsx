import React from 'react';
import Producer from './Producer';
import Consumer from './Consumer';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './styles.css';

function App() {
    return (
        <BrowserRouter>
            <div>
                <nav>
                    <Link to="/" style={{ display: 'block' }}> Consumer </Link>
                    <Link to="/producer" style={{ display: 'block' }}> Producer </Link>
                </nav>
                <Routes>
                    <Route path="/" element={<Consumer />} />
                    <Route path="/producer" element={<Producer />} />
                    <Route path="*" element={
                            <Link to="/">home</Link>
                    } />
                </Routes>

            </div>
        </BrowserRouter>
    );
}

export default App;
