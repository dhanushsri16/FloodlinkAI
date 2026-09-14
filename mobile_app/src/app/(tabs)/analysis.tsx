import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getFloodRisk,
  FloodPrediction,
  ForecastItem,
} from "../../services/api";


export default function AnalysisScreen() {

  const [data, setData] =
    useState<FloodPrediction | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [apiError, setApiError] =
    useState(false);


  // ==========================================================
  // LOAD ANALYSIS
  // ==========================================================

  const loadAnalysis = async () => {

    try {

      setLoading(true);
      setApiError(false);

      const result =
        await getFloodRisk();

      setData(result);

    } catch (error) {

      console.error(
        "Analysis API Error:",
        error
      );

      setApiError(true);

    } finally {

      setLoading(false);

    }
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadAnalysis();

  }, []);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <View style={styles.centerContainer}>

        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading live flood analysis...
        </Text>

      </View>
    );
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (apiError || !data) {

    return (
      <View style={styles.centerContainer}>

        <Text style={styles.errorTitle}>
          Unable to load flood analysis
        </Text>

        <Text style={styles.errorText}>
          Please make sure the FloodLink AI
          backend is running and your mobile
          device is connected to the same network.
        </Text>

      </View>
    );
  }


  // ==========================================================
  // LIVE VALUES
  // ==========================================================

  const riskScore =
    Math.min(
      100,
      Math.max(
        0,
        Number(data.risk_score) || 0
      )
    );


  const rainfall =
    Number(
      data.rainfall_mm_hr
    ) || 0;


  const drainageCapacity =
    Math.min(
      100,
      Math.max(
        0,
        Number(data.drainage_capacity) || 0
      )
    );


  const drainageRisk =
    Number(
      data.drainage_risk
    ) || 0;


  const elevationRisk =
    Number(
      data.elevation_risk
    ) || 0;


  const historicalRisk =
    Number(
      data.historical_flood_risk
    ) || 0;


  const drainageLevel =
    drainageRisk >= 65
      ? "HIGH"
      : drainageRisk >= 40
        ? "MODERATE"
        : "LOW";


  const forecast:
    ForecastItem[] =
      data.forecast || [];


  // ==========================================================
  // SCREEN
  // ==========================================================

  return (

    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.contentContainer
      }
      showsVerticalScrollIndicator={false}
    >

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <View style={styles.header}>

        <Text style={styles.title}>
          Flood Analysis
        </Text>

        <Text style={styles.location}>
          {data.location}
        </Text>

        <View style={styles.liveBadge}>

          <View style={styles.liveDot} />

          <Text style={styles.liveText}>
            LIVE API
          </Text>

        </View>

      </View>


      {/* ================================================== */}
      {/* CURRENT RISK */}
      {/* ================================================== */}

      <View style={styles.riskCard}>

        <Text style={styles.cardLabel}>
          CURRENT FLOOD RISK
        </Text>

        <View style={styles.riskRow}>

          <View>

            <Text style={styles.riskLevel}>
              {data.risk_level} RISK
            </Text>

            <Text style={styles.riskDescription}>
              Current flood risk assessment
            </Text>

          </View>

          <Text style={styles.riskScore}>
            {Math.round(riskScore)}%
          </Text>

        </View>


        <View style={styles.progressBackground}>

          <View
            style={[
              styles.progressFill,
              {
                width: `${riskScore}%`,
              },
            ]}
          />

        </View>


        <Text style={styles.riskSource}>
          Rainfall + drainage + elevation +
          spatial flood susceptibility
        </Text>

      </View>


      {/* ================================================== */}
      {/* 6-HOUR FORECAST */}
      {/* ================================================== */}

      <View style={styles.section}>

        <Text style={styles.sectionTitle}>
          6-HOUR FORECAST
        </Text>

        <Text style={styles.sectionSubtitle}>
          Live Open-Meteo hourly precipitation
        </Text>


        {forecast.length > 0 ? (

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.forecastContainer
            }
          >

            {forecast.map(
              (
                item,
                index
              ) => (

                <View
                  key={
                    `${item.time || item.hour}-${index}`
                  }
                  style={styles.forecastCard}
                >

                  <Text style={styles.forecastHour}>
                    {item.label}
                  </Text>

                  <Text style={styles.forecastTime}>
                    {formatForecastTime(
                      item.time
                    )}
                  </Text>


                  <Text style={styles.forecastRainfall}>
                    {Number(
                      item.rainfall
                    ).toFixed(1)}{" "}
                    mm
                  </Text>

                  <Text style={styles.forecastRainLabel}>
                    rainfall
                  </Text>


                  <View
                    style={
                      styles.forecastDivider
                    }
                  />


                  <Text style={styles.forecastRiskScore}>
                    {Math.round(
                      Number(
                        item.risk_score
                      ) || 0
                    )}%
                  </Text>

                  <Text
                    style={[
                      styles.forecastRiskLevel,
                      getRiskTextStyle(
                        item.risk_level
                      ),
                    ]}
                  >
                    {item.risk_level}
                  </Text>

                </View>

              )
            )}

          </ScrollView>

        ) : (

          <View style={styles.emptyForecast}>

            <Text style={styles.emptyForecastText}>
              6-hour forecast unavailable.
            </Text>

          </View>

        )}

      </View>


      {/* ================================================== */}
      {/* CONTRIBUTING FACTORS */}
      {/* ================================================== */}

      <View style={styles.section}>

        <Text style={styles.sectionTitle}>
          CONTRIBUTING FACTORS
        </Text>


        {/* RAINFALL */}

        <View style={styles.factorCard}>

          <View style={styles.factorHeader}>

            <Text style={styles.factorTitle}>
              Rainfall Intensity
            </Text>

            <Text style={styles.factorValue}>
              {rainfall.toFixed(1)} mm
            </Text>

          </View>

          <Text style={styles.factorDescription}>

            {data.rainfall_level}

            {data.rainfall_source
              ? ` • ${data.rainfall_source}`
              : ""}

          </Text>

        </View>


        {/* DRAINAGE */}

        <View style={styles.factorCard}>

          <View style={styles.factorHeader}>

            <Text style={styles.factorTitle}>
              Drainage Capacity
            </Text>

            <Text style={styles.factorValue}>
              {Math.round(
                drainageCapacity
              )}%
            </Text>

          </View>


          <View
            style={
              styles.factorProgressBackground
            }
          >

            <View
              style={[
                styles.factorProgressFill,
                {
                  width:
                    `${drainageCapacity}%`,
                },
              ]}
            />

          </View>


          <Text style={styles.factorDescription}>
            {drainageLevel} drainage stress
          </Text>

        </View>


        {/* ELEVATION */}

        <View style={styles.factorCard}>

          <View style={styles.factorHeader}>

            <Text style={styles.factorTitle}>
              Elevation Risk
            </Text>

            <Text style={styles.factorValue}>
              {Math.round(
                elevationRisk
              )}%
            </Text>

          </View>

          <Text style={styles.factorDescription}>
            Elevation:{" "}
            {Number(
              data.elevation_m || 0
            ).toFixed(1)}
            {" "}m
          </Text>

        </View>


        {/* HISTORICAL */}

        <View style={styles.factorCard}>

          <View style={styles.factorHeader}>

            <Text style={styles.factorTitle}>
              Historical Flood Risk
            </Text>

            <Text style={styles.factorValue}>
              {Math.round(
                historicalRisk
              )}%
            </Text>

          </View>

          <Text style={styles.factorDescription}>
            Random Forest spatial susceptibility
          </Text>

        </View>


        {/* DRAIN DETAILS */}

        <View style={styles.factorCard}>

          <Text style={styles.factorTitle}>
            Drainage Condition
          </Text>

          <Text style={styles.factorDescription}>
            Status:{" "}
            {data.drain_status || "N/A"}
          </Text>

          <Text style={styles.factorDescription}>
            Flow:{" "}
            {data.water_flow || "N/A"}
          </Text>

          <Text style={styles.factorDescription}>
            Drain distance:{" "}
            {data.nearest_drain_distance_km !== undefined
              ? `${data.nearest_drain_distance_km.toFixed(3)} km`
              : "N/A"}
          </Text>

        </View>

      </View>


      {/* ================================================== */}
      {/* FLOOD ONSET */}
      {/* ================================================== */}

      <View style={styles.onsetCard}>

        <Text style={styles.onsetLabel}>
          ESTIMATED FLOOD ONSET
        </Text>

        <Text style={styles.onsetValue}>
          {data.onset_estimate ||
            "Unavailable"}
        </Text>

        <Text style={styles.onsetDescription}>
          Based on current rainfall and
          spatial flood susceptibility.
        </Text>

      </View>


      {/* ================================================== */}
      {/* AI ASSESSMENT */}
      {/* ================================================== */}

      <View style={styles.aiCard}>

        <Text style={styles.aiTitle}>
          FloodLink AI Assessment
        </Text>

        <Text style={styles.aiText}>

          Current flood risk in{" "}

          <Text style={styles.boldText}>
            {data.location}
          </Text>

          {" "}is{" "}

          <Text style={styles.boldText}>
            {data.risk_level}
          </Text>

          {" "}with a risk score of{" "}

          <Text style={styles.boldText}>
            {Math.round(riskScore)}%
          </Text>
          .

          {"\n\n"}

          Current rainfall is{" "}

          <Text style={styles.boldText}>
            {rainfall.toFixed(1)} mm
          </Text>
          .

          {"\n\n"}

          The FloodLink AI assessment combines
          rainfall intensity, drainage capacity,
          elevation risk, historical flood
          susceptibility and spatial conditions.

        </Text>

      </View>


      {/* ================================================== */}
      {/* DATA SOURCE */}
      {/* ================================================== */}

      <View style={styles.sourceCard}>

        <Text style={styles.sourceTitle}>
          DATA SOURCE
        </Text>

        <Text style={styles.sourceText}>
          Current rainfall:{" "}
          {data.rainfall_source ||
            "Open-Meteo"}
        </Text>

        <Text style={styles.sourceText}>
          Status:{" "}
          {data.rainfall_status ||
            "LIVE"}
        </Text>

        {data.rainfall_timestamp && (

          <Text style={styles.sourceText}>
            Updated:{" "}
            {data.rainfall_timestamp}
          </Text>

        )}

        <Text style={styles.sourceText}>
          6-hour forecast: Open-Meteo
        </Text>

        <Text style={styles.sourceText}>
          Flood model: Random Forest +
          Spatial Validation
        </Text>

      </View>

    </ScrollView>
  );
}


// ============================================================
// FORECAST TIME
// ============================================================

function formatForecastTime(
  time?: string
): string {

  if (!time) {
    return "--:--";
  }

  try {

    const parts =
      time.split("T");

    if (parts.length < 2) {
      return time;
    }

    return parts[1]
      .slice(0, 5);

  } catch {

    return "--:--";
  }
}


// ============================================================
// RISK TEXT STYLE
// ============================================================

function getRiskTextStyle(
  level?: string
) {

  switch (
    String(level).toUpperCase()
  ) {

    case "CRITICAL":
      return styles.criticalText;

    case "HIGH":
      return styles.highText;

    case "MODERATE":
      return styles.moderateText;

    default:
      return styles.lowText;
  }
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#F5F7FA",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },

  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#666",
    textAlign: "center",
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },

  location: {
    marginTop: 5,
    fontSize: 14,
    color: "#6B7280",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D32",
    marginRight: 6,
  },

  liveText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },

  riskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    elevation: 4,
  },

  cardLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 0.8,
  },

  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },

  riskLevel: {
    fontSize: 23,
    fontWeight: "800",
    color: "#111827",
  },

  riskDescription: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  riskScore: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111827",
  },

  progressBackground: {
    height: 10,
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },

  riskSource: {
    marginTop: 10,
    fontSize: 12,
    color: "#6B7280",
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  forecastContainer: {
    paddingTop: 14,
    paddingRight: 10,
  },

  forecastCard: {
    width: 125,
    minHeight: 175,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginRight: 12,
    elevation: 3,
  },

  forecastHour: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  forecastTime: {
    marginTop: 3,
    fontSize: 11,
    color: "#9CA3AF",
  },

  forecastRainfall: {
    marginTop: 15,
    fontSize: 21,
    fontWeight: "800",
    color: "#2563EB",
  },

  forecastRainLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#6B7280",
  },

  forecastDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  forecastRiskScore: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  forecastRiskLevel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
  },

  lowText: {
    color: "#2E7D32",
  },

  moderateText: {
    color: "#F59E0B",
  },

  highText: {
    color: "#EA580C",
  },

  criticalText: {
    color: "#DC2626",
  },

  emptyForecast: {
    marginTop: 14,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },

  emptyForecastText: {
    fontSize: 13,
    color: "#6B7280",
  },

  factorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    elevation: 2,
  },

  factorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  factorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  factorValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2563EB",
  },

  factorDescription: {
    marginTop: 7,
    fontSize: 12,
    color: "#6B7280",
  },

  factorProgressBackground: {
    height: 8,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },

  factorProgressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },

  onsetCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
  },

  onsetLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },

  onsetValue: {
    marginTop: 8,
    fontSize: 25,
    fontWeight: "900",
    color: "#111827",
  },

  onsetDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
  },

  aiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
  },

  aiTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  aiText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 21,
    color: "#4B5563",
  },

  boldText: {
    fontWeight: "800",
    color: "#111827",
  },

  sourceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    elevation: 2,
  },

  sourceTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    letterSpacing: 0.7,
  },

  sourceText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
  },

});