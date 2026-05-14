/**
 * ErrorBoundary Component
 *
 * Catches unhandled React errors and displays a nice dismissable modal
 * instead of the ugly red screen of death.
 */

import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons as Icon } from '@expo/vector-icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Modal
          visible={true}
          animationType="fade"
          transparent={true}
          supportedOrientations={['portrait', 'landscape']}
        >
          <SafeAreaView style={styles.overlay}>
            <View style={styles.modalContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Icon name="warning-outline" size={28} color="#FFF" />
                </View>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.subtitle}>
                  An unexpected error occurred. You can dismiss this or try again.
                </Text>
              </View>

              {/* Error Details */}
              <ScrollView style={styles.errorScroll} bounces={false}>
                <View style={styles.errorBox}>
                  <Text style={styles.errorText} selectable>
                    {this.state.error?.message || 'Unknown error'}
                  </Text>
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                  <Icon name="refresh-outline" size={18} color="#FFF" />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dismissButton} onPress={this.handleDismiss}>
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  errorScroll: {
    maxHeight: 150,
    paddingHorizontal: 24,
  },
  errorBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECF0F1',
  },
  errorText: {
    fontSize: 12,
    color: '#E74C3C',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  actions: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dismissButtonText: {
    color: '#636E72',
    fontSize: 14,
    fontWeight: '500',
  },
});
