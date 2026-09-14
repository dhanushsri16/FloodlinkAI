import pandas as pd
from pathlib import Path

# ============================================================
# FloodLink AI - Prepare Final ML Dataset
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"

FLOOD_FILE = PROCESSED_DIR / "flood_clean_drainage.csv"
BACKGROUND_FILE = PROCESSED_DIR / "background_clean_drainage.csv"
ELEVATION_FILE = PROCESSED_DIR / "floodlink_elevation_data.csv"

OUTPUT_FILE = PROCESSED_DIR / "floodlink_ml_dataset.csv"

print("=" * 70)
print(" FloodLink AI - Final ML Dataset Preparation")
print("=" * 70)

# ------------------------------------------------------------
# 1. Load datasets
# ------------------------------------------------------------

print("\nLoading datasets...")

flood = pd.read_csv(FLOOD_FILE)
background = pd.read_csv(BACKGROUND_FILE)
elevation = pd.read_csv(ELEVATION_FILE)

print(f"Flood drainage rows       : {len(flood)}")
print(f"Background drainage rows  : {len(background)}")
print(f"Elevation rows            : {len(elevation)}")

# ------------------------------------------------------------
# 2. Add target labels
# ------------------------------------------------------------

flood["target"] = 1
background["target"] = 0

# ------------------------------------------------------------
# 3. Combine flood + background
# ------------------------------------------------------------

drainage = pd.concat(
    [flood, background],
    ignore_index=True
)

print(f"\nCombined drainage rows    : {len(drainage)}")

# ------------------------------------------------------------
# 4. Keep only required drainage + location columns
# ------------------------------------------------------------

required_drainage_columns = [
    "latitude",
    "longitude",
    "nearest_drain_distance_km",
    "drain_width_m",
    "drain_depth_m",
    "drain_length_km",
    "drain_type",
    "water_flow",
    "drain_status",
    "target"
]

missing = [
    col for col in required_drainage_columns
    if col not in drainage.columns
]

if missing:
    raise ValueError(
        f"Missing drainage columns: {missing}"
    )

drainage = drainage[required_drainage_columns].copy()

# ------------------------------------------------------------
# 5. Prepare elevation data
# ------------------------------------------------------------

required_elevation_columns = [
    "latitude",
    "longitude",
    "elevation_m"
]

missing = [
    col for col in required_elevation_columns
    if col not in elevation.columns
]

if missing:
    raise ValueError(
        f"Missing elevation columns: {missing}"
    )

elevation = elevation[required_elevation_columns].copy()

# ------------------------------------------------------------
# 6. Make coordinate types consistent
# ------------------------------------------------------------

for df in [drainage, elevation]:

    df["latitude"] = pd.to_numeric(
        df["latitude"],
        errors="coerce"
    )

    df["longitude"] = pd.to_numeric(
        df["longitude"],
        errors="coerce"
    )

elevation["elevation_m"] = pd.to_numeric(
    elevation["elevation_m"],
    errors="coerce"
)

# ------------------------------------------------------------
# 7. Round coordinates before merging
# ------------------------------------------------------------

drainage["latitude_key"] = drainage["latitude"].round(6)
drainage["longitude_key"] = drainage["longitude"].round(6)

elevation["latitude_key"] = elevation["latitude"].round(6)
elevation["longitude_key"] = elevation["longitude"].round(6)

# Remove duplicate elevation coordinates
elevation = elevation.drop_duplicates(
    subset=["latitude_key", "longitude_key"]
)

# ------------------------------------------------------------
# 8. Merge elevation
# ------------------------------------------------------------

print("\nMerging elevation data...")

merged = drainage.merge(
    elevation[
        [
            "latitude_key",
            "longitude_key",
            "elevation_m"
        ]
    ],
    on=["latitude_key", "longitude_key"],
    how="left"
)

# ------------------------------------------------------------
# 9. Remove temporary merge columns
# ------------------------------------------------------------

merged.drop(
    columns=[
        "latitude_key",
        "longitude_key"
    ],
    inplace=True
)

# ------------------------------------------------------------
# 10. Validate merge
# ------------------------------------------------------------

missing_elevation = merged["elevation_m"].isna().sum()

print(f"Missing elevation values : {missing_elevation}")

if missing_elevation > 0:
    print("\nRows without elevation:")
    print(
        merged[
            merged["elevation_m"].isna()
        ][
            ["latitude", "longitude"]
        ].head(10)
    )

    raise ValueError(
        "Some drainage points could not be matched "
        "with elevation data."
    )

# ------------------------------------------------------------
# 11. Remove rows with invalid coordinates
# ------------------------------------------------------------

merged = merged.dropna(
    subset=["latitude", "longitude"]
).reset_index(drop=True)

# ------------------------------------------------------------
# 12. Save final dataset
# ------------------------------------------------------------

merged.to_csv(
    OUTPUT_FILE,
    index=False
)

# ------------------------------------------------------------
# 13. Summary
# ------------------------------------------------------------

print("\n" + "=" * 70)
print(" ML DATASET CREATED SUCCESSFULLY")
print("=" * 70)

print(f"\nOutput file:")
print(OUTPUT_FILE)

print(f"\nDataset shape:")
print(merged.shape)

print("\nColumns:")
for col in merged.columns:
    print(f"  - {col}")

print("\nTarget distribution:")
print(
    merged["target"]
    .value_counts()
    .sort_index()
)

print("\nElevation statistics:")
print(
    merged["elevation_m"].describe()
)

print("\nFirst 5 rows:")
print(
    merged.head().to_string(index=False)
)

print("\nDone.")