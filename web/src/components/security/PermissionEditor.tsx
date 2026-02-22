import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save, RefreshCw, Lock, Unlock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_system: boolean;
}

const PERMISSION_CATEGORIES = {
  governance: {
    titleKey: 'permission.catGovernance',
    permissions: {
      create_proposal: 'permission.createProposals',
      vote_proposal: 'permission.voteOnProposals',
      delegate_vote: 'permission.delegateVoting',
      manage_treasury: 'permission.manageTreasury',
    }
  },
  moderation: {
    titleKey: 'permission.catModeration',
    permissions: {
      moderate_content: 'permission.moderateContent',
      ban_users: 'permission.banUsers',
      delete_posts: 'permission.deletePosts',
      pin_posts: 'permission.pinPosts',
    }
  },
  administration: {
    titleKey: 'permission.catAdministration',
    permissions: {
      manage_users: 'permission.manageUsers',
      manage_roles: 'permission.manageRoles',
      view_analytics: 'permission.viewAnalytics',
      system_settings: 'permission.systemSettings',
    }
  },
  security: {
    titleKey: 'permission.catSecurity',
    permissions: {
      view_audit_logs: 'permission.viewAuditLogs',
      manage_sessions: 'permission.manageSessions',
      configure_2fa: 'permission.configure2fa',
      access_api: 'permission.accessApi',
    }
  }
};

export function PermissionEditor() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      setRoles(data || []);
      if (data && data.length > 0) {
        setSelectedRole(data[0]);
      }
    } catch {
      if (import.meta.env.DEV) console.error('Error loading roles:', error);
      toast({
        title: t('common.error'),
        description: t('permission.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (category: string, permission: string) => {
    if (!selectedRole || selectedRole.is_system) return;

    const fullPermission = `${category}.${permission}`;
    setSelectedRole({
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        [fullPermission]: !selectedRole.permissions[fullPermission]
      }
    });
  };

  const savePermissions = async () => {
    if (!selectedRole) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('roles')
        .update({ permissions: selectedRole.permissions })
        .eq('id', selectedRole.id);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('permission.saved'),
      });
    } catch {
      toast({
        title: t('common.error'),
        description: t('permission.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetPermissions = () => {
    if (!selectedRole) return;
    const original = roles.find(r => r.id === selectedRole.id);
    if (original) {
      setSelectedRole(original);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('permission.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedRole?.id} onValueChange={(id) => {
          const role = roles.find(r => r.id === id);
          if (role) setSelectedRole(role);
        }}>
          <TabsList className="grid grid-cols-4 w-full">
            {roles.map(role => (
              <TabsTrigger key={role.id} value={role.id}>
                {role.name}
                {role.is_system && (
                  <Lock className="h-3 w-3 ml-1" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {selectedRole && (
            <TabsContent value={selectedRole.id} className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{selectedRole.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
                  {selectedRole.is_system && (
                    <Badge variant="secondary" className="mt-2">
                      <Lock className="h-3 w-3 mr-1" />
                      {t('permission.systemRole')}
                    </Badge>
                  )}
                </div>
                {!selectedRole.is_system && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetPermissions}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {t('permission.reset')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={savePermissions}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {t('permission.saveChanges')}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                  <div key={categoryKey} className="space-y-3">
                    <h4 className="font-medium text-sm">{t(category.titleKey)}</h4>
                    <div className="space-y-2">
                      {Object.entries(category.permissions).map(([permKey, permName]) => {
                        const fullPerm = `${categoryKey}.${permKey}`;
                        const isEnabled = selectedRole.permissions[fullPerm] || false;
                        
                        return (
                          <div key={permKey} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              {isEnabled ? (
                                <Unlock className="h-4 w-4 text-green-500" />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">{t(permName)}</span>
                            </div>
                            <Switch
                              checked={isEnabled}
                              disabled={selectedRole.is_system}
                              onCheckedChange={() => togglePermission(categoryKey, permKey)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}