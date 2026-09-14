import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>FloodLink AI preferences</Text>
          </View>
        </View>

        {/* Pilot Area */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PILOT AREA</Text>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>📍</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Velachery</Text>
              <Text style={styles.cardSubtitle}>Chennai, Tamil Nadu</Text>
            </View>

            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Data Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA MODE</Text>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🧪</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Demo Data</Text>
              <Text style={styles.cardSubtitle}>
                Simulated environmental conditions
              </Text>
            </View>

            <View style={styles.demoBadge}>
              <Text style={styles.demoText}>DEMO</Text>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBox}>
                <Text style={styles.icon}>🔔</Text>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Notifications</Text>
                <Text style={styles.cardSubtitle}>
                  Receive flood monitoring updates
                </Text>
              </View>
            </View>

            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#D5DDE5', true: '#8FC4EA' }}
              thumbColor={notifications ? '#1769AA' : '#F4F4F4'}
            />
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBox}>
                <Text style={styles.icon}>🚨</Text>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Critical Alerts</Text>
                <Text style={styles.cardSubtitle}>
                  Get high-risk flood warnings
                </Text>
              </View>
            </View>

            <Switch
              value={criticalAlerts}
              onValueChange={setCriticalAlerts}
              trackColor={{ false: '#D5DDE5', true: '#F3A0A0' }}
              thumbColor={criticalAlerts ? '#D32F2F' : '#F4F4F4'}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>

          <View style={styles.aboutCard}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>F</Text>
            </View>

            <Text style={styles.aboutTitle}>FloodLink AI</Text>

            <Text style={styles.aboutDescription}>
              From Rainfall to Road-Level Action
            </Text>

            <View style={styles.divider} />

            <Text style={styles.aboutInfo}>
              Smart India Hackathon 2026
            </Text>

            <Text style={styles.aboutInfo}>
              SIH26085 • Urban Flood Nowcasting
            </Text>

            <Text style={styles.version}>Version 1.0.0 • Demo Prototype</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerIcon}>ℹ️</Text>

          <Text style={styles.disclaimerText}>
            Flood risk values and alerts shown in this prototype are simulated
            demo values. Real-time data, GIS layers and AI predictions will be
            connected during backend integration.
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FB',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    elevation: 2,
  },

  backText: {
    fontSize: 34,
    color: '#1769AA',
    marginTop: -4,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#172B3A',
  },

  subtitle: {
    fontSize: 13,
    color: '#71808E',
    marginTop: 3,
  },

  section: {
    marginHorizontal: 20,
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7B8A97',
    letterSpacing: 1,
    marginBottom: 9,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },

  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },

  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  iconBox: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#EEF6FC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    fontSize: 20,
  },

  cardContent: {
    flex: 1,
    marginLeft: 12,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#20313F',
  },

  cardSubtitle: {
    fontSize: 12,
    color: '#7A8995',
    marginTop: 3,
  },

  activeBadge: {
    backgroundColor: '#E5F6EC',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  activeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#218A4A',
  },

  demoBadge: {
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  demoText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A56A00',
  },

  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    elevation: 2,
  },

  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1769AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  aboutTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#172B3A',
  },

  aboutDescription: {
    fontSize: 13,
    color: '#6F7E8B',
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#E7EDF2',
    width: '100%',
    marginVertical: 16,
  },

  aboutInfo: {
    fontSize: 12,
    color: '#536574',
    marginBottom: 5,
    textAlign: 'center',
  },

  version: {
    fontSize: 11,
    color: '#9AA6AF',
    marginTop: 8,
  },

  disclaimer: {
    marginHorizontal: 20,
    backgroundColor: '#EEF6FC',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
  },

  disclaimerIcon: {
    fontSize: 17,
    marginRight: 9,
  },

  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#607789',
  },
});