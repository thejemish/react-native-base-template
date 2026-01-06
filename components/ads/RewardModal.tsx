import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Reward } from '@/store/ads/rewardedAdsStore';

interface RewardModalProps {
  visible: boolean;
  reward: Reward | null;
  onClose: () => void;
}

export function RewardModal({ visible, reward, onClose }: RewardModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacityAnim, scaleAnim]);

  if (!reward) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: opacityAnim,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}>
          <View style={styles.modalContent}>
            {/* Success Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🎉</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>Reward Earned!</Text>

            {/* Reward Details */}
            <View style={styles.rewardContainer}>
              <Text style={styles.rewardAmount}>{reward.amount}</Text>
              <Text style={styles.rewardType}>{reward.type}</Text>
            </View>

            {/* Message */}
            <Text style={styles.message}>
              Thank you for watching the ad! Your reward has been added to your account.
            </Text>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>Claim Reward</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    padding: theme.margins.xl,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    opacity: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.margins.lg,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.typography,
    marginBottom: theme.margins.lg,
    textAlign: 'center',
  },
  rewardContainer: {
    backgroundColor: theme.colors.typography,
    opacity: 0.05,
    borderRadius: 16,
    paddingVertical: theme.margins.lg,
    paddingHorizontal: theme.margins.xl,
    marginBottom: theme.margins.lg,
    alignItems: 'center',
    minWidth: 200,
  },
  rewardAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.typography,
    marginBottom: theme.margins.sm,
  },
  rewardType: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.typography,
    textTransform: 'capitalize',
  },
  message: {
    fontSize: 14,
    color: theme.colors.typography,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.margins.xl,
    paddingHorizontal: theme.margins.md,
  },
  closeButton: {
    backgroundColor: theme.colors.typography,
    borderRadius: 12,
    paddingVertical: theme.margins.md,
    paddingHorizontal: theme.margins.xl,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.background,
  },
}));

