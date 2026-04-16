/**
 * Supabase Authentication Middleware
 * 
 * This middleware verifies JWT tokens issued by Supabase and optionally
 * creates/links user accounts in the local database.
 */

const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('./errors');

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key || url === 'https://shgrcngwqdwlnlpkahcz.supabase.co') {
    return null;
  }
  
  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  return supabaseClient;
}

function authMiddleware(req, res, next) {
  const client = getSupabaseClient();
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    if (!client) {
      return next(new AppError('No token provided', 401, 'AUTH_REQUIRED'));
    }
    return next(new AppError('No token provided', 401, 'AUTH_REQUIRED'));
  }
  
  const token = header.split(' ')[1];
  
  if (!client) {
    const jwt = require('jsonwebtoken');
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
    return;
  }
  
  const { data, error } = client.auth.getUser(token);
  
  if (error) {
    return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
  
  if (!data?.user) {
    return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
  
  req.user = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
  };
  req.supabaseToken = token;
  
  next();
}

async function socketAuthMiddleware(socket, next) {
  const client = getSupabaseClient();
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  if (!client) {
    const jwt = require('jsonwebtoken');
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
    return;
  }
  
  const { data, error } = await client.auth.getUser(token);
  
  if (error || !data?.user) {
    return next(new Error('Invalid token'));
  }
  
  socket.user = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
  };
  
  next();
}

function isConfigured() {
  return Boolean(getSupabaseClient());
}

module.exports = { 
  authMiddleware, 
  socketAuthMiddleware,
  isConfigured,
  getSupabaseClient 
}; 