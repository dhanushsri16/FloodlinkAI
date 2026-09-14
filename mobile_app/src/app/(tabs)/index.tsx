import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { getFloodRisk } from '../../services/api';

type FloodRiskData = {
  success: boolean;
  location: string;

  rainfall_mm_hr: number;
  rainfall_score: number;
  rainfall_level: string;

  rainfall_source?: string;
  rainfall_status?: string;
  rainfall_timestamp?: string;
  rainfall_is_real?: boolean;

  drainage_capacity: number;
  drainage_risk: number;
  elevation_risk: number;
  historical_flood_risk: number;
  spatial_susceptibility: number;

  risk_score: number;
  risk_level: string;

  ml_prediction: string;
  ml_flood_probability: number;
  ml_background_probability: number;
  ml_model: string;

  rainfall_used_by_ml: boolean;
  model_role?: string;
  rainfall_role?: string;
  prediction_pipeline?: string;
};

export default function HomeScreen() {
  const [floodData, setFloodData] =
    useState<FloodRiskData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [apiError, setApiError] =
    useState(false);

  useEffect(() => {
    loadFloodRisk();
  }, []);

  async function loadFloodRisk() {
  try {
    setLoading(true);
    setApiError(false);

    console.log("Fetching live flood risk...");

    const data = await getFloodRisk();

    console.log("LIVE FLOOD RISK DATA:", data);

    setFloodData(data);
  } catch (error) {
    console.error(
      "Failed to load flood prediction:",
      error
    );

    setApiError(true);
  } finally {
    setLoading(false);
  }
}
    

  const riskScore =
    floodData?.risk_score ?? 0;

  const riskLevel =
    floodData?.risk_level ?? 'UNKNOWN';

  const rainfall =
    floodData?.rainfall_mm_hr ?? 0;

  const rainfallUnit =
    'mm/hr';

  // These values are not yet returned by backend.
  const highRiskRoads = 0;
  const onsetMinutes = 0;

  function getRiskColor(level: string) {
    switch (level) {
      case 'LOW':
        return '#218A4A';

      case 'MODERATE':
        return '#A56A00';

      case 'HIGH':
        return '#D96B00';

      case 'CRITICAL':
        return '#D32F2F';

      default:
        return '#607789';
    }
  }

  function getRiskCircleStyle(level: string) {
    switch (level) {
      case 'LOW':
        return styles.lowRiskCircle;

      case 'MODERATE':
        return styles.moderateRiskCircle;

      case 'HIGH':
        return styles.highRiskCircle;

      case 'CRITICAL':
        return styles.criticalRiskCircle;

      default:
        return styles.normalRiskCircle;
    }
  }

  function getRainfallBadgeStyle(level: string) {
    switch (level) {
      case 'LOW':
        return styles.lowRainfallBadge;

      case 'MODERATE':
        return styles.moderateRainfallBadge;

      case 'HIGH':
        return styles.highRainfallBadge;

      case 'CRITICAL':
        return styles.criticalRainfallBadge;

      default:
        return styles.heavyBadge;
    }
  }

  function getRainfallTextStyle(level: string) {
    switch (level) {
      case 'LOW':
        return styles.lowRainfallText;

      case 'MODERATE':
        return styles.moderateRainfallText;

      case 'HIGH':
        return styles.highRainfallText;

      case 'CRITICAL':
        return styles.criticalRainfallText;

      default:
        return styles.heavyText;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>
              FloodLink AI
            </Text>

            <Text style={styles.location}>
              📍{' '}
              {floodData?.location ??
                'Velachery, Chennai'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() =>
              router.push('/settings')
            }
          >
            <Text style={styles.settingsIcon}>
              ⚙️
            </Text>
          </TouchableOpacity>
        </View>

        {/* API Status */}
        <View style={styles.liveRow}>
          <View
            style={[
              styles.liveDot,
              apiError && styles.errorDot,
            ]}
          />

          <Text
            style={[
              styles.liveText,
              apiError && styles.errorText,
            ]}
          >
            {apiError
              ? 'API OFFLINE'
              : 'LIVE DATA CONNECTED'}
          </Text>

          {!apiError && (
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>
                LIVE
              </Text>
            </View>
          )}
        </View>

        {/* Loading */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              size="large"
              color="#1769AA"
            />

            <Text style={styles.loadingTitle}>
              Loading flood intelligence...
            </Text>

            <Text style={styles.loadingSubtitle}>
              Fetching live rainfall and flood risk
            </Text>
          </View>
        ) : (
          <>
            {/* Risk Card */}
            <View style={styles.riskCard}>
              <View style={styles.riskHeader}>
                <View>
                  <Text style={styles.smallLabel}>
                    CURRENT FLOOD RISK
                  </Text>

                  <Text
                    style={[
                      styles.riskTitle,
                      {
                        color:
                          getRiskColor(
                            riskLevel
                          ),
                      },
                    ]}
                  >
                    {riskLevel} RISK
                  </Text>
                </View>

                <View
                  style={[
                    styles.riskCircle,
                    getRiskCircleStyle(
                      riskLevel
                    ),
                  ]}
                >
                  <Text
                    style={[
                      styles.riskScore,
                      {
                        color:
                          getRiskColor(
                            riskLevel
                          ),
                      },
                    ]}
                  >
                    {Number(
                      riskScore
                    ).toFixed(2)}
                    %
                  </Text>

                  <Text
                    style={
                      styles.riskScoreLabel
                    }
                  >
                    RISK
                  </Text>
                </View>
              </View>

              <View style={styles.riskLine} />

              <Text
                style={styles.riskDescription}
              >
                Flood risk is calculated using
                live rainfall, spatial
                susceptibility and Random Forest
                flood intelligence.
              </Text>
            </View>

            {/* Conditions */}
            <Text style={styles.sectionTitle}>
              CURRENT CONDITIONS
            </Text>

            <View style={styles.conditionRow}>

              {/* Rainfall */}
              <View
                style={styles.conditionCard}
              >
                <Text
                  style={styles.conditionIcon}
                >
                  🌧️
                </Text>

                <Text
                  style={styles.conditionLabel}
                >
                  LIVE RAINFALL
                </Text>

                <Text
                  style={styles.conditionValue}
                >
                  {Number(
                    rainfall
                  ).toFixed(2)}
                </Text>

                <Text
                  style={styles.conditionUnit}
                >
                  {rainfallUnit}
                </Text>

                <View
                  style={getRainfallBadgeStyle(
                    floodData?.rainfall_level ??
                      'UNKNOWN'
                  )}
                >
                  <Text
                    style={getRainfallTextStyle(
                      floodData?.rainfall_level ??
                        'UNKNOWN'
                    )}
                  >
                    {floodData?.rainfall_level ??
                      'UNKNOWN'}
                  </Text>
                </View>
              </View>

              {/* Roads */}
              <View
                style={styles.conditionCard}
              >
                <Text
                  style={styles.conditionIcon}
                >
                  🛣️
                </Text>

                <Text
                  style={styles.conditionLabel}
                >
                  HIGH-RISK
                </Text>

                <Text
                  style={styles.conditionValue}
                >
                  {highRiskRoads}
                </Text>

                <Text
                  style={styles.conditionUnit}
                >
                  roads
                </Text>

                <View
                  style={styles.warningBadge}
                >
                  <Text
                    style={styles.warningText}
                  >
                    WATCH
                  </Text>
                </View>
              </View>
            </View>

            {/* Rainfall Source */}
            {floodData && (
              <View
                style={styles.sourceCard}
              >
                <View
                  style={styles.sourceIconBox}
                >
                  <Text
                    style={styles.sourceIcon}
                  >
                    🌐
                  </Text>
                </View>

                <View
                  style={styles.sourceContent}
                >
                  <Text
                    style={styles.sourceTitle}
                  >
                    LIVE WEATHER DATA
                  </Text>

                  <Text
                    style={styles.sourceText}
                  >
                    Source:{' '}
                    {floodData.rainfall_source ??
                      'Open-Meteo'}
                  </Text>

                  <Text
                    style={styles.sourceStatus}
                  >
                    ●{' '}
                    {floodData.rainfall_status ??
                      'LIVE'}
                  </Text>
                </View>
              </View>
            )}

            {/* Flood Timing */}
            <View style={styles.timingCard}>
              <View
                style={styles.timingIconBox}
              >
                <Text
                  style={styles.timingIcon}
                >
                  ⏱️
                </Text>
              </View>

              <View
                style={styles.timingContent}
              >
                <Text
                  style={styles.timingLabel}
                >
                  ESTIMATED FLOOD ONSET
                </Text>

                <Text
                  style={styles.timingValue}
                >
                  {onsetMinutes > 0
                    ? `~${onsetMinutes} minutes`
                    : 'Calculating...'}
                </Text>
              </View>

              <Text
                style={styles.timingArrow}
              >
                ›
              </Text>
            </View>

            {/* Intelligence */}
            <Text style={styles.sectionTitle}>
              FLOOD INTELLIGENCE
            </Text>

            {/* Map */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push('/map')
              }
            >
              <Text style={styles.primaryIcon}>
                🗺️
              </Text>

              <View style={styles.buttonContent}>
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  VIEW FLOOD MAP
                </Text>

                <Text
                  style={
                    styles.primaryButtonSubtext
                  }
                >
                  Explore flood-risk zones and
                  roads
                </Text>
              </View>

              <Text style={styles.buttonArrow}>
                ›
              </Text>
            </TouchableOpacity>

            {/* Analysis */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                router.push('/analysis')
              }
            >
              <Text
                style={styles.secondaryIcon}
              >
                📊
              </Text>

              <View style={styles.buttonContent}>
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  ANALYSE FLOOD RISK
                </Text>

                <Text
                  style={
                    styles.secondaryButtonSubtext
                  }
                >
                  View risk factors and
                  conditions
                </Text>
              </View>

              <Text
                style={styles.secondaryArrow}
              >
                ›
              </Text>
            </TouchableOpacity>

            {/* Decision Support */}
            <TouchableOpacity
              style={styles.decisionButton}
              onPress={() =>
                router.push('/decision')
              }
            >
              <View
                style={styles.decisionIconBox}
              >
                <Text
                  style={styles.decisionIcon}
                >
                  💡
                </Text>
              </View>

              <View style={styles.buttonContent}>
                <Text
                  style={styles.decisionTitle}
                >
                  DECISION SUPPORT
                </Text>

                <Text
                  style={styles.decisionSubtitle}
                >
                  Simulate actions to reduce
                  flood risk
                </Text>
              </View>

              <Text
                style={styles.decisionArrow}
              >
                ›
              </Text>
            </TouchableOpacity>

            {/* Recommendation */}
            <View
              style={
                styles.recommendationCard
              }
            >
              <View
                style={
                  styles.recommendationHeader
                }
              >
                <Text
                  style={
                    styles.recommendationIcon
                  }
                >
                  ⚠️
                </Text>

                <View
                  style={
                    styles.recommendationTitleBox
                  }
                >
                  <Text
                    style={
                      styles.recommendationTitle
                    }
                  >
                    FLOODLINK RECOMMENDATION
                  </Text>

                  <Text
                    style={
                      styles.recommendationSubtitle
                    }
                  >
                    Suggested action
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.recommendationText
                }
              >
                Monitor low-lying roads and
                drainage conditions in Velachery
                based on the current flood-risk
                assessment.
              </Text>

              <TouchableOpacity
                onPress={() =>
                  router.push('/decision')
                }
                style={
                  styles.recommendationButton
                }
              >
                <Text
                  style={
                    styles.recommendationButtonText
                  }
                >
                  VIEW ACTION →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Backend Details */}
            {floodData && (
              <View
                style={styles.backendCard}
              >
                <Text
                  style={styles.backendTitle}
                >
                  AI BACKEND STATUS
                </Text>

                <View
                  style={styles.backendRow}
                >
                  <Text
                    style={styles.backendLabel}
                  >
                    Spatial Susceptibility
                  </Text>

                  <Text
                    style={styles.backendValue}
                  >
                    {Number(
                      floodData.spatial_susceptibility
                    ).toFixed(2)}
                    %
                  </Text>
                </View>

                <View
                  style={styles.backendRow}
                >
                  <Text
                    style={styles.backendLabel}
                  >
                    ML Flood Probability
                  </Text>

                  <Text
                    style={styles.backendValue}
                  >
                    {Number(
                      floodData.ml_flood_probability
                    ).toFixed(2)}
                    %
                  </Text>
                </View>

                <View
                  style={styles.backendRow}
                >
                  <Text
                    style={styles.backendLabel}
                  >
                    Live Rainfall Score
                  </Text>

                  <Text
                    style={styles.backendValue}
                  >
                    {Number(
                      floodData.rainfall_score
                    ).toFixed(2)}
                    %
                  </Text>
                </View>

                <View
                  style={styles.backendRow}
                >
                  <Text
                    style={styles.backendLabel}
                  >
                    Drainage Risk
                  </Text>

                  <Text
                    style={styles.backendValue}
                  >
                    {Number(
                      floodData.drainage_risk
                    ).toFixed(2)}
                    %
                  </Text>
                </View>

                <View
                  style={styles.backendRow}
                >
                  <Text
                    style={styles.backendLabel}
                  >
                    Elevation Risk
                  </Text>

                  <Text
                    style={styles.backendValue}
                  >
                    {Number(
                      floodData.elevation_risk
                    ).toFixed(2)}
                    %
                  </Text>
                </View>

                <View
                  style={styles.backendRow}
                >
                  <Text
                    style={styles.backendLabel}
                  >
                    Historical Flood Risk
                  </Text>

                  <Text
                    style={styles.backendValue}
                  >
                    {Number(
                      floodData.historical_flood_risk
                    ).toFixed(2)}
                    %
                  </Text>
                </View>

                <Text
                  style={styles.modelText}
                >
                  Model: {floodData.ml_model}
                </Text>

                <Text
                  style={styles.modelRoleText}
                >
                  Random Forest:{' '}
                  {floodData.model_role ??
                    'Spatial flood susceptibility'}
                </Text>

                <Text
                  style={styles.modelRoleText}
                >
                  Rainfall:{' '}
                  {floodData.rainfall_role ??
                    'Live nowcasting input'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Error */}
        {apiError && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadFloodRisk}
          >
            <Text style={styles.retryText}>
              🔄 RETRY CONNECTION
            </Text>
          </TouchableOpacity>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text
            style={styles.disclaimerIcon}
          >
            ℹ️
          </Text>

          <Text
            style={styles.disclaimerText}
          >
            FloodLink AI uses live
            location-specific precipitation
            data from Open-Meteo for real-time
            flood-risk calculation. The Random
            Forest model estimates spatial flood
            susceptibility.
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          FloodLink AI • SIH26085 • Urban Flood
          Nowcasting
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FB',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 12,
  },

  appTitle: {
    fontSize: 27,
    fontWeight: '900',
    color: '#1769AA',
  },

  location: {
    fontSize: 13,
    color: '#6D7D89',
    marginTop: 3,
  },

  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },

  settingsIcon: {
    fontSize: 21,
  },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#20A65A',
    marginRight: 7,
  },

  errorDot: {
    backgroundColor: '#D32F2F',
  },

  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#218A4A',
    letterSpacing: 0.7,
  },

  errorText: {
    color: '#D32F2F',
  },

  livePill: {
    marginLeft: 9,
    backgroundColor: '#E4F6EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  livePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#218A4A',
  },

  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 22,
  },

  loadingTitle: {
    marginTop: 15,
    fontSize: 15,
    fontWeight: '800',
    color: '#20313F',
  },

  loadingSubtitle: {
    marginTop: 5,
    fontSize: 12,
    color: '#7A8995',
  },

  riskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    marginBottom: 22,
  },

  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  smallLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A8995',
    letterSpacing: 0.8,
  },

  riskTitle: {
    fontSize: 25,
    fontWeight: '900',
    marginTop: 5,
  },

  riskCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lowRiskCircle: {
    borderColor: '#64B982',
  },

  moderateRiskCircle: {
    borderColor: '#E2B54A',
  },

  highRiskCircle: {
    borderColor: '#E88A45',
  },

  criticalRiskCircle: {
    borderColor: '#E85D5D',
  },

  normalRiskCircle: {
    borderColor: '#A5B1BA',
  },

  riskScore: {
    fontSize: 17,
    fontWeight: '900',
  },

  riskScoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7A8995',
  },

  riskLine: {
    height: 1,
    backgroundColor: '#E8EDF1',
    marginVertical: 15,
  },

  riskDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#667783',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#748591',
    letterSpacing: 1,
    marginBottom: 10,
  },

  conditionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  conditionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    elevation: 2,
  },

  conditionIcon: {
    fontSize: 22,
    marginBottom: 10,
  },

  conditionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#83919C',
    letterSpacing: 0.6,
  },

  conditionValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E3342',
    marginTop: 3,
  },

  conditionUnit: {
    fontSize: 11,
    color: '#7C8B96',
    marginTop: -3,
  },

  heavyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE4E4',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 9,
  },

  heavyText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#D32F2F',
  },

  lowRainfallBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E4F6EA',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 9,
  },

  lowRainfallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#218A4A',
  },

  moderateRainfallBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 9,
  },

  moderateRainfallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#A56A00',
  },

  highRainfallBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE9D8',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 9,
  },

  highRainfallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#D96B00',
  },

  criticalRainfallBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE4E4',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 9,
  },

  criticalRainfallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#D32F2F',
  },

  warningBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0D3',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 9,
  },

  warningText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#A56A00',
  },

  sourceCard: {
    backgroundColor: '#EEF6FC',
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  sourceIconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sourceIcon: {
    fontSize: 20,
  },

  sourceContent: {
    marginLeft: 11,
    flex: 1,
  },

  sourceTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1769AA',
    letterSpacing: 0.5,
  },

  sourceText: {
    fontSize: 10,
    color: '#667783',
    marginTop: 3,
  },

  sourceStatus: {
    fontSize: 9,
    color: '#218A4A',
    fontWeight: '800',
    marginTop: 2,
  },

  timingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 23,
    elevation: 2,
  },

  timingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF6FC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  timingIcon: {
    fontSize: 21,
  },

  timingContent: {
    flex: 1,
    marginLeft: 12,
  },

  timingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#81909B',
    letterSpacing: 0.6,
  },

  timingValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1769AA',
    marginTop: 3,
  },

  timingArrow: {
    fontSize: 27,
    color: '#A5B1BA',
  },

  primaryButton: {
    backgroundColor: '#1769AA',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
  },

  primaryIcon: {
    fontSize: 23,
    width: 40,
    textAlign: 'center',
  },

  buttonContent: {
    flex: 1,
    marginLeft: 9,
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  primaryButtonSubtext: {
    fontSize: 11,
    color: '#DDEEFF',
    marginTop: 3,
  },

  buttonArrow: {
    fontSize: 27,
    color: '#FFFFFF',
  },

  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
  },

  secondaryIcon: {
    fontSize: 23,
    width: 40,
    textAlign: 'center',
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1769AA',
  },

  secondaryButtonSubtext: {
    fontSize: 11,
    color: '#71808B',
    marginTop: 3,
  },

  secondaryArrow: {
    fontSize: 27,
    color: '#8A98A4',
  },

  decisionButton: {
    backgroundColor: '#EAF4FB',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  decisionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  decisionIcon: {
    fontSize: 21,
  },

  decisionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1769AA',
  },

  decisionSubtitle: {
    fontSize: 11,
    color: '#647B8B',
    marginTop: 3,
  },

  decisionArrow: {
    fontSize: 27,
    color: '#1769AA',
  },

  recommendationCard: {
    backgroundColor: '#FFF9EC',
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: '#F2D99B',
    marginBottom: 18,
  },

  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  recommendationIcon: {
    fontSize: 21,
  },

  recommendationTitleBox: {
    marginLeft: 9,
  },

  recommendationTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#966500',
    letterSpacing: 0.6,
  },

  recommendationSubtitle: {
    fontSize: 10,
    color: '#A48755',
    marginTop: 2,
  },

  recommendationText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#66583E',
    marginTop: 13,
  },

  recommendationButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },

  recommendationButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#A56A00',
  },

  backendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 17,
    marginBottom: 18,
    elevation: 2,
  },

  backendTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1769AA',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  backendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F3',
  },

  backendLabel: {
    fontSize: 11,
    color: '#71808B',
  },

  backendValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#20313F',
  },

  modelText: {
    fontSize: 9,
    color: '#9AA6AF',
    marginTop: 10,
  },

  modelRoleText: {
    fontSize: 9,
    color: '#71808B',
    marginTop: 4,
  },

  retryButton: {
    backgroundColor: '#1769AA',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 15,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  disclaimer: {
    backgroundColor: '#EEF6FC',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
  },

  disclaimerIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  disclaimerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#607789',
  },

  footer: {
    textAlign: 'center',
    fontSize: 9,
    color: '#9AA6AF',
    marginTop: 18,
  },
});