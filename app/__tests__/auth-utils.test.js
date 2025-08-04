/**
 * Unit tests for authentication utilities
 */

const { getRoleBasedPermissions, hasPermission } = require('../lib/auth-utils');

describe('Authentication Utils', () => {
  describe('getRoleBasedPermissions', () => {
    test('Admin should have all permissions', () => {
      const permissions = getRoleBasedPermissions('Admin');
      
      expect(permissions).toContain('read:all');
      expect(permissions).toContain('write:all');
      expect(permissions).toContain('delete:all');
      expect(permissions).toContain('manage:users');
      expect(permissions).toContain('manage:organizations');
      expect(permissions).toContain('view:analytics');
      expect(permissions).toContain('manage:settings');
    });

    test('Ops should have operational permissions', () => {
      const permissions = getRoleBasedPermissions('Ops');
      
      expect(permissions).toContain('read:claims');
      expect(permissions).toContain('write:claims');
      expect(permissions).toContain('read:patients');
      expect(permissions).toContain('write:patients');
      expect(permissions).toContain('read:eligibility');
      expect(permissions).toContain('write:eligibility');
      expect(permissions).toContain('read:appeals');
      expect(permissions).toContain('write:appeals');
      expect(permissions).toContain('read:workflows');
      expect(permissions).toContain('write:workflows');
      expect(permissions).toContain('view:reports');
      
      // Should not have admin permissions
      expect(permissions).not.toContain('manage:users');
      expect(permissions).not.toContain('delete:all');
    });

    test('Provider should have limited permissions', () => {
      const permissions = getRoleBasedPermissions('Provider');
      
      expect(permissions).toContain('read:claims');
      expect(permissions).toContain('create:claims');
      expect(permissions).toContain('read:patients');
      expect(permissions).toContain('write:patients');
      expect(permissions).toContain('read:eligibility');
      expect(permissions).toContain('view:reports');
      
      // Should not have write access to all claims or admin functions
      expect(permissions).not.toContain('write:claims');
      expect(permissions).not.toContain('manage:users');
      expect(permissions).not.toContain('delete:all');
    });

    test('Invalid role should return empty permissions', () => {
      const permissions = getRoleBasedPermissions('InvalidRole');
      expect(permissions).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    test('should correctly check Admin permissions', () => {
      const adminUser = {
        role: 'Admin',
        permissions: getRoleBasedPermissions('Admin')
      };
      
      expect(hasPermission(adminUser, 'read:all')).toBe(true);
      expect(hasPermission(adminUser, 'manage:users')).toBe(true);
      expect(hasPermission(adminUser, 'delete:all')).toBe(true);
    });

    test('should correctly check Provider permissions', () => {
      const providerUser = {
        role: 'Provider',
        permissions: getRoleBasedPermissions('Provider')
      };
      
      expect(hasPermission(providerUser, 'read:claims')).toBe(true);
      expect(hasPermission(providerUser, 'create:claims')).toBe(true);
      expect(hasPermission(providerUser, 'write:claims')).toBe(false);
      expect(hasPermission(providerUser, 'manage:users')).toBe(false);
    });

    test('should return false for non-existent permissions', () => {
      const providerUser = {
        role: 'Provider',
        permissions: getRoleBasedPermissions('Provider')
      };
      
      expect(hasPermission(providerUser, 'nonexistent:permission')).toBe(false);
    });
  });

  describe('Role hierarchy validation', () => {
    test('Admin should have more permissions than Ops', () => {
      const adminPerms = getRoleBasedPermissions('Admin');
      const opsPerms = getRoleBasedPermissions('Ops');
      
      expect(adminPerms.length).toBeGreaterThan(opsPerms.length);
      
      // Admin should have all ops permissions plus more
      const uniqueToAdmin = adminPerms.filter(perm => !opsPerms.includes(perm));
      expect(uniqueToAdmin.length).toBeGreaterThan(0);
    });

    test('Ops should have more permissions than Provider', () => {
      const opsPerms = getRoleBasedPermissions('Ops');
      const providerPerms = getRoleBasedPermissions('Provider');
      
      expect(opsPerms.length).toBeGreaterThan(providerPerms.length);
      
      // Ops should have some permissions that Provider doesn't
      const uniqueToOps = opsPerms.filter(perm => !providerPerms.includes(perm));
      expect(uniqueToOps.length).toBeGreaterThan(0);
    });
  });
});