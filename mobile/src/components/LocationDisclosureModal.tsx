/**
 * LocationDisclosureModal.tsx
 * 
 * Google Play-compliant prominent disclosure modal.
 * Must be shown to the user before requesting background location permission.
 * Explains what data is collected, why, when, and how it is used.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface LocationDisclosureModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function LocationDisclosureModal({
  visible,
  onAccept,
  onDecline,
}: LocationDisclosureModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDecline}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="map-pin" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Background Location Access</Text>
          <Text style={styles.subtitle}>
            Skandan Homecarre needs your permission
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="info" size={18} color="#6B2FA0" />
              <Text style={styles.sectionTitle}>What We Collect</Text>
            </View>
            <Text style={styles.sectionText}>
              Your device's GPS location (latitude, longitude, accuracy, and speed)
              is collected periodically during your active duty session.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="help-circle" size={18} color="#6B2FA0" />
              <Text style={styles.sectionTitle}>Why We Need It</Text>
            </View>
            <Text style={styles.sectionText}>
              Location tracking is essential for verifying attendance at assigned
              patient locations, ensuring employee safety during home visits, and
              maintaining accurate duty logs for the organization.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={18} color="#6B2FA0" />
              <Text style={styles.sectionTitle}>When Does It Track</Text>
            </View>
            <Text style={styles.sectionText}>
              Location tracking starts only after you check in for duty and stops
              automatically when you check out. It runs in the background so your
              location can be recorded even when you switch to other apps or lock
              your phone screen.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="wifi-off" size={18} color="#6B2FA0" />
              <Text style={styles.sectionTitle}>Offline Storage</Text>
            </View>
            <Text style={styles.sectionText}>
              If your phone loses internet connection, location data is stored
              securely on your device and automatically uploaded when connectivity
              returns.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="shield" size={18} color="#6B2FA0" />
              <Text style={styles.sectionTitle}>Your Privacy</Text>
            </View>
            <Text style={styles.sectionText}>
              Location data is used solely for duty tracking and attendance
              verification. It is accessible only to authorized administrators.
              You can check out at any time to stop tracking immediately.
            </Text>
          </View>

          <View style={styles.highlightBox}>
            <Feather name="bell" size={16} color="#6B2FA0" />
            <Text style={styles.highlightText}>
              A persistent notification will appear while tracking is active,
              so you always know when your location is being recorded.
            </Text>
          </View>
        </ScrollView>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptButtonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineButton}
            onPress={onDecline}
            activeOpacity={0.85}
          >
            <Text style={styles.declineButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#6B2FA0',
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  sectionText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    paddingLeft: 26,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f3eef8',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    color: '#6B2FA0',
    lineHeight: 20,
    fontWeight: '500',
  },
  buttonContainer: {
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  acceptButton: {
    backgroundColor: '#6B2FA0',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#6B2FA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  declineButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
