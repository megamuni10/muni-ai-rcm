import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// Client-side auth utilities
export interface UserRole {
  role: 'Admin' | 'Ops' | 'Provider';
  userId?: string;
  email?: string;
  organization?: string;
  permissions: string[];
  isActive?: boolean;
}

// Get current authenticated user and their role
export async function getUserRole(): Promise<UserRole | null> {
  try {
    // Development mode - return mock data
    if (process.env.NODE_ENV === 'development') {
      return {
        role: 'Provider', // Change this to test different roles: 'Admin', 'Ops', 'Provider'
        userId: 'test-user-123',
        email: 'test@example.com',
        organization: 'Community Health Center',
        permissions: getRoleBasedPermissions('Provider'),
        isActive: true,
      };
    }

    // Production - get from Amplify Auth
    const user = await getCurrentUser();
    if (!user) return null;

    // Get user profile from database
    const client = generateClient<Schema>();
    const userProfile = await client.models.UserProfile.get({ userId: user.userId });
    
    if (!userProfile?.data || !userProfile.data.isActive) {
      return null;
    }

    return {
      role: userProfile.data.role as 'Admin' | 'Ops' | 'Provider',
      userId: userProfile.data.userId,
      email: userProfile.data.email,
      organization: userProfile.data.organization || undefined,
      permissions: getRoleBasedPermissions(userProfile.data.role as 'Admin' | 'Ops' | 'Provider'),
      isActive: userProfile.data.isActive,
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

// Server action for getting user role (for server-side operations)
export async function getUserRoleServer(): Promise<UserRole | null> {
  try {
    // Development mode - return mock data
    if (process.env.NODE_ENV === 'development') {
      return {
        role: 'Provider',
        userId: 'test-user-123',
        email: 'test@example.com',
        organization: 'Community Health Center', 
        permissions: getRoleBasedPermissions('Provider'),
        isActive: true,
      };
    }

    // Production - get from server-side Amplify context
    // This would use server-side auth context in production
    const user = await getCurrentUser();
    if (!user) return null;

    const client = generateClient<Schema>();
    const userProfile = await client.models.UserProfile.get({ userId: user.userId });
    
    if (!userProfile?.data || !userProfile.data.isActive) {
      return null;
    }

    return {
      role: userProfile.data.role as 'Admin' | 'Ops' | 'Provider',
      userId: userProfile.data.userId,
      email: userProfile.data.email,
      organization: userProfile.data.organization || undefined,
      permissions: getRoleBasedPermissions(userProfile.data.role as 'Admin' | 'Ops' | 'Provider'),
      isActive: userProfile.data.isActive,
    };
  } catch (error) {
    console.error('Error getting server user role:', error);
    return null;
  }
}

export function hasPermission(userRole: UserRole, permission: string): boolean {
  return userRole.permissions.includes(permission);
}

export function getRoleBasedPermissions(role: 'Admin' | 'Ops' | 'Provider'): string[] {
  switch (role) {
    case 'Admin':
      return [
        'read:all',
        'write:all',
        'delete:all',
        'manage:users',
        'manage:organizations',
        'view:analytics',
        'manage:settings',
      ];
    case 'Ops':
      return [
        'read:claims',
        'write:claims',
        'read:patients',
        'write:patients',
        'read:eligibility',
        'write:eligibility',
        'read:appeals',
        'write:appeals',
        'read:workflows',
        'write:workflows',
        'view:reports',
      ];
    case 'Provider':
      return [
        'read:claims',
        'create:claims',
        'read:patients',
        'write:patients',
        'read:eligibility',
        'view:reports',
      ];
    default:
      return [];
  }
}