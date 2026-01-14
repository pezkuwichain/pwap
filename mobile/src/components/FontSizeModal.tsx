import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { KurdistanColors } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';

interface FontSizeModalProps {
  visible: boolean;
  onClose: () => void;
}

const FontSizeModal: React.FC<FontSizeModalProps> = ({ visible, onClose }) => {
  const { colors, fontSize, setFontSize } = useTheme();
  const styles = createStyles(colors);

  const handleSelectSize = async (size: 'small' | 'medium' | 'large') => {
    await setFontSize(size);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Font Size</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>
              Choose your preferred font size for better readability.
            </Text>

            <TouchableOpacity
              style={[
                styles.sizeOption,
                fontSize === 'small' && styles.sizeOptionSelected,
              ]}
              onPress={() => handleSelectSize('small')}
            >
              <Text style={styles.sizeLabel}>Small</Text>
              <Text style={[styles.sizeExample, { fontSize: 14 }]}>
                The quick brown fox jumps over the lazy dog
              </Text>
              {fontSize === 'small' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sizeOption,
                fontSize === 'medium' && styles.sizeOptionSelected,
              ]}
              onPress={() => handleSelectSize('medium')}
            >
              <Text style={styles.sizeLabel}>Medium (Default)</Text>
              <Text style={[styles.sizeExample, { fontSize: 16 }]}>
                The quick brown fox jumps over the lazy dog
              </Text>
              {fontSize === 'medium' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sizeOption,
                fontSize === 'large' && styles.sizeOptionSelected,
              ]}
              onPress={() => handleSelectSize('large')}
            >
              <Text style={styles.sizeLabel}>Large</Text>
              <Text style={[styles.sizeExample, { fontSize: 18 }]}>
                The quick brown fox jumps over the lazy dog
              </Text>
              {fontSize === 'large' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  sizeOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 12,
    position: 'relative',
  },
  sizeOptionSelected: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: colors.background,
  },
  sizeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sizeExample: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 24,
    color: KurdistanColors.kesk,
    fontWeight: 'bold',
  },
});

export default FontSizeModal;
