from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import requests

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# FLOODLINK AI BACKEND
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "ml" / "floodlink_pipeline.joblib"
DATA_PATH = BASE_DIR / "data" / "processed" / "floodlink_ml_dataset.csv"


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="FloodLink AI Backend",
    version="2.3.0",
    description="Urban Flood Nowcasting API for FloodLink AI",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PILOT LOCATION
# ============================================================

PILOT_LOCATION = "Velachery, Chennai"

PILOT_LAT = 12.9815
PILOT_LON = 80.2180


# ============================================================
# LOAD ML MODEL
# ============================================================

try:

    model = joblib.load(MODEL_PATH)

    MODEL_STATUS = "loaded"

    print(
        f"Model loaded successfully: {MODEL_PATH}"
    )

except Exception as e:

    model = None

    MODEL_STATUS = f"error: {e}"

    print(
        f"Model loading failed: {e}"
    )


# ============================================================
# LOAD DATASET
# ============================================================

try:

    data = pd.read_csv(DATA_PATH)

    numeric_columns = [
        "latitude",
        "longitude",
        "nearest_drain_distance_km",
        "drain_width_m",
        "drain_depth_m",
        "drain_length_km",
        "elevation_m",
    ]

    for column in numeric_columns:

        if column in data.columns:

            data[column] = pd.to_numeric(
                data[column],
                errors="coerce"
            )

    required_columns = [
        "latitude",
        "longitude",
        "nearest_drain_distance_km",
        "drain_width_m",
        "drain_depth_m",
        "drain_length_km",
        "elevation_m",
        "drain_type",
        "water_flow",
        "drain_status",
    ]

    data = data.dropna(
        subset=required_columns
    ).reset_index(drop=True)

    DATA_STATUS = "loaded"

    print(
        f"Dataset loaded successfully: {DATA_PATH}"
    )

    print(
        f"Dataset rows: {len(data)}"
    )

except Exception as e:

    data = pd.DataFrame()

    DATA_STATUS = f"error: {e}"

    print(
        f"Dataset loading failed: {e}"
    )


# ============================================================
# REQUEST MODELS
# ============================================================

class RainfallRequest(BaseModel):

    rainfall_mm_hr: float


class FloodRiskUpdate(BaseModel):

    rainfall_mm_hr: Optional[float] = None


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clamp(
    value: float,
    minimum: float = 0.0,
    maximum: float = 100.0
) -> float:

    return max(
        minimum,
        min(
            maximum,
            float(value)
        )
    )


# ============================================================
# LIVE RAINFALL - OPEN-METEO
# ============================================================

def get_live_rainfall():

    """
    Fetch current rainfall information from Open-Meteo
    for the Velachery pilot location.
    """

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": PILOT_LAT,
        "longitude": PILOT_LON,
        "current": "precipitation,rain,showers",
        "timezone": "Asia/Kolkata",
    }

    try:

        print(
            "Fetching live rainfall from Open-Meteo..."
        )

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        response.raise_for_status()

        weather_data = response.json()

        current = weather_data.get(
            "current",
            {}
        )

        precipitation = current.get(
            "precipitation"
        )

        if precipitation is None:

            raise ValueError(
                "Open-Meteo did not return current precipitation"
            )

        rainfall = max(
            0.0,
            float(precipitation)
        )

        timestamp = current.get(
            "time"
        )

        print(
            f"Live rainfall: {rainfall} mm"
        )

        print(
            f"Rainfall timestamp: {timestamp}"
        )

        return {

            "rainfall_mm_hr":
                rainfall,

            "rainfall_source":
                "Open-Meteo",

            "rainfall_status":
                "LIVE",

            "rainfall_timestamp":
                timestamp,

            "rainfall_is_real":
                True,
        }

    except Exception as e:

        print(
            f"Live rainfall fetch failed: {e}"
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Live rainfall service unavailable. "
                f"Open-Meteo error: {str(e)}"
            )
        )


# ============================================================
# 6-HOUR WEATHER FORECAST - OPEN-METEO
# ============================================================

def get_6_hour_forecast():

    """
    Fetch the current hour + next 5 hours of hourly
    precipitation from Open-Meteo.

    Total forecast entries = 6.

    Rainfall here is hourly precipitation amount in mm.
    """

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": PILOT_LAT,
        "longitude": PILOT_LON,

        "hourly": (
            "precipitation,"
            "rain,"
            "showers"
        ),

        "forecast_hours": 6,

        "timezone": "Asia/Kolkata",

        "past_hours": 0,
    }

    try:

        print(
            "Fetching 6-hour forecast from Open-Meteo..."
        )

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        response.raise_for_status()

        weather_data = response.json()

        hourly = weather_data.get(
            "hourly",
            {}
        )

        times = hourly.get(
            "time",
            []
        )

        precipitation_values = hourly.get(
            "precipitation",
            []
        )

        if not times or not precipitation_values:

            raise ValueError(
                "Open-Meteo did not return hourly forecast data"
            )

        forecast = []

        count = min(
            6,
            len(times),
            len(precipitation_values)
        )

        for index in range(count):

            rainfall = max(
                0.0,
                float(
                    precipitation_values[index]
                    if precipitation_values[index] is not None
                    else 0.0
                )
            )

            timestamp = str(
                times[index]
            )

            forecast.append({

                "hour":
                    index,

                "label":
                    "Now"
                    if index == 0
                    else f"+{index}h",

                "time":
                    timestamp,

                "rainfall":
                    round(
                        rainfall,
                        2
                    ),

                "rainfall_unit":
                    "mm",
            })

        print(
            f"Forecast entries received: {len(forecast)}"
        )

        return forecast

    except Exception as e:

        print(
            f"6-hour forecast fetch failed: {e}"
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "6-hour rainfall forecast unavailable. "
                f"Open-Meteo error: {str(e)}"
            )
        )


# ============================================================
# RAINFALL ANALYSIS
# ============================================================

def rainfall_analysis(
    rainfall: float
):

    rainfall = max(
        0.0,
        float(rainfall)
    )

    if rainfall < 20:

        level = "LOW"

        score = (
            rainfall / 20.0
        ) * 30.0

    elif rainfall < 50:

        level = "MODERATE"

        score = (
            30.0
            +
            (
                (rainfall - 20.0)
                / 30.0
            ) * 25.0
        )

    elif rainfall < 80:

        level = "HIGH"

        score = (
            55.0
            +
            (
                (rainfall - 50.0)
                / 30.0
            ) * 25.0
        )

    else:

        level = "CRITICAL"

        score = (
            80.0
            +
            min(
                (
                    (rainfall - 80.0)
                    / 40.0
                ) * 20.0,
                20.0
            )
        )

    return (
        clamp(score),
        level
    )


# ============================================================
# GET NEAREST REAL DATA ROW
# ============================================================

def get_nearest_pilot_row():

    if data.empty:

        return None

    temp = data.copy()

    temp["distance_to_pilot"] = np.sqrt(

        (
            temp["latitude"]
            - PILOT_LAT
        ) ** 2

        +

        (
            temp["longitude"]
            - PILOT_LON
        ) ** 2
    )

    row = (
        temp
        .sort_values(
            "distance_to_pilot"
        )
        .iloc[0]
    )

    return row


# ============================================================
# DRAINAGE RISK
# ============================================================

def calculate_drainage_risk(
    row
):

    if row is None:

        return 50.0

    distance = float(
        row[
            "nearest_drain_distance_km"
        ]
    )

    width = float(
        row[
            "drain_width_m"
        ]
    )

    depth = float(
        row[
            "drain_depth_m"
        ]
    )

    length = float(
        row[
            "drain_length_km"
        ]
    )

    status = str(
        row[
            "drain_status"
        ]
    ).strip().lower()

    # DISTANCE RISK

    if distance <= 0.05:

        distance_risk = 10.0

    elif distance <= 0.10:

        distance_risk = 25.0

    elif distance <= 0.25:

        distance_risk = 45.0

    elif distance <= 0.50:

        distance_risk = 65.0

    else:

        distance_risk = 85.0

    # WIDTH RISK

    if width >= 2.0:

        width_risk = 15.0

    elif width >= 1.0:

        width_risk = 30.0

    elif width >= 0.5:

        width_risk = 50.0

    else:

        width_risk = 75.0

    # DEPTH RISK

    if depth >= 1.5:

        depth_risk = 15.0

    elif depth >= 1.0:

        depth_risk = 30.0

    elif depth >= 0.5:

        depth_risk = 50.0

    else:

        depth_risk = 75.0

    # LENGTH RISK

    if length >= 1.0:

        length_risk = 20.0

    elif length >= 0.5:

        length_risk = 35.0

    elif length >= 0.2:

        length_risk = 50.0

    else:

        length_risk = 70.0

    # STATUS RISK

    if (
        "good" in status
        or "active" in status
        or "working" in status
    ):

        status_risk = 20.0

    elif (
        "fair" in status
        or "moderate" in status
    ):

        status_risk = 50.0

    elif (
        "poor" in status
        or "blocked" in status
    ):

        status_risk = 80.0

    elif (
        "bad" in status
        or "damaged" in status
    ):

        status_risk = 90.0

    else:

        status_risk = 60.0

    # COMBINED DRAINAGE RISK

    risk = (

        distance_risk * 0.30

        +

        width_risk * 0.20

        +

        depth_risk * 0.20

        +

        length_risk * 0.10

        +

        status_risk * 0.20
    )

    return clamp(risk)


# ============================================================
# ELEVATION RISK
# ============================================================

def calculate_elevation_risk(
    elevation
):

    elevation = float(
        elevation
    )

    risk = (
        100.0
        -
        (
            elevation / 50.0
        ) * 100.0
    )

    return clamp(risk)


# ============================================================
# ML PREDICTION
# ============================================================

def predict_ml(
    row
):

    if model is None:

        return (
            0,
            50.0,
            50.0
        )

    features = pd.DataFrame(
        [
            {
                "nearest_drain_distance_km":
                    float(
                        row[
                            "nearest_drain_distance_km"
                        ]
                    ),

                "drain_width_m":
                    float(
                        row[
                            "drain_width_m"
                        ]
                    ),

                "drain_depth_m":
                    float(
                        row[
                            "drain_depth_m"
                        ]
                    ),

                "drain_length_km":
                    float(
                        row[
                            "drain_length_km"
                        ]
                    ),

                "elevation_m":
                    float(
                        row[
                            "elevation_m"
                        ]
                    ),

                "drain_type":
                    str(
                        row[
                            "drain_type"
                        ]
                    ),

                "water_flow":
                    str(
                        row[
                            "water_flow"
                        ]
                    ),

                "drain_status":
                    str(
                        row[
                            "drain_status"
                        ]
                    ),
            }
        ]
    )

    try:

        prediction = int(
            model.predict(
                features
            )[0]
        )

        if hasattr(
            model,
            "predict_proba"
        ):

            probabilities = (
                model.predict_proba(
                    features
                )[0]
            )

            classes = list(
                model.classes_
            )

            if 1 in classes:

                flood_index = (
                    classes.index(1)
                )

                flood_probability = float(
                    probabilities[
                        flood_index
                    ]
                )

            else:

                flood_probability = 0.0

            if 0 in classes:

                background_index = (
                    classes.index(0)
                )

                background_probability = float(
                    probabilities[
                        background_index
                    ]
                )

            else:

                background_probability = (
                    1.0
                    -
                    flood_probability
                )

        else:

            flood_probability = (
                1.0
                if prediction == 1
                else 0.0
            )

            background_probability = (
                1.0
                -
                flood_probability
            )

        return (

            prediction,

            clamp(
                flood_probability * 100.0
            ),

            clamp(
                background_probability * 100.0
            )
        )

    except Exception as e:

        print(
            f"ML prediction error: {e}"
        )

        return (
            0,
            50.0,
            50.0
        )


# ============================================================
# RISK LEVEL
# ============================================================

def get_risk_level(
    score
):

    score = float(
        score
    )

    if score < 40:

        return "LOW"

    elif score < 65:

        return "MODERATE"

    elif score < 80:

        return "HIGH"

    else:

        return "CRITICAL"


# ============================================================
# ONSET ESTIMATION
# ============================================================

def estimate_onset(
    rainfall,
    risk_score
):

    rainfall = float(
        rainfall
    )

    risk_score = float(
        risk_score
    )

    if (
        risk_score >= 80
        or rainfall >= 80
    ):

        return "15-30 minutes"

    elif (
        risk_score >= 65
        or rainfall >= 50
    ):

        return "30-60 minutes"

    elif (
        risk_score >= 40
        or rainfall >= 20
    ):

        return "1-2 hours"

    else:

        return "2+ hours"


# ============================================================
# CALCULATE RISK FROM RAINFALL + SPATIAL CONDITIONS
# ============================================================

def calculate_risk_for_rainfall(
    rainfall,
    spatial_susceptibility
):

    (
        rainfall_score,
        rainfall_level
    ) = rainfall_analysis(
        rainfall
    )

    risk_score = (

        rainfall_score * 0.60

        +

        spatial_susceptibility * 0.40
    )

    # RAINFALL SAFETY FLOORS

    if rainfall >= 80:

        risk_score = max(
            risk_score,
            80.0
        )

    elif rainfall >= 50:

        risk_score = max(
            risk_score,
            65.0
        )

    elif rainfall >= 20:

        risk_score = max(
            risk_score,
            40.0
        )

    risk_score = clamp(
        risk_score
    )

    risk_level = get_risk_level(
        risk_score
    )

    return (
        rainfall_score,
        rainfall_level,
        risk_score,
        risk_level
    )


# ============================================================
# BUILD 6-HOUR FLOOD FORECAST
# ============================================================

def build_6_hour_flood_forecast(
    spatial_susceptibility
):

    weather_forecast = (
        get_6_hour_forecast()
    )

    flood_forecast = []

    for item in weather_forecast:

        rainfall = float(
            item["rainfall"]
        )

        (
            rainfall_score,
            rainfall_level,
            risk_score,
            risk_level
        ) = calculate_risk_for_rainfall(
            rainfall,
            spatial_susceptibility
        )

        flood_forecast.append({

            "hour":
                item["hour"],

            "label":
                item["label"],

            "time":
                item["time"],

            "rainfall":
                round(
                    rainfall,
                    2
                ),

            "rainfall_unit":
                "mm",

            "rainfall_score":
                round(
                    rainfall_score,
                    2
                ),

            "rainfall_level":
                rainfall_level,

            "risk_score":
                round(
                    risk_score,
                    2
                ),

            "risk_level":
                risk_level,
        })

    return flood_forecast


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {

        "success":
            True,

        "service":
            "FloodLink AI Backend",

        "version":
            "2.3.0",

        "location":
            PILOT_LOCATION,

        "model_status":
            MODEL_STATUS,

        "data_status":
            DATA_STATUS,

        "rainfall_source":
            "Open-Meteo",

    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {

        "success":
            True,

        "status":
            "healthy",

        "location":
            PILOT_LOCATION,

        "model_status":
            MODEL_STATUS,

        "data_status":
            DATA_STATUS,

        "rainfall_source":
            "Open-Meteo",

    }


# ============================================================
# MAIN PREDICTION API
# ============================================================

@app.post("/api/predict")
def predict_flood(
    request: RainfallRequest
):

    rainfall = float(
        request.rainfall_mm_hr
    )

    if rainfall < 0:

        raise HTTPException(
            status_code=400,
            detail="Rainfall cannot be negative"
        )

    (
        rainfall_score,
        rainfall_level
    ) = rainfall_analysis(
        rainfall
    )

    row = get_nearest_pilot_row()

    if row is None:

        raise HTTPException(
            status_code=500,
            detail="FloodLink dataset is not available"
        )

    # --------------------------------------------------------
    # DRAINAGE
    # --------------------------------------------------------

    drainage_risk = (
        calculate_drainage_risk(
            row
        )
    )

    drainage_capacity = clamp(
        100.0
        -
        drainage_risk
    )

    # --------------------------------------------------------
    # ELEVATION
    # --------------------------------------------------------

    elevation = float(
        row["elevation_m"]
    )

    elevation_risk = (
        calculate_elevation_risk(
            elevation
        )
    )

    # --------------------------------------------------------
    # ML
    # --------------------------------------------------------

    (
        ml_prediction,
        ml_flood_probability,
        ml_background_probability
    ) = predict_ml(
        row
    )

    # --------------------------------------------------------
    # HISTORICAL FLOOD RISK
    # --------------------------------------------------------

    historical_flood_risk = clamp(
        ml_flood_probability
    )

    # --------------------------------------------------------
    # SPATIAL SUSCEPTIBILITY
    # --------------------------------------------------------

    spatial_susceptibility = (

        ml_flood_probability * 0.50

        +

        drainage_risk * 0.25

        +

        elevation_risk * 0.25
    )

    spatial_susceptibility = clamp(
        spatial_susceptibility
    )

    # --------------------------------------------------------
    # FINAL RISK
    # --------------------------------------------------------

    (
        rainfall_score,
        rainfall_level,
        risk_score,
        risk_level
    ) = calculate_risk_for_rainfall(
        rainfall,
        spatial_susceptibility
    )

    # --------------------------------------------------------
    # ONSET
    # --------------------------------------------------------

    onset_estimate = (
        estimate_onset(
            rainfall,
            risk_score
        )
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {

        "success":
            True,

        "location":
            PILOT_LOCATION,

        "rainfall_mm_hr":
            round(
                rainfall,
                2
            ),

        "rainfall_score":
            round(
                rainfall_score,
                2
            ),

        "rainfall_level":
            rainfall_level,

        "drainage_capacity":
            round(
                drainage_capacity,
                2
            ),

        "drainage_risk":
            round(
                drainage_risk,
                2
            ),

        "elevation_risk":
            round(
                elevation_risk,
                2
            ),

        "historical_flood_risk":
            round(
                historical_flood_risk,
                2
            ),

        "spatial_susceptibility":
            round(
                spatial_susceptibility,
                2
            ),

        "risk_score":
            round(
                risk_score,
                2
            ),

        "risk_level":
            risk_level,

        "ml_prediction":
            ml_prediction,

        "ml_flood_probability":
            round(
                ml_flood_probability,
                2
            ),

        "ml_background_probability":
            round(
                ml_background_probability,
                2
            ),

        "ml_model":
            "Random Forest + Spatial Validation",

        "rainfall_used_by_ml":
            False,

        "elevation_m":
            round(
                elevation,
                2
            ),

        "nearest_drain_distance_km":
            round(
                float(
                    row[
                        "nearest_drain_distance_km"
                    ]
                ),
                4
            ),

        "drain_width_m":
            round(
                float(
                    row[
                        "drain_width_m"
                    ]
                ),
                2
            ),

        "drain_depth_m":
            round(
                float(
                    row[
                        "drain_depth_m"
                    ]
                ),
                2
            ),

        "drain_length_km":
            round(
                float(
                    row[
                        "drain_length_km"
                    ]
                ),
                4
            ),

        "drain_type":
            str(
                row[
                    "drain_type"
                ]
            ),

        "water_flow":
            str(
                row[
                    "water_flow"
                ]
            ),

        "drain_status":
            str(
                row[
                    "drain_status"
                ]
            ),

        "onset_estimate":
            onset_estimate,

    }


# ============================================================
# GET FLOOD RISK - LIVE RAINFALL + 6 HOUR FORECAST
# ============================================================

@app.get("/api/flood-risk")
def get_flood_risk():

    # --------------------------------------------------------
    # CURRENT LIVE RAINFALL
    # --------------------------------------------------------

    live_rainfall = (
        get_live_rainfall()
    )

    current_rainfall = (
        live_rainfall[
            "rainfall_mm_hr"
        ]
    )

    # --------------------------------------------------------
    # CURRENT FLOOD RISK
    # --------------------------------------------------------

    result = predict_flood(
        RainfallRequest(
            rainfall_mm_hr=
                current_rainfall
        )
    )

    # --------------------------------------------------------
    # 6-HOUR FORECAST
    # --------------------------------------------------------

    spatial_susceptibility = (
        result[
            "spatial_susceptibility"
        ]
    )

    forecast = (
        build_6_hour_flood_forecast(
            spatial_susceptibility
        )
    )

    # --------------------------------------------------------
    # LIVE RAINFALL METADATA
    # --------------------------------------------------------

    result["rainfall_source"] = (
        live_rainfall[
            "rainfall_source"
        ]
    )

    result["rainfall_status"] = (
        live_rainfall[
            "rainfall_status"
        ]
    )

    result["rainfall_timestamp"] = (
        live_rainfall[
            "rainfall_timestamp"
        ]
    )

    result["rainfall_is_real"] = (
        live_rainfall[
            "rainfall_is_real"
        ]
    )

    # --------------------------------------------------------
    # FORECAST
    # --------------------------------------------------------

    result["forecast"] = forecast

    result["forecast_source"] = (
        "Open-Meteo"
    )

    result["forecast_hours"] = (
        len(forecast)
    )

    return result


# ============================================================
# POST FLOOD RISK
# ============================================================

@app.post("/api/flood-risk")
def post_flood_risk(
    request: FloodRiskUpdate
):

    # --------------------------------------------------------
    # NO MANUAL VALUE -> LIVE RAINFALL
    # --------------------------------------------------------

    if request.rainfall_mm_hr is None:

        live_rainfall = (
            get_live_rainfall()
        )

        rainfall = (
            live_rainfall[
                "rainfall_mm_hr"
            ]
        )

        result = predict_flood(
            RainfallRequest(
                rainfall_mm_hr=
                    rainfall
            )
        )

        result["rainfall_source"] = (
            live_rainfall[
                "rainfall_source"
            ]
        )

        result["rainfall_status"] = (
            live_rainfall[
                "rainfall_status"
            ]
        )

        result["rainfall_timestamp"] = (
            live_rainfall[
                "rainfall_timestamp"
            ]
        )

        result["rainfall_is_real"] = (
            live_rainfall[
                "rainfall_is_real"
            ]
        )

        return result

    # --------------------------------------------------------
    # MANUAL / TEST VALUE
    # --------------------------------------------------------

    rainfall = float(
        request.rainfall_mm_hr
    )

    return predict_flood(
        RainfallRequest(
            rainfall_mm_hr=
                rainfall
        )
    )


# ============================================================
# ALERTS - LIVE RAINFALL
# ============================================================

@app.get("/api/alerts")
def get_alerts():

    live_rainfall = (
        get_live_rainfall()
    )

    rainfall = (
        live_rainfall[
            "rainfall_mm_hr"
        ]
    )

    result = predict_flood(
        RainfallRequest(
            rainfall_mm_hr=
                rainfall
        )
    )

    risk_level = result[
        "risk_level"
    ]

    risk_score = result[
        "risk_score"
    ]

    alerts = []

    # CRITICAL

    if risk_level == "CRITICAL":

        alerts.append({

            "type":
                "CRITICAL",

            "title":
                "Critical Flood Risk",

            "message":
                (
                    f"Flood risk is critical in "
                    f"{PILOT_LOCATION}. "
                    "Immediate action recommended."
                ),

            "risk_score":
                risk_score,

        })

    # HIGH

    elif risk_level == "HIGH":

        alerts.append({

            "type":
                "HIGH",

            "title":
                "High Flood Risk",

            "message":
                (
                    f"High flood risk detected in "
                    f"{PILOT_LOCATION}. "
                    "Monitor vulnerable roads and drainage."
                ),

            "risk_score":
                risk_score,

        })

    # MODERATE

    elif risk_level == "MODERATE":

        alerts.append({

            "type":
                "MODERATE",

            "title":
                "Moderate Flood Risk",

            "message":
                (
                    f"Moderate flood risk detected in "
                    f"{PILOT_LOCATION}."
                ),

            "risk_score":
                risk_score,

        })

    # LOW

    else:

        alerts.append({

            "type":
                "LOW",

            "title":
                "Low Flood Risk",

            "message":
                (
                    f"Flood risk is currently low in "
                    f"{PILOT_LOCATION}."
                ),

            "risk_score":
                risk_score,

        })

    return {

        "success":
            True,

        "location":
            PILOT_LOCATION,

        "alerts":
            alerts,

        "current_risk_score":
            risk_score,

        "current_risk_level":
            risk_level,

        "rainfall_mm_hr":
            rainfall,

        "rainfall_source":
            live_rainfall[
                "rainfall_source"
            ],

        "rainfall_status":
            live_rainfall[
                "rainfall_status"
            ],

        "rainfall_timestamp":
            live_rainfall[
                "rainfall_timestamp"
            ],

        "rainfall_is_real":
            live_rainfall[
                "rainfall_is_real"
            ],

    }


# ============================================================
# RUN SERVER DIRECTLY
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )