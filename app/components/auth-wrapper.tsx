'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import { getUserRole, type UserRole } from '@/lib/auth-utils';
import '@aws-amplify/ui-react/styles.css';

// Auth Context
interface AuthContextType {
  userRole: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      setLoading(true);
      const role = await getUserRole();
      setUserRole(role);
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUserRole(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const contextValue: AuthContextType = {
    userRole,
    loading,
    signOut: handleSignOut,
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Muni Health RCM Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Main Auth Wrapper Component
interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  // In development mode, skip authentication
  if (process.env.NODE_ENV === 'development') {
    return (
      <AuthProvider>
        {children}
      </AuthProvider>
    );
  }

  // Production mode - use Amplify Authenticator
  return (
    <Authenticator 
      loginMechanisms={['email']}
      signUpAttributes={[
        'email',
        'custom:role',
        'custom:organization'
      ]}
      formFields={{
        signUp: {
          'custom:role': {
            label: 'Role',
            placeholder: 'Select your role',
            isRequired: true,
            type: 'select',
            options: [
              { value: 'Provider', label: 'Healthcare Provider' },
              { value: 'Ops', label: 'Operations Team' },
              { value: 'Admin', label: 'Administrator' }
            ]
          },
          'custom:organization': {
            label: 'Organization',
            placeholder: 'Enter your organization name',
            isRequired: true,
          }
        }
      }}
      components={{
        Header() {
          return (
            <div className="auth-header">
              <h1>🏥 Muni Health RCM Platform</h1>
              <p>AI-native Revenue Cycle Management</p>
            </div>
          );
        },
        Footer() {
          return (
            <div className="auth-footer">
              <p>Secure, HIPAA-compliant healthcare billing automation</p>
            </div>
          );
        }
      }}
    >
      {({ signOut, user }) => (
        <AuthProvider>
          {children}
        </AuthProvider>
      )}
    </Authenticator>
  );
}

// Loading Screen Styles (inline for simplicity)
const loadingStyles = `
  .loading-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #f8fafc;
  }
  
  .loading-spinner {
    text-align: center;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .loading-spinner p {
    color: #64748b;
    font-size: 1.1rem;
    margin: 0;
  }
  
  .auth-header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .auth-header h1 {
    margin: 0 0 8px 0;
    font-size: 2rem;
    color: #1e293b;
  }
  
  .auth-header p {
    margin: 0;
    color: #64748b;
    font-size: 1rem;
  }
  
  .auth-footer {
    text-align: center;
    margin-top: 20px;
  }
  
  .auth-footer p {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = loadingStyles;
  document.head.appendChild(styleElement);
}