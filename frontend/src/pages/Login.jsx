import { useLocation } from 'react-router-dom';
import AnimatedSignIn from '../components/ui/animated-sign-in';
import LoginBackground from '../components/LoginBackground';

export default function Login() {
  const location = useLocation();
  const isSignup = location.pathname === '/signup';
  
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      <LoginBackground />
      <AnimatedSignIn initialMode={isSignup ? 'register' : 'login'} />
    </div>
  );
}