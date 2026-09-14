import pandas as pd
import requests
import time
from pathlib import Path

# ============================================================
# FloodLink AI - Generate Real Elevation Data
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"

FLOOD_FILE = PROCESSED_DIR / "flood_clean_drainage.csv"
BACKGROUND_FILE = PROCESSED_DIR / "background_clean_drainage.csv"
OUTPUT_FILE = PROCESSED_DIR / "floodlink_elevation_data.csv"

print("=" * 60)
print(" FloodLink AI - Elevation Data Generation")
print("=" * 60)

# ------------------------------------------------------------
# 1. Load existing cleaned drainage datasets
# ------------------------------------------------------------

print("\nLoading existing datasets...")

flood_df = pd.read_csv(FLOOD_FILE)
background_df = pd.read_csv(BACKGROUND_FILE)

print(f"Flood rows       : {len(flood_df)}")
print(f"Background rows  : {len(background_df)}")

# ------------------------------------------------------------
# 2. Combine coordinates
# ------------------------------------------------------------

coords = pd.concat(
    [
        flood_df[["latitude", "longitude"]],
        background_df[["latitude", "longitude"]]
    ],
    ignore_index=True
)

# Remove invalid coordinates
coords["latitude"] = pd.to_numeric(coords["latitude"], errors="coerce")
coords["longitude"] = pd.to_numeric(coords["longitude"], errors="coerce")

coords = coords.dropna(subset=["latitude", "longitude"])

# Remove duplicate coordinate pairs
coords = coords.drop_duplicates(
    subset=["latitude", "longitude"]
).reset_index(drop=True)

print(f"\nUnique coordinates : {len(coords)}")

# ------------------------------------------------------------
# 3. Query Open-Meteo Elevation API
# ------------------------------------------------------------

API_URL = "https://api.open-meteo.com/v1/elevation"

results = []

# API batches
BATCH_SIZE = 100

print("\nFetching real elevation data...")

for start in range(0, len(coords), BATCH_SIZE):

    batch = coords.iloc[start:start + BATCH_SIZE]

    latitudes = ",".join(
        f"{x:.6f}" for x in batch["latitude"]
    )

    longitudes = ",".join(
        f"{x:.6f}" for x in batch["longitude"]
    )

    params = {
        "latitude": latitudes,
        "longitude": longitudes
    }

    batch_number = start // BATCH_SIZE + 1
    total_batches = (len(coords) + BATCH_SIZE - 1) // BATCH_SIZE

    print(
        f"  Batch {batch_number}/{total_batches} "
        f"({len(batch)} points)..."
    )

    try:

        response = requests.get(
            API_URL,
            params=params,
            timeout=60
        )

        response.raise_for_status()

        data = response.json()

        elevations = data.get("elevation", [])

        if len(elevations) != len(batch):

            raise ValueError(
                f"Elevation count mismatch: "
                f"received {len(elevations)}, "
                f"expected {len(batch)}"
            )

        batch_result = batch.copy()

        batch_result["elevation_m"] = elevations

        results.append(batch_result)

    except Exception as e:

        print(f"\nERROR in batch {batch_number}: {e}")
        raise

    time.sleep(0.5)

# ------------------------------------------------------------
# 4. Combine results
# ------------------------------------------------------------

elevation_df = pd.concat(
    results,
    ignore_index=True
)

# ------------------------------------------------------------
# 5. Basic validation
# ------------------------------------------------------------

print("\nValidating elevation data...")

elevation_df["elevation_m"] = pd.to_numeric(
    elevation_df["elevation_m"],
    errors="coerce"
)

missing = elevation_df["elevation_m"].isna().sum()

print(f"Missing elevation values : {missing}")

if missing > 0:
    raise ValueError(
        f"{missing} elevation values are missing."
    )

print(
    f"Minimum elevation : "
    f"{elevation_df['elevation_m'].min():.2f} m"
)

print(
    f"Maximum elevation : "
    f"{elevation_df['elevation_m'].max():.2f} m"
)

print(
    f"Mean elevation    : "
    f"{elevation_df['elevation_m'].mean():.2f} m"
)

# ------------------------------------------------------------
# 6. Save
# ------------------------------------------------------------

elevation_df.to_csv(
    OUTPUT_FILE,
    index=False
)

print("\n" + "=" * 60)
print(" Elevation generation completed successfully!")
print("=" * 60)

print(f"\nOutput file:")
print(OUTPUT_FILE)

print("\nShape:")
print(elevation_df.shape)

print("\nColumns:")
print(elevation_df.columns.tolist())

print("\nFirst 5 rows:")
print(elevation_df.head().to_string(index=False))