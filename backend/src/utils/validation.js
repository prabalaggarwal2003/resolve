/**
 * Validation utilities for user input
 */

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  if (email.length > 255) return 'Email must be less than 255 characters';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (password.length > 128) return 'Password must be less than 128 characters';
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
  if (!hasLowerCase) return 'Password must contain at least one lowercase letter';
  if (!hasNumbers) return 'Password must contain at least one number';
  if (!hasSpecialChar) return 'Password must contain at least one special character';
  
  return null;
}

export function validateName(name) {
  if (!name) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters long';
  if (name.trim().length > 100) return 'Name must be less than 100 characters';
  if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
  return null;
}

export function validateOrganizationName(name) {
  if (!name) return 'Organization name is required';
  if (name.trim().length < 2) return 'Organization name must be at least 2 characters long';
  if (name.trim().length > 100) return 'Organization name must be less than 100 characters';
  if (!/^[a-zA-Z0-9\s&.,'-]+$/.test(name.trim())) return 'Organization name contains invalid characters';
  return null;
}

export function validateOtp(code) {
  if (!code) return 'Verification code is required';
  if (!/^\d{6}$/.test(code)) return 'Verification code must be exactly 6 digits';
  return null;
}

export function sanitizeInput(input) {
  return input.trim().replace(/\s+/g, ' ');
}
