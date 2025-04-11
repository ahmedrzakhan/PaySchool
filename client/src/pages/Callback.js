// src/pages/Callback.js
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Callback({ setToken, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extract token and user from query parameters
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const user = params.get("user");

    if (token && user) {
      localStorage.setItem("token", token);
      setToken(token);
      setUser(JSON.parse(decodeURIComponent(user)));
      navigate("/profile");
    } else {
      console.error("Token or user not found in callback");
      navigate("/");
    }
  }, [navigate, setToken, setUser]);

  return <div>Loading...</div>;
}

export default Callback;
