const API_BASE_URL = "http://192.168.143.82:8000";

export interface ForecastItem {
  hour: number;
  label: string;
  time?: string;
  rainfall: number;
  rainfall_unit: string;
  rainfall_score?: number;
  rainfall_level?: string;
  risk_score: number;
  risk_level: string;
}

export interface FloodPrediction {
  success: boolean;
  location: string;

  // Rainfall
  rainfall_mm_hr: number;
  rainfall_score: number;
  rainfall_level: string;

  rainfall_source?: string;
  rainfall_status?: string;
  rainfall_timestamp?: string;
  rainfall_is_real?: boolean;

  // Drainage
  drainage_capacity: number;
  drainage_risk: number;

  // Spatial / historical
  elevation_risk: number;
  historical_flood_risk: number;
  spatial_susceptibility: number;

  // Final risk
  risk_score: number;
  risk_level: string;

  // ML
  ml_prediction: number | string;
  ml_flood_probability: number;
  ml_background_probability: number;

  ml_model: string;
  rainfall_used_by_ml: boolean;

  // Real drainage/elevation details
  elevation_m?: number;
  nearest_drain_distance_km?: number;
  drain_width_m?: number;
  drain_depth_m?: number;
  drain_length_km?: number;
  drain_type?: string;
  water_flow?: string;
  drain_status?: string;

  // Flood onset
  onset_estimate?: string;

  // Model information
  model_role?: string;
  rainfall_role?: string;
  prediction_pipeline?: string;

  // 6-hour forecast
  forecast?: ForecastItem[];
  forecast_source?: string;
  forecast_hours?: number;
}


/*
 * POST /api/predict
 *
 * Manual rainfall testing.
 */
export async function predictFlood(
  rainfall_mm_hr: number
): Promise<FloodPrediction> {

  const response = await fetch(
    `${API_BASE_URL}/api/predict`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },

      body: JSON.stringify({
        rainfall_mm_hr,
      }),
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `API Error: ${response.status} - ${errorText}`
    );
  }

  const data: FloodPrediction =
    await response.json();

  return data;
}


/*
 * GET /api/flood-risk
 *
 * Main live endpoint.
 *
 * Returns:
 * - Current live rainfall
 * - Current flood risk
 * - Drainage
 * - Elevation
 * - ML prediction
 * - Flood onset
 * - 6-hour forecast
 */
export async function getFloodRisk():
  Promise<FloodPrediction> {

  const response = await fetch(
    `${API_BASE_URL}/api/flood-risk`,
    {
      method: "GET",

      headers: {
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Flood Risk API Error: ${response.status} - ${errorText}`
    );
  }

  const data: FloodPrediction =
    await response.json();

  return data;
}


/*
 * POST /api/flood-risk
 *
 * If rainfall is supplied:
 *   uses manual rainfall.
 *
 * If no rainfall is supplied:
 *   backend uses live rainfall.
 */
export async function postFloodRisk(
  rainfall_mm_hr?: number
): Promise<FloodPrediction> {

  const body =
    rainfall_mm_hr === undefined
      ? {}
      : {
          rainfall_mm_hr,
        };

  const response = await fetch(
    `${API_BASE_URL}/api/flood-risk`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },

      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Flood Risk POST Error: ${response.status} - ${errorText}`
    );
  }

  const data: FloodPrediction =
    await response.json();

  return data;
}


/*
 * Alerts API
 */
export interface FloodAlert {
  type: string;
  title: string;
  message: string;
  risk_score: number;
}

export interface AlertsResponse {
  success: boolean;
  location: string;

  alerts: FloodAlert[];

  current_risk_score: number;
  current_risk_level: string;

  rainfall_mm_hr: number;

  rainfall_source?: string;
  rainfall_status?: string;
  rainfall_timestamp?: string;
  rainfall_is_real?: boolean;
}


/*
 * GET /api/alerts
 */
export async function getAlerts():
  Promise<AlertsResponse> {

  const response = await fetch(
    `${API_BASE_URL}/api/alerts`,
    {
      method: "GET",

      headers: {
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Alerts API Error: ${response.status} - ${errorText}`
    );
  }

  const data: AlertsResponse =
    await response.json();

  return data;
}