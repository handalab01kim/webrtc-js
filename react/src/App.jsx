import React from 'react';
import Producer from './components/Producer.jsx';
import Consumer from './components/Consumer.jsx';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './styles.css';

function App() {
    return (
        <BrowserRouter>
            <nav className="app-nav">
                <Link to="/consumer" style={{display: 'block'}}>Consumer</Link>
                <Link to="/producer" style={{display: 'block'}}>Producer</Link>
            </nav>
            <Routes>
                <Route path="/" element={<h1>Home</h1>} />
                <Route path="/consumer" element={<Consumer />} />
                <Route path="/producer" element={<Producer />} />
                <Route path="*" element={
                        <Link to="/">go home</Link>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
