"use client";

import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  GitFork,
  AtSign,
  Globe,
  Sun,
  Moon,
} from "lucide-react";
import "../../index.css";
import { useAuth } from "../../hooks/useAuth";

interface AnimatedSignInProps {
  initialMode?: "login" | "register";
}

const AnimatedSignIn: React.FC<AnimatedSignInProps> = ({ initialMode = "login" }) => {
  const { login, register, resetPassword, usingSupabase } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const validateEmail = (value: string) => {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(value).toLowerCase());
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError("");
    if (e.target.value) {
      setIsEmailValid(validateEmail(e.target.value));
    } else {
      setIsEmailValid(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormSubmitted(true);

    if (!email || !password || !validateEmail(email) || (mode === "register" && !name.trim())) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }

      const form = document.querySelector(".login-form") as HTMLElement | null;
      if (form) {
        form.classList.add("form-success");
        setTimeout(() => {
          form.classList.remove("form-success");
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark-mode");
  };

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDarkMode(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add("dark-mode");
    }
  }, []);

  useEffect(() => {
    const canvas = document.getElementById("particles") as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.color = isDarkMode
          ? `rgba(255, 255, 255, ${Math.random() * 0.2})`
          : `rgba(0, 0, 100, ${Math.random() * 0.2})`;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
      }

      draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(
      100,
      Math.floor((canvas.width * canvas.height) / 15000)
    );

    for (let i = 0; i < particleCount; i += 1) {
      particles.push(new Particle());
    }

    let animationFrame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        particle.update();
        particle.draw();
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      cancelAnimationFrame(animationFrame);
    };
  }, [isDarkMode]);

  return (
    <div className={`login-container ${isDarkMode ? "dark" : "light"}`}>
      <canvas id="particles" className="particles-canvas"></canvas>

      <button className="theme-toggle" onClick={toggleDarkMode} type="button">
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="login-card">
        <div className="login-card-inner">
          <div className="login-header">
            <h1>{mode === "login" ? "Welcome" : "Create your account"}</h1>
            <p>{mode === "login" ? "Please sign in to continue" : "Register to start chatting and collaborating"}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className={`form-field ${isNameFocused || name ? "active" : ""}`}>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  onFocus={() => setIsNameFocused(true)}
                  onBlur={() => setIsNameFocused(false)}
                  required
                />
                <label htmlFor="name">Display Name</label>
              </div>
            )}

            <div
              className={`form-field ${
                isEmailFocused || email ? "active" : ""
              } ${!isEmailValid && email ? "invalid" : ""}`}
            >
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
                required
              />
              <label htmlFor="email">Email Address</label>
              {!isEmailValid && email && (
                <span className="error-message">
                  Please enter a valid email
                </span>
              )}
            </div>

            <div
              className={`form-field ${
                isPasswordFocused || password ? "active" : ""
              }`}
            >
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                required
              />
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <span className="checkmark"></span>
                Remember me
              </label>

<button 
                type="button" 
                className="forgot-password"
                onClick={async () => {
                  if (mode === "login" && usingSupabase && email) {
                    setSubmitting(true);
                    try {
                      await resetPassword(email.trim());
                      setResetSent(true);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to send reset email");
                    } finally {
                      setSubmitting(false);
                    }
                  }
                }}
                disabled={mode !== "login" || !usingSupabase}
              >
                {mode === "login" ? "Forgot Password?" : "Secure sign-up"}
              </button>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={
                submitting ||
                (isFormSubmitted &&
                  (!email || !password || !isEmailValid || (mode === "register" && !name.trim())))
              }
            >
              {submitting ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>

            {resetSent && (
              <p className="success-message" style={{ marginTop: 12 }}>
                Password reset email sent! Check your inbox.
              </p>
            )}
            {error && <p className="error-message" style={{ marginTop: 12 }}>{error}</p>}
          </form>

          <div className="separator">
            <span>or continue with</span>
          </div>

          <div className="social-login">
            <button className="social-button github" type="button">
              <GitFork size={18} />
            </button>
            <button className="social-button twitter" type="button">
              <AtSign size={18} />
            </button>
            <button className="social-button linkedin" type="button">
              <Globe size={18} />
            </button>
          </div>

          <p className="signup-prompt">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="forgot-password"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setIsFormSubmitted(false);
              }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnimatedSignIn;


