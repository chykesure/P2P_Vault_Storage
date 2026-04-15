/**
 * PasswordSetupModal Component
 * 
 * Modal for creating or entering the master password.
 * Used during initial setup and vault unlock.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

import { MIN_PASSWORD_LENGTH } from '@config/constants';

interface PasswordSetupModalProps {
  visible: boolean;
  mode: 'setup' | 'unlock';
  onSubmit: (password: string) => Promise<void>;
  error?: string | null;
  isLoading?: boolean;
  onForgotPassword?: () => void;
}

export function PasswordSetupModal({
  visible,
  mode,
  onSubmit,
  error,
  isLoading = false,
  onForgotPassword,
}: PasswordSetupModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirmPassword('');
      setLocalError(null);
      setTimeout(() => passwordRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleSubmit = async () => {
    setLocalError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (mode === 'setup' && password !== confirmPassword) {
      setLocalError('Passwords do not match');
      confirmRef.current?.focus();
      return;
    }

    try {
      await onSubmit(password);
    } catch {
      // Error is handled by the context
    }
  };

  const isSetup = mode === 'setup';
  const displayError = localError || error;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Icon
              name={isSetup ? 'shield-checkmark-outline' : 'lock-closed-outline'}
              size={48}
              color="#6C5CE7"
            />
            <Text style={styles.title}>
              {isSetup ? 'Create Vault Password' : 'Unlock Vault'}
            </Text>
            <Text style={styles.subtitle}>
              {isSetup
                ? 'This password protects your encrypted files. It cannot be recovered if lost.'
                : 'Enter your vault password to decrypt your files.'}
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Icon name="key-outline" size={18} color="#636E72" style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#B2BEC3"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => {
                  if (isSetup) confirmRef.current?.focus();
                  else handleSubmit();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#636E72"
                />
              </TouchableOpacity>
            </View>

            {isSetup && (
              <View style={styles.inputWrapper}>
                <Icon name="key-outline" size={18} color="#636E72" style={styles.inputIcon} />
                <TextInput
                  ref={confirmRef}
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#B2BEC3"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onSubmitEditing={handleSubmit}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            )}
          </View>

          {/* Error */}
          {displayError && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle-outline" size={16} color="#E74C3C" />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          {/* Password Strength (setup only) */}
          {isSetup && password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      width: `${Math.min(100, (password.length / 16) * 100)}%`,
                      backgroundColor:
                        password.length < MIN_PASSWORD_LENGTH
                          ? '#E74C3C'
                          : password.length < 12
                          ? '#F39C12'
                          : '#27AE60',
                    },
                  ]}
                />
              </View>
              <Text style={styles.strengthText}>
                {password.length < MIN_PASSWORD_LENGTH
                  ? 'Too short'
                  : password.length < 12
                  ? 'Good'
                  : 'Strong'}
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.submitButtonText}>Processing...</Text>
            ) : (
              <Text style={styles.submitButtonText}>
                {isSetup ? 'Create Vault' : 'Unlock'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password (unlock mode only) */}
          {!isSetup && onForgotPassword && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={onForgotPassword}
              disabled={isLoading}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#636E72',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DFE6E9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
    paddingVertical: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#E74C3C',
    flex: 1,
  },
  strengthContainer: {
    marginBottom: 16,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#DFE6E9',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
    color: '#636E72',
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#A29BFE',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotText: {
    fontSize: 13,
    color: '#E74C3C',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});