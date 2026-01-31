/**
 * Frontend validation utilities
 */

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  if (email.length > 255) return 'Email must be less than 255 characters';
  return null;
}

export function validatePassword(password: string): string | null {
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

export function validateName(name: string): string | null {
  if (!name) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters long';
  if (name.trim().length > 100) return 'Name must be less than 100 characters';
  if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
  return null;
}

export function validateOrganizationName(name: string): string | null {
  if (!name) return 'Organization name is required';
  if (name.trim().length < 2) return 'Organization name must be at least 2 characters long';
  if (name.trim().length > 100) return 'Organization name must be less than 100 characters';
  if (!/^[a-zA-Z0-9\s&.,'-]+$/.test(name.trim())) return 'Organization name contains invalid characters';
  return null;
}

export function validateOtp(code: string): string | null {
  if (!code) return 'Verification code is required';
  if (!/^\d{6}$/.test(code)) return 'Verification code must be exactly 6 digits';
  return null;
}

export function getPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  color: string;
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length >= 8) score += 1;
  else feedback.push('Add at least 8 characters');
  
  if (password.length >= 12) score += 1;
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Add numbers');
  
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('Add special characters');
  
  let color = 'red';
  if (score >= 5) color = 'green';
  else if (score >= 3) color = 'yellow';
  else if (score >= 2) color = 'orange';
  
  return { score, feedback, color };
}
