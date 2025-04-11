// src/pages/Home.js
import { Link } from "react-router-dom";

function Home({ token, setToken, setUser }) {
  // If there's a token, the user is logged in
  if (token) {
    return (
      <div>
        <h1>Welcome!</h1>
        <p>You are logged in.</p>
        <Link to="/profile">Go to Profile</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Home</h1>
      <a href={`${process.env.REACT_APP_API_URL}/auth/google`}>
        <button>Login with Google</button>
      </a>
    </div>
  );
}

export default Home;
