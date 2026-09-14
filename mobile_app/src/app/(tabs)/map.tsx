import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";

import {
  getFloodRisk,
  FloodPrediction,
} from "../../services/api";

const PILOT_LAT = 12.9815;
const PILOT_LON = 80.2180;
const PILOT_RADIUS = 2200;

type FloodRiskData = {
  location: string;
  risk_score: number;
  risk_level: string;

  // Open-Meteo current precipitation value.
  // Displayed as mm (last hour), not mm/hr.
  rainfall_mm: number;

  rainfall_source?: string;
  rainfall_status?: string;
  rainfall_timestamp?: string;
  rainfall_is_real?: boolean;

  drainage_capacity: number;
  drainage_risk: number;
  elevation_risk: number;
  historical_flood_risk: number;

  onset_estimate?: string;
};

function getRiskColor(score: number): string {
  if (score >= 80) return "#7f0000";
  if (score >= 65) return "#d32f2f";
  if (score >= 40) return "#f57c00";
  return "#2e7d32";
}

function getRiskLevel(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MODERATE";
  return "LOW";
}

function mapFloodRiskData(result: FloodPrediction): FloodRiskData {
  const rainfallMm = Number(result.rainfall_mm_hr) || 0;
  const riskScore = Number(result.risk_score) || 0;

  return {
    location: result.location,

    risk_score: riskScore,
    risk_level:
      result.risk_level || getRiskLevel(riskScore),

    // IMPORTANT:
    // Backend field is rainfall_mm_hr for compatibility,
    // but it comes from Open-Meteo current.precipitation.
    // We therefore display it as mm (last hour).
    rainfall_mm: rainfallMm,

    rainfall_source: result.rainfall_source,
    rainfall_status: result.rainfall_status,
    rainfall_timestamp: result.rainfall_timestamp,
    rainfall_is_real: result.rainfall_is_real,

    drainage_capacity:
      Number(result.drainage_capacity) || 0,

    drainage_risk:
      Number(result.drainage_risk) || 0,

    elevation_risk:
      Number(result.elevation_risk) || 0,

    historical_flood_risk:
      Number(result.historical_flood_risk) || 0,

    onset_estimate: result.onset_estimate,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildMapHtml(data: FloodRiskData): string {
  const riskColor = getRiskColor(data.risk_score);

  const rainfall = data.rainfall_mm.toFixed(1);
  const riskScore = data.risk_score.toFixed(1);

  const location = escapeHtml(data.location);

  const rainfallSource = escapeHtml(
    data.rainfall_source || "Open-Meteo"
  );

  const rainfallStatus = escapeHtml(
    data.rainfall_status || "LIVE"
  );

  const onset = escapeHtml(
    data.onset_estimate || "Not available"
  );

  const riskLevel = escapeHtml(
    data.risk_level || getRiskLevel(data.risk_score)
  );

  const drainageCapacity =
    data.drainage_capacity.toFixed(1);

  const drainageRisk =
    data.drainage_risk.toFixed(1);

  const elevationRisk =
    data.elevation_risk.toFixed(1);

  const historicalRisk =
    data.historical_flood_risk.toFixed(1);

  return `
<!DOCTYPE html>
<html>
<head>

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
/>

<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

<script
  src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">
</script>

<style>

html,
body,
#map {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

body {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Arial,
    sans-serif;
}

.live-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;

  background: white;
  border-radius: 12px;

  padding: 10px 14px;

  box-shadow:
    0 2px 8px rgba(0,0,0,0.18);

  font-size: 13px;
  font-weight: 700;

  color: #222;
}

.live-dot {
  display: inline-block;

  width: 8px;
  height: 8px;

  border-radius: 50%;

  background: #2e7d32;

  margin-right: 6px;
}

.legend {
  position: absolute;

  bottom: 20px;
  right: 12px;

  z-index: 1000;

  background: white;

  padding: 10px 12px;

  border-radius: 10px;

  box-shadow:
    0 2px 8px rgba(0,0,0,0.18);

  font-size: 12px;
}

.legend-title {
  font-weight: 700;
  margin-bottom: 7px;
}

.legend-row {
  display: flex;
  align-items: center;

  margin: 5px 0;
}

.legend-color {
  width: 14px;
  height: 14px;

  border-radius: 50%;

  margin-right: 7px;
}

.popup-title {
  font-size: 15px;
  font-weight: 700;

  margin-bottom: 8px;
}

.popup-row {
  margin: 4px 0;
}

.gcc-title {
  font-size: 14px;
  font-weight: 700;

  margin-bottom: 7px;
}

</style>

</head>

<body>

<div id="map"></div>

<div class="live-badge">
  <span class="live-dot"></span>
  LIVE RAIN:
  ${rainfall} mm (last hour)
</div>

<div class="legend">

  <div class="legend-title">
    Flood Risk
  </div>

  <div class="legend-row">
    <span
      class="legend-color"
      style="background:#2e7d32">
    </span>
    Low
  </div>

  <div class="legend-row">
    <span
      class="legend-color"
      style="background:#f57c00">
    </span>
    Moderate
  </div>

  <div class="legend-row">
    <span
      class="legend-color"
      style="background:#d32f2f">
    </span>
    High
  </div>

  <div class="legend-row">
    <span
      class="legend-color"
      style="background:#7f0000">
    </span>
    Critical
  </div>

  <div class="legend-row">
    <span
      class="legend-color"
      style="
        background:#1565c0;
        border-radius:2px;
      ">
    </span>
    GCC Drainage
  </div>

</div>

<script>

const PILOT_LAT = ${PILOT_LAT};
const PILOT_LON = ${PILOT_LON};
const PILOT_RADIUS = ${PILOT_RADIUS};

const map = L.map("map", {
  zoomControl: true
}).setView(
  [PILOT_LAT, PILOT_LON],
  13
);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      "&copy; OpenStreetMap contributors"
  }
).addTo(map);

// --------------------------------------------------
// PILOT AREA
// --------------------------------------------------

const pilotCircle = L.circle(
  [PILOT_LAT, PILOT_LON],
  {
    radius: PILOT_RADIUS,

    color: "${riskColor}",

    fillColor: "${riskColor}",

    fillOpacity: 0.12,

    weight: 3
  }
).addTo(map);

pilotCircle.bindPopup(\`
  <div class="popup-title">
    FloodLink AI — Velachery Pilot
  </div>

  <div class="popup-row">
    <b>Location:</b>
    ${location}
  </div>

  <div class="popup-row">
    <b>Risk:</b>
    ${riskLevel}
  </div>

  <div class="popup-row">
    <b>Risk Score:</b>
    ${riskScore}/100
  </div>

  <div class="popup-row">
    <b>Rainfall:</b>
    ${rainfall} mm (last hour)
  </div>

  <div class="popup-row">
    <b>Rainfall Source:</b>
    ${rainfallSource}
  </div>

  <div class="popup-row">
    <b>Status:</b>
    ${rainfallStatus}
  </div>

  <div class="popup-row">
    <b>Drainage Capacity:</b>
    ${drainageCapacity}
  </div>

  <div class="popup-row">
    <b>Drainage Risk:</b>
    ${drainageRisk}
  </div>

  <div class="popup-row">
    <b>Elevation Risk:</b>
    ${elevationRisk}
  </div>

  <div class="popup-row">
    <b>Historical Flood Risk:</b>
    ${historicalRisk}
  </div>

  <div class="popup-row">
    <b>Estimated Onset:</b>
    ${onset}
  </div>
\`);

// --------------------------------------------------
// PILOT MARKER
// --------------------------------------------------

const pilotMarker = L.marker([
  PILOT_LAT,
  PILOT_LON
]).addTo(map);

pilotMarker.bindPopup(\`
  <div class="popup-title">
    FloodLink AI
  </div>

  <div class="popup-row">
    <b>Pilot Area:</b>
    Velachery, Chennai
  </div>

  <div class="popup-row">
    <b>Current Risk:</b>
    ${riskLevel}
  </div>

  <div class="popup-row">
    <b>Risk Score:</b>
    ${riskScore}/100
  </div>

  <div class="popup-row">
    <b>Rainfall:</b>
    ${rainfall} mm (last hour)
  </div>

  <div class="popup-row">
    <b>Source:</b>
    ${rainfallSource}
  </div>
\`);

// --------------------------------------------------
// HIGH-RISK MARKER
// --------------------------------------------------

const currentRiskScore = ${data.risk_score};

if (currentRiskScore >= 65) {

  const highRiskMarker = L.circleMarker(
    [PILOT_LAT, PILOT_LON],
    {
      radius: 11,

      color: "#ffffff",

      weight: 2,

      fillColor: "${riskColor}",

      fillOpacity: 0.95
    }
  ).addTo(map);

  highRiskMarker.bindPopup(\`
    <div class="popup-title">
      High-Risk Flood Area
    </div>

    <div class="popup-row">
      <b>Risk Level:</b>
      ${riskLevel}
    </div>

    <div class="popup-row">
      <b>Risk Score:</b>
      ${riskScore}/100
    </div>

    <div class="popup-row">
      <b>Rainfall:</b>
      ${rainfall} mm (last hour)
    </div>

    <div class="popup-row">
      <b>Estimated Onset:</b>
      ${onset}
    </div>
  \`);

}

// --------------------------------------------------
// GCC STORM WATER DRAINAGE
// --------------------------------------------------

const GCC_DRAINAGE_URL =
  "https://gisgcc.chennaicorporation.gov.in/server/rest/services/GCCDepts/GCC_COLLABORATION_LAYER/MapServer/8/query";

const params = new URLSearchParams({
  where: "1=1",

  outFields:
    "zone,ward,location,drain_type,water_flow,status,dlen_km",

  f: "geojson",

  returnGeometry: "true",

  outSR: "4326"
});

fetch(
  GCC_DRAINAGE_URL + "?" + params.toString()
)
.then(response => {

  if (!response.ok) {
    throw new Error(
      "GCC drainage request failed"
    );
  }

  return response.json();

})
.then(geojson => {

  if (
    !geojson ||
    !geojson.features
  ) {
    return;
  }

  const drainageLayer =
    L.geoJSON(
      geojson,
      {

        style: function() {

          return {
            color: "#1565c0",

            weight: 3,

            opacity: 0.8
          };

        },

        onEachFeature:
          function(feature, layer) {

            const p =
              feature.properties || {};

            const zone =
              p.zone ?? "N/A";

            const ward =
              p.ward ?? "N/A";

            const location =
              p.location ?? "N/A";

            const drainType =
              p.drain_type ?? "N/A";

            const waterFlow =
              p.water_flow ?? "N/A";

            const status =
              p.status ?? "N/A";

            const length =
              p.dlen_km ?? "N/A";

            layer.bindPopup(\`

              <div class="gcc-title">
                GCC Storm Water Drain
              </div>

              <div class="popup-row">
                <b>Zone:</b>
                \${zone}
              </div>

              <div class="popup-row">
                <b>Ward:</b>
                \${ward}
              </div>

              <div class="popup-row">
                <b>Location:</b>
                \${location}
              </div>

              <div class="popup-row">
                <b>Drain Type:</b>
                \${drainType}
              </div>

              <div class="popup-row">
                <b>Water Flow:</b>
                \${waterFlow}
              </div>

              <div class="popup-row">
                <b>Status:</b>
                \${status}
              </div>

              <div class="popup-row">
                <b>Length:</b>
                \${length} km
              </div>

            \`);

          }

      }
    );

  drainageLayer.addTo(map);

})
.catch(error => {

  console.log(
    "GCC drainage layer error:",
    error
  );

});

// --------------------------------------------------
// MAP EVENTS
// --------------------------------------------------

map.on(
  "click",
  function(e) {

    console.log(
      "Map clicked:",
      e.latlng.lat,
      e.latlng.lng
    );

  }
);

</script>

</body>
</html>
`;
}

export default function MapScreen() {
  const router = useRouter();

  const [data, setData] =
    useState<FloodRiskData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  async function loadFloodRisk() {
    try {

      setLoading(true);
      setError(null);

      const result =
        await getFloodRisk();

      if (!result.success) {
        throw new Error(
          "Flood risk API returned unsuccessful response."
        );
      }

      const mappedData =
        mapFloodRiskData(result);

      setData(mappedData);

    } catch (err: any) {

      console.error(
        "Map Flood Risk Error:",
        err
      );

      setError(
        err?.message ||
        "Unable to load flood risk data."
      );

    } finally {

      setLoading(false);

    }
  }

  useEffect(() => {

    loadFloodRisk();

    const interval =
      setInterval(
        loadFloodRisk,
        5 * 60 * 1000
      );

    return () =>
      clearInterval(interval);

  }, []);

  if (loading && !data) {

    return (
      <View style={styles.loadingContainer}>

        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading live flood risk...
        </Text>

      </View>
    );

  }

  const safeData: FloodRiskData =
    data || {
      location:
        "Velachery, Chennai",

      risk_score: 0,

      risk_level: "LOW",

      rainfall_mm: 0,

      rainfall_source:
        "Open-Meteo",

      rainfall_status:
        "LIVE",

      rainfall_is_real:
        true,

      drainage_capacity: 0,

      drainage_risk: 0,

      elevation_risk: 0,

      historical_flood_risk: 0,

      onset_estimate:
        "Not available",
    };

  const mapHtml =
    buildMapHtml(safeData);

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ‹
          </Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>

          <Text style={styles.headerTitle}>
            Flood Risk Map
          </Text>

          <Text style={styles.headerSubtitle}>
            Velachery • Chennai
          </Text>

        </View>

        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                safeData.rainfall_status === "LIVE"
                  ? "#2e7d32"
                  : "#f57c00",
            },
          ]}
        />

      </View>

      {/* ERROR BAR */}
      {error && (
        <View style={styles.errorBar}>

          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity
            onPress={loadFloodRisk}
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </TouchableOpacity>

        </View>
      )}

      {/* MAP */}
      <View style={styles.mapContainer}>

        <WebView
          originWhitelist={["*"]}
          source={{
            html: mapHtml,
          }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View
              style={styles.webLoading}
            >
              <ActivityIndicator
                size="small"
              />

              <Text
                style={
                  styles.webLoadingText
                }
              >
                Loading map...
              </Text>
            </View>
          )}
        />

        {/* LIVE STATUS */}
        <View style={styles.liveStatus}>

          <View style={styles.liveIndicator} />

          <Text style={styles.liveStatusText}>
            {safeData.rainfall_status ===
            "LIVE"
              ? "Live Data"
              : "Data Available"}
          </Text>

        </View>

      </View>

      {/* BOTTOM PANEL */}
      <View style={styles.bottomPanel}>

        <View style={styles.riskHeader}>

          <View>

            <Text style={styles.locationText}>
              {safeData.location}
            </Text>

            <Text style={styles.sourceText}>
              Rainfall:{" "}
              {safeData.rainfall_mm.toFixed(1)}
              {" "}mm (last hour)
            </Text>

          </View>

          <View
            style={[
              styles.riskBadge,
              {
                backgroundColor:
                  getRiskColor(
                    safeData.risk_score
                  ),
              },
            ]}
          >

            <Text style={styles.riskBadgeText}>
              {safeData.risk_level}
            </Text>

          </View>

        </View>

        <View style={styles.statsRow}>

          <View style={styles.statItem}>

            <Text style={styles.statValue}>
              {safeData.risk_score.toFixed(0)}
            </Text>

            <Text style={styles.statLabel}>
              Risk Score
            </Text>

          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>

            <Text style={styles.statValue}>
              {safeData.drainage_capacity.toFixed(0)}
            </Text>

            <Text style={styles.statLabel}>
              Drainage Capacity
            </Text>

          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>

            <Text style={styles.statValue}>
              {safeData.elevation_risk.toFixed(0)}
            </Text>

            <Text style={styles.statLabel}>
              Elevation Risk
            </Text>

          </View>

        </View>

        <TouchableOpacity
          style={styles.analyseButton}
          onPress={() =>
            router.push("/analysis")
          }
        >

          <Text style={styles.analyseButtonText}>
            ANALYSE FLOOD RISK
          </Text>

        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  header: {
    height: Platform.OS === "ios" ? 92 : 70,

    paddingTop:
      Platform.OS === "ios" ? 42 : 20,

    paddingHorizontal: 16,

    flexDirection: "row",

    alignItems: "center",

    borderBottomWidth: 1,

    borderBottomColor: "#e5e7eb",

    backgroundColor: "#ffffff",

    zIndex: 10,
  },

  backButton: {
    width: 40,
    height: 40,

    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    fontSize: 36,
    fontWeight: "300",

    lineHeight: 40,
  },

  headerTitleContainer: {
    flex: 1,
    marginLeft: 6,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",

    color: "#111827",
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 12,

    color: "#6b7280",
  },

  statusDot: {
    width: 10,
    height: 10,

    borderRadius: 5,
  },

  errorBar: {
    minHeight: 42,

    paddingHorizontal: 14,

    paddingVertical: 8,

    backgroundColor: "#ffebee",

    borderBottomWidth: 1,

    borderBottomColor: "#ffcdd2",

    flexDirection: "row",

    alignItems: "center",
  },

  errorText: {
    flex: 1,

    fontSize: 12,

    color: "#b71c1c",
  },

  retryText: {
    fontSize: 13,

    fontWeight: "700",

    color: "#c62828",

    marginLeft: 10,
  },

  mapContainer: {
    flex: 1,

    position: "relative",
  },

  webview: {
    flex: 1,
  },

  webLoading: {
    flex: 1,

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#ffffff",
  },

  webLoadingText: {
    marginTop: 8,

    fontSize: 12,

    color: "#6b7280",
  },

  liveStatus: {
    position: "absolute",

    top: 12,

    right: 12,

    backgroundColor: "#ffffff",

    paddingHorizontal: 10,

    paddingVertical: 7,

    borderRadius: 16,

    flexDirection: "row",

    alignItems: "center",

    shadowOpacity: 0.15,

    shadowRadius: 5,

    elevation: 4,
  },

  liveIndicator: {
    width: 7,
    height: 7,

    borderRadius: 4,

    backgroundColor: "#2e7d32",

    marginRight: 6,
  },

  liveStatusText: {
    fontSize: 11,

    fontWeight: "600",

    color: "#374151",
  },

  bottomPanel: {
    backgroundColor: "#ffffff",

    paddingHorizontal: 16,

    paddingTop: 14,

    paddingBottom:
      Platform.OS === "ios" ? 28 : 16,

    borderTopLeftRadius: 18,

    borderTopRightRadius: 18,

    shadowOpacity: 0.12,

    shadowRadius: 8,

    elevation: 8,
  },

  riskHeader: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  locationText: {
    fontSize: 16,

    fontWeight: "700",

    color: "#111827",
  },

  sourceText: {
    marginTop: 3,

    fontSize: 11,

    color: "#6b7280",
  },

  riskBadge: {
    paddingHorizontal: 12,

    paddingVertical: 7,

    borderRadius: 14,
  },

  riskBadgeText: {
    color: "#ffffff",

    fontSize: 11,

    fontWeight: "800",
  },

  statsRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 14,

    paddingVertical: 8,
  },

  statItem: {
    flex: 1,

    alignItems: "center",
  },

  statValue: {
    fontSize: 18,

    fontWeight: "800",

    color: "#111827",
  },

  statLabel: {
    marginTop: 3,

    fontSize: 9,

    color: "#6b7280",

    textAlign: "center",
  },

  divider: {
    width: 1,

    height: 28,

    backgroundColor: "#e5e7eb",
  },

  analyseButton: {
    marginTop: 10,

    height: 46,

    borderRadius: 12,

    backgroundColor: "#1565c0",

    justifyContent: "center",

    alignItems: "center",
  },

  analyseButtonText: {
    color: "#ffffff",

    fontSize: 13,

    fontWeight: "800",

    letterSpacing: 0.4,
  },

  loadingContainer: {
    flex: 1,

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#ffffff",
  },

  loadingText: {
    marginTop: 12,

    fontSize: 13,

    color: "#6b7280",
  },

});