import { useLocation } from 'react-router-dom';
import AnimatedSignIn from '../components/ui/animated-sign-in';

export default function Login() {
  const location = useLocation();
  const isSignup = location.pathname === '/signup';
  return <AnimatedSignIn initialMode={isSignup ? 'register' : 'login'} />;
}