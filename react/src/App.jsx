import React from 'react';
import Producer from './components/Producer.jsx';
import Consumer from './components/Consumer.jsx';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles.css';
import CamChat from "./pages/CamChat.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:id" element={<CamChat />} />
        <Route path="*" element={<div>not found!</div>} /> {/*404*/}
      </Routes>
    </Router>
  );
}

export default App;