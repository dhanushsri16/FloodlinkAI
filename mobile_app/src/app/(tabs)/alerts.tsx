import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import {
  getFloodRisk,
  FloodPrediction,
} from '../../services/api';

type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

type FloodZone = {
  name: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_level: string;
};

type FloodRiskData = {
  location: string;
  risk_score: number;
  risk_level: RiskLevel;

  rainfall: number;
  rainfall_unit: string;

  rainfall_status?: string;
  rainfall_source?: string;

  estimated_onset_minutes: number;
  high_risk_roads: number;

  risk_zones?: FloodZone[];
};

type AlertHistoryItem = {
  id: string;
  timestamp: string;
  level: RiskLevel;
  score: number;
  rainfall: number;
  rainfall_unit: string;
  location: string;
};

type AlertConfig = {
  title: string;
  message: string;
  color: string;
  background: string;
  icon: string;
  recommendationTitle: string;
  recommendationText: string;
};

const HISTORY_KEY = '@floodlink_alert_history';
const PREVIOUS_ALERT_KEY = '@floodlink_previous_alert';

function getSeverity(level: RiskLevel) {
  if (level === 'CRITICAL') return 3;
  if (level === 'HIGH') return 2;
  if (level === 'MODERATE') return 1;
  return 0;
}

function getAlertConfig(score: number): AlertConfig {
  if (score >= 80) {
    return {
      title: 'CRITICAL FLOOD ALERT',
      message:
        'Critical flood conditions are predicted. Immediate attention is required for vulnerable roads and low-lying areas.',
      color: '#B71C1C',
      background: '#FFF0F0',
      icon: '🚨',
      recommendationTitle: 'Immediate Action Required',
      recommendationText:
        'Prioritize vulnerable roads, activate available pumping infrastructure, and consider restricting access to high-risk locations.',
    };
  }

  if (score >= 65) {
    return {
      title: 'FLOOD WARNING',
      message:
        'FloodLink AI has detected a high flood-risk scenario. Vulnerable roads and drainage conditions should be monitored closely.',
      color: '#D32F2F',
      background: '#FFF1F1',
      icon: '⚠️',
      recommendationTitle: 'Immediate Monitoring Recommended',
      recommendationText:
        'Monitor high-risk roads and drainage conditions. Prepare pumping infrastructure and consider restricting vulnerable road access if risk increases.',
    };
  }

  if (score >= 40) {
    return {
      title: 'FLOOD WATCH',
      message:
        'Moderate flood risk has been detected. Conditions should be monitored for further rainfall and rising flood risk.',
      color: '#EF6C00',
      background: '#FFF7E8',
      icon: '🌧️',
      recommendationTitle: 'Continue Monitoring',
      recommendationText:
        'Keep monitoring rainfall, drainage conditions and vulnerable roads. Be prepared to escalate response if the risk score increases.',
    };
  }

  return {
    title: 'LOW FLOOD RISK',
    message:
      'Current conditions indicate a low flood risk for the pilot area. No active flood warning is currently generated.',
    color: '#2E7D32',
    background: '#EEF8F0',
    icon: '✅',
    recommendationTitle: 'Normal Monitoring',
    recommendationText:
      'Continue routine monitoring of rainfall and drainage conditions. No immediate intervention is recommended.',
  };
}

function getLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  return 'LOW';
}

function getLevelColor(level: RiskLevel) {
  if (level === 'CRITICAL') return '#B71C1C';
  if (level === 'HIGH') return '#D32F2F';
  if (level === 'MODERATE') return '#EF6C00';
  return '#2E7D32';
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Convert backend onset text into minutes
 * so the existing UI can continue showing:
 * "15 min onset", "30 min onset", etc.
 */
function convertOnsetToMinutes(onset?: string): number {
  if (!onset) return 0;

  const value = onset.toLowerCase();

  if (value.includes('15-30')) return 15;
  if (value.includes('30-60')) return 30;
  if (value.includes('1-2')) return 60;
  if (value.includes('2+')) return 120;

  return 0;
}

/**
 * Convert the new FloodLink backend response
 * into the data structure expected by this existing UI.
 */
function mapFloodRiskData(result: FloodPrediction): FloodRiskData {
  const rainfall = Number(result.rainfall_mm_hr) || 0;

  const riskScore = Number(result.risk_score) || 0;

  const riskLevel = getLevelFromScore(riskScore);

  /**
   * IMPORTANT:
   * The current backend gives the pilot-area risk,
   * but does not yet return a real list of individual roads.
   *
   * Therefore we do NOT invent road-level data here.
   *
   * If the backend later returns risk_zones,
   * this screen can display them automatically.
   */
  const riskZones: FloodZone[] =
    Array.isArray((result as any).risk_zones)
      ? (result as any).risk_zones
      : [];

  const highRiskRoads = riskZones.filter(
    (zone) =>
      Number(zone.risk_score) >= 65 ||
      zone.risk_level === 'HIGH' ||
      zone.risk_level === 'CRITICAL'
  ).length;

  return {
    location: result.location,

    risk_score: riskScore,

    risk_level: riskLevel,

    rainfall,

    /**
     * Open-Meteo precipitation is represented in mm
     * by the current FloodLink API response.
     */
    rainfall_unit: 'mm',

    rainfall_status: result.rainfall_status,

    rainfall_source: result.rainfall_source,

    estimated_onset_minutes: convertOnsetToMinutes(
      result.onset_estimate
    ),

    high_risk_roads: highRiskRoads,

    risk_zones: riskZones,
  };
}

export default function AlertsScreen() {
  const [data, setData] = useState<FloodRiskData | null>(null);

  const [history, setHistory] =
    useState<AlertHistoryItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [isNewAlert, setIsNewAlert] = useState(false);

  const [previousLevel, setPreviousLevel] =
    useState<RiskLevel | null>(null);

  async function loadAlertData(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      // Get LIVE FloodLink backend data
      const result = await getFloodRisk();

      console.log('FloodLink Alert API:', result);

      // Convert API response to existing UI structure
      const mappedData = mapFloodRiskData(result);

      setData(mappedData);

      const currentLevel = mappedData.risk_level;

      // Load alert history
      const savedHistory =
        await AsyncStorage.getItem(HISTORY_KEY);

      const savedPrevious =
        await AsyncStorage.getItem(PREVIOUS_ALERT_KEY);

      const oldHistory: AlertHistoryItem[] =
        savedHistory ? JSON.parse(savedHistory) : [];

      const oldLevel: RiskLevel | null =
        savedPrevious ? JSON.parse(savedPrevious) : null;

      setPreviousLevel(oldLevel);

      // Compare current and previous severity
      const currentSeverity =
        getSeverity(currentLevel);

      const previousSeverity =
        oldLevel !== null
          ? getSeverity(oldLevel)
          : -1;

      const escalated =
        oldLevel !== null &&
        currentSeverity > previousSeverity;

      setIsNewAlert(escalated);

      // Create history item from LIVE API
      const newHistoryItem: AlertHistoryItem = {
        id: `${Date.now()}`,

        timestamp: new Date().toISOString(),

        level: currentLevel,

        score: mappedData.risk_score,

        rainfall: mappedData.rainfall,

        rainfall_unit: mappedData.rainfall_unit,

        location: mappedData.location,
      };

      let updatedHistory = oldHistory;

      /*
       * Add history when:
       * 1. First run
       * 2. Risk level changes
       * 3. Risk score changes by >= 5
       */
      const lastItem = oldHistory[0];

      const shouldAddHistory =
        !lastItem ||
        lastItem.level !== currentLevel ||
        Math.abs(
          lastItem.score - mappedData.risk_score
        ) >= 5;

      if (shouldAddHistory) {
        updatedHistory = [
          newHistoryItem,
          ...oldHistory,
        ].slice(0, 10);

        setHistory(updatedHistory);

        await AsyncStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(updatedHistory)
        );
      } else {
        setHistory(oldHistory);
      }

      // Save current risk level
      await AsyncStorage.setItem(
        PREVIOUS_ALERT_KEY,
        JSON.stringify(currentLevel)
      );
    } catch (error) {
      console.error(
        'Alert data error:',
        error
      );

      Alert.alert(
        'Unable to load alerts',
        'Please check the backend connection and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAlertData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#1769AA"
        />

        <Text style={styles.loadingText}>
          Loading flood alerts...
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorIcon}>
          ⚠️
        </Text>

        <Text style={styles.errorTitle}>
          Alert data unavailable
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadAlertData()}
        >
          <Text style={styles.retryButtonText}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const score = data.risk_score;

  const currentLevel =
    getLevelFromScore(score);

  const alertConfig =
    getAlertConfig(score);

  const highRiskZones =
    data.risk_zones?.filter(
      (zone) =>
        zone.risk_score >= 65 ||
        zone.risk_level === 'HIGH' ||
        zone.risk_level === 'CRITICAL'
    ) || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            Flood Alerts
          </Text>

          <Text style={styles.headerSubtitle}>
            Real-time risk monitoring
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadAlertData(false)}
        >
          <Text style={styles.refreshIcon}>
            {refreshing ? '⏳' : '↻'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* New Alert Banner */}
      {isNewAlert && previousLevel && (
        <View style={styles.newAlertBanner}>
          <Text style={styles.newAlertIcon}>
            🔔
          </Text>

          <View style={styles.newAlertTextContainer}>
            <Text style={styles.newAlertTitle}>
              NEW ALERT DETECTED
            </Text>

            <Text style={styles.newAlertText}>
              Risk level escalated from {previousLevel}{' '}
              to {currentLevel}.
            </Text>
          </View>
        </View>
      )}

      {/* Current Alert */}
      <View
        style={[
          styles.alertCard,
          {
            backgroundColor:
              alertConfig.background,
            borderLeftColor:
              alertConfig.color,
          },
        ]}
      >
        <View style={styles.alertTopRow}>
          <View style={styles.alertIconContainer}>
            <Text style={styles.alertIcon}>
              {alertConfig.icon}
            </Text>
          </View>

          <View style={styles.alertTitleContainer}>
            <Text
              style={[
                styles.alertTitle,
                {
                  color:
                    alertConfig.color,
                },
              ]}
            >
              {alertConfig.title}
            </Text>

            <Text style={styles.locationText}>
              📍 {data.location}
            </Text>
          </View>

          <View
            style={[
              styles.scoreBadge,
              {
                backgroundColor:
                  alertConfig.color,
              },
            ]}
          >
            <Text style={styles.scoreValue}>
              {Math.round(score)}
            </Text>

            <Text style={styles.scoreLabel}>
              /100
            </Text>
          </View>
        </View>

        <Text style={styles.alertMessage}>
          {alertConfig.message}
        </Text>
      </View>

      {/* Alert Thresholds */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Alert Thresholds
        </Text>

        <View style={styles.thresholdCard}>
          {(
            [
              ['LOW', '0–39'],
              ['MODERATE', '40–64'],
              ['HIGH', '65–79'],
              ['CRITICAL', '80–100'],
            ] as [RiskLevel, string][]
          ).map(([level, range]) => {
            const active =
              currentLevel === level;

            return (
              <View
                key={level}
                style={[
                  styles.thresholdRow,
                  active &&
                    styles.activeThresholdRow,
                ]}
              >
                <View
                  style={[
                    styles.levelDot,
                    {
                      backgroundColor:
                        getLevelColor(level),
                    },
                  ]}
                />

                <Text
                  style={styles.thresholdLevel}
                >
                  {level}
                </Text>

                <Text
                  style={styles.thresholdRange}
                >
                  {range}
                </Text>

                {active && (
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        backgroundColor:
                          getLevelColor(level),
                      },
                    ]}
                  >
                    <Text
                      style={
                        styles.activeBadgeText
                      }
                    >
                      ACTIVE
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Current Risk */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Current Risk
        </Text>

        <View style={styles.metricsCard}>
          <View style={styles.metric}>
            <Text style={styles.metricIcon}>
              🌧️
            </Text>

            <Text style={styles.metricValue}>
              {data.rainfall}
            </Text>

            <Text style={styles.metricLabel}>
              {data.rainfall_unit}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricIcon}>
              ⏱️
            </Text>

            <Text style={styles.metricValue}>
              {data.estimated_onset_minutes}
            </Text>

            <Text style={styles.metricLabel}>
              min onset
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricIcon}>
              🛣️
            </Text>

            <Text style={styles.metricValue}>
              {data.high_risk_roads}
            </Text>

            <Text style={styles.metricLabel}>
              risky roads
            </Text>
          </View>
        </View>
      </View>

      {/* High Risk Roads */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            High-Risk Roads
          </Text>

          <Text style={styles.countText}>
            {highRiskZones.length} locations
          </Text>
        </View>

        {highRiskZones.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              ✅
            </Text>

            <Text style={styles.emptyTitle}>
              No high-risk roads detected
            </Text>

            <Text style={styles.emptyText}>
              Current backend does not currently
              provide individual road-level risk
              zones.
            </Text>
          </View>
        ) : (
          highRiskZones.map((zone) => (
            <View
              key={`${zone.name}-${zone.latitude}`}
              style={styles.roadCard}
            >
              <View
                style={styles.roadIconContainer}
              >
                <Text style={styles.roadIcon}>
                  🛣️
                </Text>
              </View>

              <View style={styles.roadInfo}>
                <Text style={styles.roadName}>
                  {zone.name}
                </Text>

                <Text
                  style={styles.roadCoordinates}
                >
                  {zone.latitude.toFixed(4)},{' '}
                  {zone.longitude.toFixed(4)}
                </Text>
              </View>

              <View style={styles.roadRisk}>
                <Text
                  style={[
                    styles.roadRiskScore,
                    {
                      color: getLevelColor(
                        getLevelFromScore(
                          zone.risk_score
                        )
                      ),
                    },
                  ]}
                >
                  {Math.round(
                    zone.risk_score
                  )}
                </Text>

                <Text
                  style={styles.roadRiskLabel}
                >
                  RISK
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recommendation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Recommended Action
        </Text>

        <View
          style={[
            styles.recommendationCard,
            {
              borderLeftColor:
                alertConfig.color,
            },
          ]}
        >
          <Text
            style={styles.recommendationIcon}
          >
            🛡️
          </Text>

          <View
            style={styles.recommendationContent}
          >
            <Text
              style={styles.recommendationTitle}
            >
              {
                alertConfig.recommendationTitle
              }
            </Text>

            <Text
              style={styles.recommendationText}
            >
              {
                alertConfig.recommendationText
              }
            </Text>
          </View>
        </View>
      </View>

      {/* Alert History */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>
              Alert History
            </Text>

            <Text
              style={styles.sectionSubtitle}
            >
              Latest risk changes
            </Text>
          </View>

          <View style={styles.historyBadge}>
            <Text
              style={styles.historyBadgeText}
            >
              {history.length}
            </Text>
          </View>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              📋
            </Text>

            <Text style={styles.emptyTitle}>
              No alert history
            </Text>

            <Text style={styles.emptyText}>
              Alert events will appear here as
              risk conditions change.
            </Text>
          </View>
        ) : (
          history.map((item, index) => {
            const levelColor =
              getLevelColor(item.level);

            return (
              <View
                key={item.id}
                style={styles.historyCard}
              >
                <View
                  style={[
                    styles.historyIndicator,
                    {
                      backgroundColor:
                        levelColor,
                    },
                  ]}
                />

                <View
                  style={styles.historyMain}
                >
                  <View
                    style={styles.historyTopRow}
                  >
                    <View
                      style={[
                        styles.historyLevelBadge,
                        {
                          backgroundColor:
                            levelColor,
                        },
                      ]}
                    >
                      <Text
                        style={
                          styles.historyLevelText
                        }
                      >
                        {item.level}
                      </Text>
                    </View>

                    {index === 0 && (
                      <View
                        style={styles.latestBadge}
                      >
                        <Text
                          style={
                            styles.latestBadgeText
                          }
                        >
                          LATEST
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={styles.historyScore}
                  >
                    Risk Score: {Math.round(
                      item.score
                    )}
                    /100
                  </Text>

                  <Text
                    style={styles.historyDetails}
                  >
                    🌧️ {item.rainfall}{' '}
                    {item.rainfall_unit}
                  </Text>

                  <Text
                    style={styles.historyDetails}
                  >
                    📍 {item.location}
                  </Text>

                  <Text
                    style={styles.historyTime}
                  >
                    {formatDate(
                      item.timestamp
                    )}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Navigation */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            router.push('/decision')
          }
        >
          <Text
            style={styles.secondaryButtonIcon}
          >
            📊
          </Text>

          <Text
            style={styles.secondaryButtonText}
          >
            Decision Support
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            router.push('/map')
          }
        >
          <Text
            style={styles.primaryButtonIcon}
          >
            🗺️
          </Text>

          <Text
            style={styles.primaryButtonText}
          >
            View Risk Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* Data Source */}
      <View style={styles.sourceCard}>
        <Text style={styles.sourceTitle}>
          ⚙️ Alert Engine
        </Text>

        <Text style={styles.sourceText}>
          Alerts are generated automatically
          from the FloodLink AI risk score using
          rainfall, drainage, elevation and
          historical flood factors.
        </Text>

        <Text style={styles.sourceText}>
          Current rainfall:{' '}
          {data.rainfall_source === 'Open-Meteo' ||
          data.rainfall_source === 'open_meteo'
            ? 'Open-Meteo live weather data'
            : data.rainfall_source ||
              'Backend rainfall data'}
        </Text>

        {data.rainfall_status && (
          <Text style={styles.sourceText}>
            Status: {data.rainfall_status}
          </Text>
        )}
      </View>

      <Text style={styles.disclaimer}>
        ⚠️ FloodLink AI is a prototype
        decision-support system. Alerts are not
        official government emergency warnings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F7FA',
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },

  errorIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#263238',
    marginBottom: 18,
  },

  retryButton: {
    backgroundColor: '#1769AA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#17212B',
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#718096',
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  refreshIcon: {
    fontSize: 24,
    color: '#1769AA',
    fontWeight: '800',
  },

  newAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4D6',
    borderWidth: 1,
    borderColor: '#F2C94C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },

  newAlertIcon: {
    fontSize: 26,
    marginRight: 12,
  },

  newAlertTextContainer: {
    flex: 1,
  },

  newAlertTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#8A5A00',
  },

  newAlertText: {
    marginTop: 3,
    fontSize: 12,
    color: '#775000',
    lineHeight: 17,
  },

  alertCard: {
    borderLeftWidth: 5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },

  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  alertIcon: {
    fontSize: 27,
  },

  alertTitleContainer: {
    flex: 1,
  },

  alertTitle: {
    fontSize: 16,
    fontWeight: '900',
  },

  locationText: {
    marginTop: 5,
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
  },

  scoreBadge: {
    minWidth: 58,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
  },

  scoreValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  scoreLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },

  alertMessage: {
    marginTop: 14,
    color: '#46515C',
    fontSize: 13,
    lineHeight: 20,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#17212B',
    marginBottom: 10,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: '#7A8794',
    marginTop: -5,
    marginBottom: 10,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  countText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },

  thresholdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
  },

  activeThresholdRow: {
    backgroundColor: '#F5F8FB',
  },

  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },

  thresholdLevel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#354052',
  },

  thresholdRange: {
    fontSize: 12,
    color: '#7B8794',
    marginRight: 8,
  },

  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },

  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },

  metricsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  metric: {
    flex: 1,
    alignItems: 'center',
  },

  metricDivider: {
    width: 1,
    backgroundColor: '#E5EAF0',
  },

  metricIcon: {
    fontSize: 20,
    marginBottom: 5,
  },

  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#17212B',
  },

  metricLabel: {
    marginTop: 3,
    fontSize: 9,
    color: '#7A8794',
    fontWeight: '700',
    textAlign: 'center',
  },

  roadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  roadIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  roadIcon: {
    fontSize: 19,
  },

  roadInfo: {
    flex: 1,
  },

  roadName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#263238',
  },

  roadCoordinates: {
    marginTop: 3,
    fontSize: 10,
    color: '#8A96A3',
  },

  roadRisk: {
    alignItems: 'center',
  },

  roadRiskScore: {
    fontSize: 18,
    fontWeight: '900',
  },

  roadRiskLabel: {
    fontSize: 8,
    color: '#87929E',
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  emptyIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#354052',
  },

  emptyText: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 12,
    color: '#7B8794',
    lineHeight: 17,
  },

  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  recommendationIcon: {
    fontSize: 25,
    marginRight: 12,
  },

  recommendationContent: {
    flex: 1,
  },

  recommendationTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#263238',
  },

  recommendationText: {
    marginTop: 5,
    fontSize: 12,
    color: '#66727E',
    lineHeight: 18,
  },

  historyBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EAF3FB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  historyBadgeText: {
    color: '#1769AA',
    fontSize: 12,
    fontWeight: '900',
  },

  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  historyIndicator: {
    width: 5,
  },

  historyMain: {
    flex: 1,
    padding: 13,
  },

  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },

  historyLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },

  historyLevelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  latestBadge: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EAF3FB',
  },

  latestBadgeText: {
    color: '#1769AA',
    fontSize: 8,
    fontWeight: '900',
  },

  historyScore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#354052',
  },

  historyDetails: {
    marginTop: 4,
    fontSize: 11,
    color: '#6E7B88',
  },

  historyTime: {
    marginTop: 7,
    fontSize: 10,
    color: '#9AA5AF',
    fontWeight: '600',
  },

  actionButtons: {
    gap: 10,
    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: '#1769AA',
    borderRadius: 13,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryButtonIcon: {
    fontSize: 17,
    marginRight: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE3EA',
  },

  secondaryButtonIcon: {
    fontSize: 17,
    marginRight: 8,
  },

  secondaryButtonText: {
    color: '#1769AA',
    fontSize: 13,
    fontWeight: '900',
  },

  sourceCard: {
    backgroundColor: '#EEF5FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  sourceTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#24516E',
    marginBottom: 5,
  },

  sourceText: {
    fontSize: 11,
    color: '#607585',
    lineHeight: 17,
    marginBottom: 4,
  },

  disclaimer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#8A96A3',
    lineHeight: 15,
    paddingHorizontal: 10,
  },
});