import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { getFloodRisk, FloodPrediction } from '../services/api';


/* ================================================= */
/*                LOCAL UI TYPES                     */
/* ================================================= */

type RiskZone = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  risk_level: string;
  risk_score: number;
};

type FloodRiskData = FloodPrediction & {
  /*
   * These are kept only so the existing UI structure
   * continues to work.
   */
  rainfall: number;
  rainfall_unit: string;
  high_risk_roads: number;
  estimated_onset_minutes: number;
  risk_zones: RiskZone[];
  data_source: string;
};

type ActionType = 'pump' | 'drainage' | 'road';

type Action = {
  id: ActionType;
  icon: string;
  title: string;
  description: string;
  reduction: number;
  actionText: string;
};


/* ================================================= */
/*                HELPER FUNCTIONS                   */
/* ================================================= */

/*
 * Convert backend onset text into minutes
 * for the existing UI.
 *
 * Backend examples:
 *
 * 15-30 minutes
 * 30-60 minutes
 * 1-2 hours
 * 2+ hours
 */
function convertOnsetToMinutes(
  onset?: string
): number {

  if (!onset) {
    return 0;
  }

  const value = onset.toLowerCase();

  if (
    value.includes('15-30')
  ) {
    return 15;
  }

  if (
    value.includes('30-60')
  ) {
    return 30;
  }

  if (
    value.includes('1-2')
  ) {
    return 60;
  }

  if (
    value.includes('2+')
  ) {
    return 120;
  }

  return 0;
}


/*
 * Convert live backend response into the
 * structure expected by the existing UI.
 */
function mapFloodRiskData(
  result: FloodPrediction
): FloodRiskData {

  /*
   * Current live rainfall
   */
  const rainfall =
    Number(result.rainfall_mm_hr) || 0;


  /*
   * Existing UI expects a rainfall unit.
   *
   * Backend currently exposes rainfall_mm_hr.
   */
  const rainfallUnit =
    'mm';


  /*
   * Backend doesn't currently return
   * high_risk_roads.
   *
   * We do NOT invent a road count.
   *
   * Instead, if the current overall risk is
   * HIGH/CRITICAL, the current pilot location
   * is treated as a priority location.
   */
  const highRiskRoads =
    result.risk_level === 'HIGH' ||
    result.risk_level === 'CRITICAL'
      ? 1
      : 0;


  /*
   * Convert onset estimate into minutes
   * for the existing UI.
   */
  const estimatedOnsetMinutes =
    convertOnsetToMinutes(
      result.onset_estimate
    );


  /*
   * The current backend response does not
   * return risk_zones.
   *
   * To preserve your existing Priority Locations
   * UI, create one live location from the
   * current backend risk.
   *
   * This is NOT a hardcoded risk value.
   */
  const riskZones: RiskZone[] = [
    {
      id: 1,

      name:
        result.location ||
        'Velachery Pilot Area',

      latitude: 12.9815,

      longitude: 80.2180,

      risk_level:
        result.risk_level,

      risk_score:
        Number(result.risk_score) || 0,
    },
  ];


  /*
   * Determine data source from the actual
   * backend response.
   */
  const dataSource =
    result.rainfall_source
      ? `${result.rainfall_source} + GCC drainage + elevation + Random Forest`
      : 'FloodLink AI Live Backend';


  return {
    ...result,

    rainfall,

    rainfall_unit:
      rainfallUnit,

    high_risk_roads:
      highRiskRoads,

    estimated_onset_minutes:
      estimatedOnsetMinutes,

    risk_zones:
      riskZones,

    data_source:
      dataSource,
  };
}


/* ================================================= */
/*              MAIN SCREEN                          */
/* ================================================= */

export default function DecisionSupportScreen() {

  const [data, setData] =
    useState<FloodRiskData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [apiError, setApiError] =
    useState(false);

  const [selectedAction, setSelectedAction] =
    useState<ActionType | null>(null);


  /* ================================================= */
  /*              LOAD LIVE DATA                      */
  /* ================================================= */

  const loadDecisionData = async () => {

    try {

      setLoading(true);

      setApiError(false);

      /*
       * LIVE API
       *
       * GET /api/flood-risk
       */
      const result =
        await getFloodRisk();


      /*
       * Convert new backend response
       * to existing UI structure.
       */
      const mappedData =
        mapFloodRiskData(result);


      setData(mappedData);

    } catch (error) {

      console.error(
        'Decision Support API Error:',
        error
      );

      setApiError(true);

    } finally {

      setLoading(false);

    }
  };


  /* ================================================= */
  /*              INITIAL LOAD                        */
  /* ================================================= */

  useEffect(() => {

    loadDecisionData();

  }, []);


  /* ================================================= */
  /*                  LOADING                         */
  /* ================================================= */

  if (loading) {

    return (

      <View style={styles.loadingContainer}>

        <ActivityIndicator
          size="large"
          color="#1769AA"
        />

        <Text style={styles.loadingText}>
          Loading decision support...
        </Text>

      </View>
    );
  }


  /* ================================================= */
  /*                    ERROR                         */
  /* ================================================= */

  if (apiError || !data) {

    return (

      <View style={styles.errorContainer}>

        <Text style={styles.errorIcon}>
          ⚠️
        </Text>

        <Text style={styles.errorTitle}>
          Unable to load decision support
        </Text>

        <Text style={styles.errorDescription}>
          FloodLink AI backend could not be reached.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadDecisionData}
        >

          <Text style={styles.retryButtonText}>
            RETRY
          </Text>

        </TouchableOpacity>

      </View>
    );
  }


  /* ================================================= */
  /*              LIVE VALUES                         */
  /* ================================================= */

  const currentRisk =
    Math.round(
      Number(data.risk_score) || 0
    );


  const rainfall =
    Number(data.rainfall_mm_hr) || 0;


  const drainageCapacity =
    Number(data.drainage_capacity) || 0;


  const drainageRisk =
    Number(data.drainage_risk) || 0;


  const elevationRisk =
    Number(data.elevation_risk) || 0;


  const historicalRisk =
    Number(data.historical_flood_risk) || 0;


  /* ================================================= */
  /*              DYNAMIC ACTIONS                     */
  /* ================================================= */

  const actions: Action[] = [

    {
      id: 'pump',

      icon: '💧',

      title:
        'Activate Pump Station',

      description:
        'Increase water removal capacity in the vulnerable area.',

      /*
       * Simulation reduction only.
       * It does NOT modify the actual backend risk.
       */
      reduction: 18,

      actionText:
        'Activate Pump Station 02',
    },


    {
      id: 'drainage',

      icon: '🌊',

      title:
        'Improve Drainage Flow',

      description:
        'Prioritize drainage routes with potential flow constraints.',

      reduction: 12,

      actionText:
        'Prioritize Primary Drainage Route',
    },


    {
      id: 'road',

      icon: '🛣️',

      title:
        'Restrict High-Risk Road',

      description:
        'Reduce exposure by restricting access to vulnerable roads.',

      reduction: 25,

      actionText:
        data.risk_zones.length > 0
          ? `Restrict ${data.risk_zones[0].name}`
          : 'Restrict vulnerable road',
    },

  ];


  /* ================================================= */
  /*          SIMULATED INTERVENTION RESULT            */
  /* ================================================= */

  const selected =
    actions.find(
      (action) =>
        action.id === selectedAction
    );


  const simulatedRisk =
    selected
      ? Math.max(
          currentRisk -
            selected.reduction,
          0
        )
      : currentRisk;


  /* ================================================= */
  /*                    UI                            */
  /* ================================================= */

  return (

    <View style={styles.container}>

      {/* ================================================= */}
      {/* HEADER                                            */}
      {/* ================================================= */}

      <View style={styles.header}>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >

          <Text style={styles.backText}>
            ‹
          </Text>

        </TouchableOpacity>


        <View style={styles.headerContent}>

          <Text style={styles.title}>
            Decision Support
          </Text>

          <Text style={styles.subtitle}>
            {data.location}
          </Text>

        </View>


        <View style={styles.apiBadge}>

          <View style={styles.apiDot} />

          <Text style={styles.apiText}>
            API
          </Text>

        </View>

      </View>


      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >


        {/* ================================================= */}
        {/* CURRENT SITUATION                                */}
        {/* ================================================= */}

        <View style={styles.currentCard}>

          <Text style={styles.sectionLabel}>
            CURRENT SITUATION
          </Text>


          <View style={styles.currentRow}>

            <View>

              <Text style={styles.currentRiskLabel}>
                FLOOD RISK
              </Text>

              <Text
                style={[
                  styles.currentRiskLevel,
                  getRiskColor(
                    data.risk_level
                  ),
                ]}
              >
                {data.risk_level.toUpperCase()}
              </Text>

            </View>


            <Text
              style={[
                styles.currentRiskScore,
                getRiskColor(
                  data.risk_level
                ),
              ]}
            >
              {currentRisk}%
            </Text>

          </View>


          <View style={styles.currentMetrics}>


            {/* RAINFALL */}

            <View style={styles.metricBox}>

              <Text style={styles.metricIcon}>
                🌧️
              </Text>

              <Text style={styles.metricValue}>
                {rainfall.toFixed(1)}
              </Text>

              <Text style={styles.metricLabel}>
                {data.rainfall_unit}
              </Text>

            </View>


            {/* ONSET */}

            <View style={styles.metricBox}>

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


            {/* HIGH RISK ROADS */}

            <View style={styles.metricBox}>

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


        {/* ================================================= */}
        {/* RECOMMENDED ACTION                               */}
        {/* ================================================= */}

        <View style={styles.recommendedCard}>

          <View style={styles.recommendedIcon}>

            <Text style={styles.recommendedEmoji}>
              🤖
            </Text>

          </View>


          <View style={styles.recommendedContent}>

            <Text style={styles.recommendedTitle}>
              Recommended Priority
            </Text>


            <Text style={styles.recommendedText}>

              {getRecommendationText(
                data.risk_level,
                drainageRisk,
                rainfall
              )}

            </Text>

          </View>

        </View>


        {/* ================================================= */}
        {/* ACTION TITLE                                      */}
        {/* ================================================= */}

        <Text style={styles.heading}>
          Simulate Interventions
        </Text>


        <Text style={styles.headingDescription}>
          Select an intervention to estimate its potential
          impact on the current risk score.
        </Text>


        {/* ================================================= */}
        {/* ACTION CARDS                                      */}
        {/* ================================================= */}

        {actions.map((action) => {

          const isSelected =
            selectedAction ===
            action.id;


          const resultRisk =
            Math.max(
              currentRisk -
                action.reduction,
              0
            );


          return (

            <TouchableOpacity
              key={action.id}
              activeOpacity={0.85}
              style={[
                styles.actionCard,

                isSelected &&
                  styles.actionCardSelected,
              ]}
              onPress={() => {

                setSelectedAction(
                  action.id
                );

              }}
            >


              <View style={styles.actionTop}>


                <View
                  style={styles.actionIconBox}
                >

                  <Text style={styles.actionIcon}>
                    {action.icon}
                  </Text>

                </View>


                <View style={styles.actionInfo}>

                  <Text style={styles.actionTitle}>
                    {action.title}
                  </Text>

                  <Text style={styles.actionDescription}>
                    {action.description}
                  </Text>

                </View>


                <View style={styles.reductionBadge}>

                  <Text style={styles.reductionText}>
                    -{action.reduction}%
                  </Text>

                </View>

              </View>


              {isSelected && (

                <View
                  style={styles.simulationResult}
                >

                  <Text style={styles.resultLabel}>
                    SIMULATED RESULT
                  </Text>


                  <View style={styles.resultRow}>


                    <View>

                      <Text style={styles.resultSmall}>
                        Current Risk
                      </Text>

                      <Text
                        style={[
                          styles.resultCurrent,
                          getRiskColor(
                            data.risk_level
                          ),
                        ]}
                      >
                        {currentRisk}%
                      </Text>

                    </View>


                    <Text style={styles.arrow}>
                      →
                    </Text>


                    <View>

                      <Text style={styles.resultSmall}>
                        After Action
                      </Text>

                      <Text style={styles.resultAfter}>
                        {resultRisk}%
                      </Text>

                    </View>

                  </View>


                  <Text
                    style={styles.actionRecommendation}
                  >
                    Suggested action:{' '}
                    {action.actionText}
                  </Text>

                </View>

              )}

            </TouchableOpacity>

          );

        })}


        {/* ================================================= */}
        {/* SELECTED ACTION SUMMARY                           */}
        {/* ================================================= */}

        {selected && (

          <View style={styles.summaryCard}>

            <Text style={styles.summaryTitle}>
              Intervention Summary
            </Text>


            <Text style={styles.summaryText}>
              {selected.icon}{' '}
              {selected.actionText}
            </Text>


            <View
              style={styles.summaryRiskRow}
            >

              <View>

                <Text style={styles.summaryLabel}>
                  Current Risk
                </Text>

                <Text
                  style={[
                    styles.summaryValue,
                    getRiskColor(
                      data.risk_level
                    ),
                  ]}
                >
                  {currentRisk}%
                </Text>

              </View>


              <View style={styles.summaryArrow}>

                <Text>
                  →
                </Text>

              </View>


              <View>

                <Text style={styles.summaryLabel}>
                  Simulated Risk
                </Text>

                <Text style={styles.summaryAfter}>
                  {simulatedRisk}%
                </Text>

              </View>

            </View>


            <Text style={styles.summaryNote}>
              This is a prototype decision-support
              simulation. It does not represent a
              validated hydraulic prediction.
            </Text>

          </View>

        )}


        {/* ================================================= */}
        {/* PRIORITY LOCATIONS                               */}
        {/* ================================================= */}

        <Text style={styles.heading}>
          Priority Locations
        </Text>


        <View style={styles.locationCard}>

          {data.risk_zones.map(
            (zone, index) => {

              const highRisk =
                zone.risk_score >= 75;


              return (

                <View
                  key={zone.id}
                  style={[
                    styles.locationRow,

                    index > 0 &&
                      styles.locationBorder,
                  ]}
                >

                  <View
                    style={[
                      styles.locationDot,

                      {
                        backgroundColor:
                          highRisk
                            ? '#D32F2F'
                            : '#FB8C00',
                      },
                    ]}
                  />


                  <View style={styles.locationInfo}>

                    <Text style={styles.locationName}>
                      {zone.name}
                    </Text>


                    <Text style={styles.locationScore}>
                      Risk score:{' '}
                      {Math.round(
                        zone.risk_score
                      )}%
                    </Text>

                  </View>


                  <Text
                    style={[
                      styles.locationLevel,

                      {
                        color:
                          highRisk
                            ? '#D32F2F'
                            : '#FB8C00',
                      },
                    ]}
                  >
                    {zone.risk_level.toUpperCase()}
                  </Text>

                </View>

              );

            }
          )}

        </View>


        {/* ================================================= */}
        {/* NAVIGATION                                       */}
        {/* ================================================= */}

        <View style={styles.navigationRow}>


          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              router.push('/map');
            }}
          >

            <Text style={styles.navIcon}>
              🗺️
            </Text>

            <Text style={styles.navText}>
              VIEW MAP
            </Text>

          </TouchableOpacity>


          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              router.push('/alerts');
            }}
          >

            <Text style={styles.navIcon}>
              🚨
            </Text>

            <Text style={styles.navText}>
              ALERTS
            </Text>

          </TouchableOpacity>

        </View>


        {/* ================================================= */}
        {/* DATA SOURCE                                      */}
        {/* ================================================= */}

        <View style={styles.sourceCard}>

          <Text style={styles.sourceTitle}>
            Decision Support Data
          </Text>


          <Text style={styles.sourceValue}>
            {data.data_source}
          </Text>


          <Text style={styles.disclaimer}>
            Current rainfall is obtained from the
            live Open-Meteo service. Drainage and
            elevation factors are obtained from the
            FloodLink AI backend. Intervention impacts
            shown above are prototype simulations.
          </Text>

        </View>


        {/* ================================================= */}
        {/* FOOTER                                           */}
        {/* ================================================= */}

        <Text style={styles.footer}>
          FloodLink AI • SIH26085 • Decision Support
        </Text>


      </ScrollView>

    </View>
  );
}


/* ================================================= */
/*              RISK COLOR                          */
/* ================================================= */

function getRiskColor(
  riskLevel?: string
) {

  switch (
    String(riskLevel)
      .toUpperCase()
  ) {

    case 'CRITICAL':
      return {
        color: '#B71C1C',
      };

    case 'HIGH':
      return {
        color: '#D32F2F',
      };

    case 'MODERATE':
      return {
        color: '#FB8C00',
      };

    case 'LOW':
      return {
        color: '#2E7D32',
      };

    default:
      return {
        color: '#D32F2F',
      };
  }
}


/* ================================================= */
/*          RECOMMENDATION LOGIC                    */
/* ================================================= */

function getRecommendationText(
  riskLevel: string,
  drainageRisk: number,
  rainfall: number
): string {

  const level =
    riskLevel.toUpperCase();


  if (
    level === 'CRITICAL'
  ) {

    return (
      'Activate pumping infrastructure immediately, ' +
      'prioritize drainage flow and restrict vulnerable ' +
      'roads while the current risk remains critical.'
    );
  }


  if (
    level === 'HIGH'
  ) {

    return (
      'Activate pumping infrastructure and monitor ' +
      'vulnerable roads while the current risk remains high.'
    );
  }


  if (
    drainageRisk >= 65
  ) {

    return (
      'Prioritize drainage flow because current drainage ' +
      'stress is high. Continue monitoring rainfall conditions.'
    );
  }


  if (
    rainfall >= 50
  ) {

    return (
      'Monitor rainfall closely and prepare drainage and ' +
      'road-management interventions if rainfall increases.'
    );
  }


  return (
    'Continue monitoring rainfall, drainage conditions and ' +
    'flood susceptibility in the pilot area.'
  );
}


/* ================================================= */
/*                    STYLES                         */
/* ================================================= */

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F5F8FC',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8FC',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#667788',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F5F8FC',
  },

  errorIcon: {
    fontSize: 42,
    marginBottom: 15,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#243447',
    marginBottom: 8,
    textAlign: 'center',
  },

  errorDescription: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },

  retryButton: {
    backgroundColor: '#1769AA',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  header: {
    height: 76,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  backText: {
    fontSize: 32,
    color: '#123B63',
    marginTop: -4,
  },

  headerContent: {
    flex: 1,
  },

  title: {
    fontSize: 21,
    fontWeight: '900',
    color: '#123B63',
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#718096',
  },

  apiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
  },

  apiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
    marginRight: 5,
  },

  apiText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#2E7D32',
  },

  content: {
    padding: 18,
    paddingBottom: 35,
  },

  currentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 19,
    marginBottom: 14,
    elevation: 2,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8A98A8',
    letterSpacing: 1,
    marginBottom: 13,
  },

  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  currentRiskLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A8794',
  },

  currentRiskLevel: {
    marginTop: 3,
    fontSize: 22,
    fontWeight: '900',
    color: '#D32F2F',
  },

  currentRiskScore: {
    fontSize: 38,
    fontWeight: '900',
    color: '#D32F2F',
  },

  currentMetrics: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 8,
  },

  metricBox: {
    flex: 1,
    backgroundColor: '#F5F8FC',
    borderRadius: 11,
    padding: 10,
    alignItems: 'center',
  },

  metricIcon: {
    fontSize: 18,
  },

  metricValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '900',
    color: '#1769AA',
  },

  metricLabel: {
    marginTop: 2,
    fontSize: 9,
    color: '#7A8794',
    textAlign: 'center',
  },

  recommendedCard: {
    flexDirection: 'row',
    backgroundColor: '#EAF3FB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },

  recommendedIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#D6EAF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  recommendedEmoji: {
    fontSize: 23,
  },

  recommendedContent: {
    flex: 1,
  },

  recommendedTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1769AA',
  },

  recommendedText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 19,
    color: '#53697D',
  },

  heading: {
    fontSize: 19,
    fontWeight: '900',
    color: '#243447',
    marginBottom: 5,
  },

  headingDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7A8794',
    marginBottom: 13,
  },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },

  actionCardSelected: {
    borderColor: '#1769AA',
    borderWidth: 2,
  },

  actionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EEF5FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  actionIcon: {
    fontSize: 22,
  },

  actionInfo: {
    flex: 1,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#34495E',
  },

  actionDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#7A8794',
  },

  reductionBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },

  reductionText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2E7D32',
  },

  simulationResult: {
    marginTop: 14,
    backgroundColor: '#F5F8FC',
    borderRadius: 12,
    padding: 13,
  },

  resultLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8A98A8',
    letterSpacing: 1,
    marginBottom: 10,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  resultSmall: {
    fontSize: 10,
    color: '#7A8794',
    marginBottom: 3,
  },

  resultCurrent: {
    fontSize: 23,
    fontWeight: '900',
    color: '#D32F2F',
  },

  resultAfter: {
    fontSize: 23,
    fontWeight: '900',
    color: '#2E7D32',
  },

  arrow: {
    fontSize: 25,
    color: '#718096',
  },

  actionRecommendation: {
    marginTop: 11,
    fontSize: 11,
    lineHeight: 17,
    color: '#53697D',
    fontWeight: '600',
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
    marginTop: 5,
    marginBottom: 22,
    borderLeftWidth: 4,
    borderLeftColor: '#1769AA',
    elevation: 1,
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#34495E',
  },

  summaryText: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '700',
    color: '#1769AA',
  },

  summaryRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },

  summaryLabel: {
    fontSize: 10,
    color: '#7A8794',
  },

  summaryValue: {
    marginTop: 3,
    fontSize: 23,
    fontWeight: '900',
    color: '#D32F2F',
  },

  summaryAfter: {
    marginTop: 3,
    fontSize: 23,
    fontWeight: '900',
    color: '#2E7D32',
  },

  summaryArrow: {
    marginHorizontal: 25,
    fontSize: 20,
  },

  summaryNote: {
    marginTop: 12,
    fontSize: 10,
    lineHeight: 16,
    color: '#8A98A8',
  },

  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
    marginBottom: 20,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },

  locationBorder: {
    borderTopWidth: 1,
    borderTopColor: '#EEF1F4',
  },

  locationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 11,
  },

  locationInfo: {
    flex: 1,
  },

  locationName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34495E',
  },

  locationScore: {
    marginTop: 3,
    fontSize: 10,
    color: '#8A98A8',
  },

  locationLevel: {
    fontSize: 10,
    fontWeight: '900',
  },

  navigationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  navButton: {
    flex: 1,
    backgroundColor: '#1769AA',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIcon: {
    fontSize: 18,
    marginBottom: 4,
  },

  navText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  sourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 16,
    marginBottom: 18,
  },

  sourceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34495E',
  },

  sourceValue: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#1769AA',
  },

  disclaimer: {
    marginTop: 9,
    fontSize: 10,
    lineHeight: 16,
    color: '#8A98A8',
  },

  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#9AA7B3',
  },

});