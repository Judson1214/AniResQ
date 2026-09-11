import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Animals from './pages/Animals';

const socket = io('http://localhost:5000');

function App() {
  useEffect(() => {
    socket.on('new_rescue', (rescue) => {
      // In a real app, you'd use a toast notification or state management (Redux/Context) to update the UI
      console.log('New rescue reported!', rescue);
      alert(`New rescue reported: ${rescue.description}`);
    });

    return () => {
      socket.off('new_rescue');
    };
  }, []);
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/animals" element={<Animals />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
