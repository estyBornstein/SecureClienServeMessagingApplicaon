import { useAuth } from './hooks/useAuth';
import AuthPage from './components/Auth/AuthPage';
import ChatPage from './components/Chat/ChatPage';
import LoadingSpinner from './components/Common/LoadingSpinner';
import './App.css';

function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Secure Messaging</h1>
        <div className="user-info">
          <span>שלום, {user.username}</span>
          <button onClick={logout}>התנתק</button>
        </div>
      </header>
      <main className="app-main">
        <ChatPage />
      </main>
    </div>
  );
}

export default App;
