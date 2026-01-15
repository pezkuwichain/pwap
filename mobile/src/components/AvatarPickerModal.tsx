import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { KurdistanColors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Cross-platform alert helper
const showAlert = (title: string, message: string, buttons?: Array<{text: string; onPress?: () => void}>) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (buttons?.[0]?.onPress) buttons[0].onPress();
  } else {
    showAlert(title, message, buttons);
  }
};

// Avatar pool - Kurdish/Middle Eastern themed avatars
const AVATAR_POOL = [
  { id: 'avatar1', emoji: '👨🏻', label: 'Man 1' },
  { id: 'avatar2', emoji: '👨🏼', label: 'Man 2' },
  { id: 'avatar3', emoji: '👨🏽', label: 'Man 3' },
  { id: 'avatar4', emoji: '👨🏾', label: 'Man 4' },
  { id: 'avatar5', emoji: '👩🏻', label: 'Woman 1' },
  { id: 'avatar6', emoji: '👩🏼', label: 'Woman 2' },
  { id: 'avatar7', emoji: '👩🏽', label: 'Woman 3' },
  { id: 'avatar8', emoji: '👩🏾', label: 'Woman 4' },
  { id: 'avatar9', emoji: '🧔🏻', label: 'Beard 1' },
  { id: 'avatar10', emoji: '🧔🏼', label: 'Beard 2' },
  { id: 'avatar11', emoji: '🧔🏽', label: 'Beard 3' },
  { id: 'avatar12', emoji: '🧔🏾', label: 'Beard 4' },
  { id: 'avatar13', emoji: '👳🏻‍♂️', label: 'Turban 1' },
  { id: 'avatar14', emoji: '👳🏼‍♂️', label: 'Turban 2' },
  { id: 'avatar15', emoji: '👳🏽‍♂️', label: 'Turban 3' },
  { id: 'avatar16', emoji: '🧕🏻', label: 'Hijab 1' },
  { id: 'avatar17', emoji: '🧕🏼', label: 'Hijab 2' },
  { id: 'avatar18', emoji: '🧕🏽', label: 'Hijab 3' },
  { id: 'avatar19', emoji: '👴🏻', label: 'Elder 1' },
  { id: 'avatar20', emoji: '👴🏼', label: 'Elder 2' },
  { id: 'avatar21', emoji: '👵🏻', label: 'Elder Woman 1' },
  { id: 'avatar22', emoji: '👵🏼', label: 'Elder Woman 2' },
  { id: 'avatar23', emoji: '👦🏻', label: 'Boy 1' },
  { id: 'avatar24', emoji: '👦🏼', label: 'Boy 2' },
  { id: 'avatar25', emoji: '👧🏻', label: 'Girl 1' },
  { id: 'avatar26', emoji: '👧🏼', label: 'Girl 2' },
];

interface AvatarPickerModalProps {
  visible: boolean;
  onClose: () => void;
  currentAvatar?: string;
  onAvatarSelected?: (avatarUrl: string) => void;
}

const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  visible,
  onClose,
  currentAvatar,
  onAvatarSelected,
}) => {
  const { user } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar || null);
  const [uploadedImageUri, setUploadedImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    setUploadedImageUri(null); // Clear uploaded image when selecting from pool
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload your photo!'
        );
        return false;
      }
    }
    return true;
  };

  const handlePickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        const imageUri = result.assets[0].uri;

        if (__DEV__) console.log('[AvatarPicker] Uploading image:', imageUri);

        // Upload to Supabase Storage
        const uploadedUrl = await uploadImageToSupabase(imageUri);

        setIsUploading(false);

        if (uploadedUrl) {
          if (__DEV__) console.log('[AvatarPicker] Upload successful:', uploadedUrl);
          setUploadedImageUri(uploadedUrl);
          setSelectedAvatar(null); // Clear emoji selection
          showAlert('Success', 'Photo uploaded successfully!');
        } else {
          if (__DEV__) console.error('[AvatarPicker] Upload failed: no URL returned');
          showAlert('Upload Failed', 'Could not upload your photo. Please check your internet connection and try again.');
        }
      }
    } catch (error) {
      setIsUploading(false);
      if (__DEV__) console.error('[AvatarPicker] Error picking image:', error);
      showAlert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImageToSupabase = async (imageUri: string): Promise<string | null> => {
    if (!user) {
      console.error('[AvatarPicker] No user found');
      return null;
    }

    try {
      console.log('[AvatarPicker] Starting upload for URI:', imageUri.substring(0, 50) + '...');

      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      console.log('[AvatarPicker] Blob created - size:', blob.size, 'bytes, type:', blob.type);

      if (blob.size === 0) {
        console.error('[AvatarPicker] Blob is empty!');
        return null;
      }

      // Get file extension from blob type or URI
      let fileExt = 'jpg';
      if (blob.type) {
        // Extract extension from MIME type (e.g., 'image/jpeg' -> 'jpeg')
        const mimeExt = blob.type.split('/')[1];
        if (mimeExt && mimeExt !== 'octet-stream') {
          fileExt = mimeExt === 'jpeg' ? 'jpg' : mimeExt;
        }
      } else if (!imageUri.startsWith('blob:') && !imageUri.startsWith('data:')) {
        // Try to get extension from URI for non-blob URIs
        const uriExt = imageUri.split('.').pop()?.toLowerCase();
        if (uriExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(uriExt)) {
          fileExt = uriExt;
        }
      }

      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const contentType = blob.type || `image/${fileExt}`;

      console.log('[AvatarPicker] Uploading to path:', filePath, 'contentType:', contentType);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: contentType,
          upsert: true, // Allow overwriting if file exists
        });

      if (uploadError) {
        console.error('[AvatarPicker] Supabase upload error:', uploadError.message, uploadError);
        // Show more specific error to user
        showAlert('Upload Error', `Storage error: ${uploadError.message}`);
        return null;
      }

      console.log('[AvatarPicker] Upload successful:', uploadData);

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('[AvatarPicker] Public URL:', data.publicUrl);

      return data.publicUrl;
    } catch (error: any) {
      console.error('[AvatarPicker] Error uploading to Supabase:', error?.message || error);
      showAlert('Upload Error', `Failed to upload: ${error?.message || 'Unknown error'}`);
      return null;
    }
  };

  const handleSave = async () => {
    const avatarToSave = uploadedImageUri || selectedAvatar;

    if (!avatarToSave || !user) {
      showAlert('Error', 'Please select an avatar or upload a photo');
      return;
    }

    if (__DEV__) console.log('[AvatarPicker] Saving avatar:', avatarToSave);

    setIsSaving(true);

    try {
      // Update avatar in Supabase profiles table
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarToSave })
        .eq('id', user.id)
        .select();

      if (error) {
        if (__DEV__) console.error('[AvatarPicker] Save error:', error);
        throw error;
      }

      if (__DEV__) console.log('[AvatarPicker] Avatar saved successfully:', data);

      showAlert('Success', 'Avatar updated successfully!');

      if (onAvatarSelected) {
        onAvatarSelected(avatarToSave);
      }

      onClose();
    } catch (error) {
      if (__DEV__) console.error('[AvatarPicker] Error updating avatar:', error);
      showAlert('Error', 'Failed to update avatar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Avatar</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Upload Photo Button */}
          <View style={styles.uploadSection}>
            <TouchableOpacity
              style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
              onPress={handlePickImage}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={KurdistanColors.spi} size="small" />
              ) : (
                <>
                  <Text style={styles.uploadButtonIcon}>📷</Text>
                  <Text style={styles.uploadButtonText}>Upload Your Photo</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Uploaded Image Preview */}
            {uploadedImageUri && (
              <View style={styles.uploadedPreview}>
                <Image source={{ uri: uploadedImageUri }} style={styles.uploadedImage} />
                <TouchableOpacity
                  style={styles.removeUploadButton}
                  onPress={() => setUploadedImageUri(null)}
                >
                  <Text style={styles.removeUploadText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CHOOSE FROM POOL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Avatar Grid */}
          <ScrollView style={styles.avatarScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.avatarGrid}>
              {AVATAR_POOL.map((avatar) => (
                <TouchableOpacity
                  key={avatar.id}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === avatar.id && styles.avatarOptionSelected,
                  ]}
                  onPress={() => handleAvatarSelect(avatar.id)}
                >
                  <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                  {selectedAvatar === avatar.id && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={KurdistanColors.spi} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Avatar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: KurdistanColors.spi,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  avatarScroll: {
    padding: 20,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  avatarOption: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: '#E8F5E9',
  },
  avatarEmoji: {
    fontSize: 36,
  },
  selectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    fontSize: 14,
    color: KurdistanColors.spi,
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  uploadSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonIcon: {
    fontSize: 20,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.spi,
  },
  uploadedPreview: {
    marginTop: 12,
    alignItems: 'center',
    position: 'relative',
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: KurdistanColors.kesk,
  },
  removeUploadButton: {
    position: 'absolute',
    top: -4,
    right: '38%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: KurdistanColors.sor,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.3)',
    elevation: 4,
  },
  removeUploadText: {
    color: KurdistanColors.spi,
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
});

export default AvatarPickerModal;
