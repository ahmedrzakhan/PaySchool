// src/App.js
import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Callback from "./pages/Callback";
import { useState } from "react";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  // Function to handle logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              <Home token={token} setToken={setToken} setUser={setUser} />
            }
          />
          <Route
            path="/profile"
            element={
              token ? (
                <Profile
                  user={user}
                  setUser={setUser}
                  token={token}
                  handleLogout={handleLogout}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />
          <Route
            path="/callback"
            element={<Callback setToken={setToken} setUser={setUser} />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
