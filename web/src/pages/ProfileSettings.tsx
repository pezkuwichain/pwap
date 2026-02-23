import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {  User, Shield, Bell, Palette, ArrowLeft } from 'lucide-react';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
export default function ProfileSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    full_name: '',
    bio: '',
    phone_number: '',
    location: '',
    website: '',
    language: 'en',
    theme: 'light',
    notifications_email: true,
    notifications_push: false,
    notifications_sms: false,
    two_factor_enabled: false
  });

  const loadProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) console.error('Error loading profile:', error);
        return;
      }

      if (data) {
        setProfile({
          username: data.username || '',
          full_name: data.full_name || '',
          bio: data.bio || '',
          phone_number: data.phone_number || '',
          location: data.location || '',
          website: data.website || '',
          language: data.language || 'en',
          theme: data.theme || 'light',
          notifications_email: data.notifications_email ?? true,
          notifications_push: data.notifications_push ?? false,
          notifications_sms: data.notifications_sms ?? false,
          two_factor_enabled: data.two_factor_enabled ?? false
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading profile:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfile();

    }
  }, [user, loadProfile]);

  const updateProfile = async () => {
    setLoading(true);
    try {
      // Call the secure upsert function
      const { error } = await supabase.rpc('upsert_user_profile', {
        p_username: profile.username || '',
        p_full_name: profile.full_name || null,
        p_bio: profile.bio || null,
        p_phone_number: profile.phone_number || null,
        p_location: profile.location || null,
        p_website: profile.website || null,
        p_language: profile.language || 'en',
        p_theme: profile.theme || 'dark',
        p_notifications_email: profile.notifications_email ?? true,
        p_notifications_push: profile.notifications_push ?? false,
        p_notifications_sms: profile.notifications_sms ?? false
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      // Reload profile to ensure state is in sync
      await loadProfile();
     
    } catch (error) {
      if (import.meta.env.DEV) console.error('Profile update failed:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSettings = async () => {
    setLoading(true);
    try {
      // Call the upsert function with current profile data + notification settings
      const { error } = await supabase.rpc('upsert_user_profile', {
        p_username: profile.username || '',
        p_full_name: profile.full_name || null,
        p_bio: profile.bio || null,
        p_phone_number: profile.phone_number || null,
        p_location: profile.location || null,
        p_website: profile.website || null,
        p_language: profile.language || 'en',
        p_theme: profile.theme || 'dark',
        p_notifications_email: profile.notifications_email ?? true,
        p_notifications_push: profile.notifications_push ?? false,
        p_notifications_sms: profile.notifications_sms ?? false
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Notification settings updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update notification settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Security settings updater (for future UI use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateSecuritySettings = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: profile.two_factor_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Security settings updated',
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('Security settings error:', err);
      toast({
        title: 'Error',
        description: 'Failed to update security settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile, user, toast]);

  const changePassword = async () => {
    const newPassword = prompt('Enter new password:');
    if (!newPassword) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password changed successfully',
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('Password change error:', err);
      toast({
        title: 'Error',
        description: 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">{t('profileSettings.title')}</h1>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            {t('profileSettings.profileTab')}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            {t('profileSettings.notificationsTab')}
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            {t('profileSettings.securityTab')}
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette className="mr-2 h-4 w-4" />
            {t('profileSettings.preferencesTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t('profileSettings.profileInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('profileSettings.username')}</Label>
                <Input
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label>{t('profileSettings.fullName')}</Label>
                <Input
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label>{t('profileSettings.bio')}</Label>
                <Textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself"
                  rows={4}
                />
              </div>
              <div>
                <Label>{t('profileSettings.phoneNumber')}</Label>
                <Input
                  value={profile.phone_number}
                  onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <Label>{t('profileSettings.location')}</Label>
                <Input
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="City, Country"
                />
              </div>
              <div>
                <Label>{t('profileSettings.website')}</Label>
                <Input
                  value={profile.website}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <Button onClick={updateProfile} disabled={loading}>
                {t('profileSettings.saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t('profileSettings.notifPreferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('profileSettings.emailNotif')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('profileSettings.emailNotifDesc')}
                  </p>
                </div>
                <Switch
                  checked={profile.notifications_email}
                  onCheckedChange={(checked) =>
                    setProfile({ ...profile, notifications_email: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('profileSettings.pushNotif')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('profileSettings.pushNotifDesc')}
                  </p>
                </div>
                <Switch
                  checked={profile.notifications_push}
                  onCheckedChange={(checked) =>
                    setProfile({ ...profile, notifications_push: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('profileSettings.smsNotif')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('profileSettings.smsNotifDesc')}
                  </p>
                </div>
                <Switch
                  checked={profile.notifications_sms}
                  onCheckedChange={(checked) =>
                    setProfile({ ...profile, notifications_sms: checked })
                  }
                />
              </div>
              <Button onClick={updateNotificationSettings} disabled={loading}>
                {t('profileSettings.savePreferences')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="security">
          <div className="space-y-4">
            <TwoFactorSetup />
            
            <Card>
              <CardHeader>
                <CardTitle>{t('profileSettings.passwordSecurity')}</CardTitle>
                <CardDescription>
                  {t('profileSettings.passwordSecurityDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={changePassword}>
                  {t('profileSettings.changePassword')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>{t('profileSettings.appPreferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('profileSettings.language')}</Label>
                <Select
                  value={profile.language}
                  onValueChange={(value) => setProfile({ ...profile, language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="tr">Türkçe</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="kmr">Kurdî</SelectItem>
                    <SelectItem value="ckb">کوردی</SelectItem>
                    <SelectItem value="fa">فارسی</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('profileSettings.theme')}</Label>
                <Select
                  value={profile.theme}
                  onValueChange={(value) => setProfile({ ...profile, theme: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('profileSettings.themeLight')}</SelectItem>
                    <SelectItem value="dark">{t('profileSettings.themeDark')}</SelectItem>
                    <SelectItem value="system">{t('profileSettings.themeSystem')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={updateProfile} disabled={loading}>
                {t('profileSettings.savePreferences')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}