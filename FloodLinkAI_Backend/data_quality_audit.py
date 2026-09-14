import pandas as pd
import numpy as np
from pathlib import Path


# ============================================================
# FloodLink AI - Data Quality Audit
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "data" / "raw"

FLOOD_FILE = RAW_DIR / "floodlink_final_real_dataset.csv"
BACKGROUND_FILE = RAW_DIR / "floodlink_background_enriched.csv"


def section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def audit_dataset(df, name):
    section(f"{name} - BASIC INFORMATION")

    print(f"Rows       : {len(df)}")
    print(f"Columns    : {len(df.columns)}")
    print(f"Duplicates : {df.duplicated().sum()}")

    print("\nColumns:")
    for col in df.columns:
        print(f"  - {col}")

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    section(f"{name} - MISSING VALUES")

    missing = df.isnull().sum()
    missing = missing[missing > 0]

    if len(missing) == 0:
        print("No missing values.")
    else:
        print(missing.to_string())

    # --------------------------------------------------------
    # Coordinate checks
    # --------------------------------------------------------

    section(f"{name} - COORDINATE CHECK")

    if "latitude" in df.columns and "longitude" in df.columns:

        print(f"Latitude range  : {df['latitude'].min()} -> {df['latitude'].max()}")
        print(f"Longitude range : {df['longitude'].min()} -> {df['longitude'].max()}")

        duplicate_coords = df.duplicated(
            subset=["latitude", "longitude"]
        ).sum()

        print(f"Duplicate coordinate pairs: {duplicate_coords}")

        invalid_lat = (
            (df["latitude"] < -90) |
            (df["latitude"] > 90)
        ).sum()

        invalid_lon = (
            (df["longitude"] < -180) |
            (df["longitude"] > 180)
        ).sum()

        print(f"Invalid latitude : {invalid_lat}")
        print(f"Invalid longitude: {invalid_lon}")

    # --------------------------------------------------------
    # Label check
    # --------------------------------------------------------

    if "flood_occurred" in df.columns:

        section(f"{name} - FLOOD LABEL")

        print(df["flood_occurred"].value_counts(dropna=False))

        print("\nPercentage:")
        print(
            (df["flood_occurred"]
             .value_counts(normalize=True, dropna=False) * 100)
            .round(2)
            .to_string()
        )

    # --------------------------------------------------------
    # Risk level
    # --------------------------------------------------------

    if "flood_risk_level" in df.columns:

        section(f"{name} - RISK LEVEL")

        print(df["flood_risk_level"].value_counts(dropna=False))

    # --------------------------------------------------------
    # Numerical statistics
    # --------------------------------------------------------

    numeric_columns = [
        "inundation_depth_inches",
        "rainfall_mean_mm",
        "rainfall_max_mm",
        "rainfall_median_mm",
        "flood_probability",
        "elevation_m",
        "nearest_drain_distance_km",
        "drain_width_m",
        "drain_depth_m",
        "drain_length_km",
        "drainage_capacity_score",
        "distance_from_nearest_flood_km",
    ]

    available = [
        col for col in numeric_columns
        if col in df.columns
    ]

    if available:

        section(f"{name} - NUMERICAL STATISTICS")

        print(
            df[available]
            .describe()
            .round(3)
            .to_string()
        )

    # --------------------------------------------------------
    # Suspicious drainage values
    # --------------------------------------------------------

    section(f"{name} - DRAINAGE QUALITY")

    if "drain_width_m" in df.columns:

        print("\nDrain width:")
        print(
            f"Min    : {df['drain_width_m'].min():.3f} m"
        )
        print(
            f"Max    : {df['drain_width_m'].max():.3f} m"
        )
        print(
            f"> 10 m : {(df['drain_width_m'] > 10).sum()}"
        )
        print(
            f"> 20 m : {(df['drain_width_m'] > 20).sum()}"
        )

    if "drain_depth_m" in df.columns:

        print("\nDrain depth:")
        print(
            f"Min    : {df['drain_depth_m'].min():.3f} m"
        )
        print(
            f"Max    : {df['drain_depth_m'].max():.3f} m"
        )
        print(
            f"> 5 m  : {(df['drain_depth_m'] > 5).sum()}"
        )

    if (
        "drain_width_m" in df.columns
        and "drain_depth_m" in df.columns
    ):

        valid_depth = df["drain_depth_m"] > 0

        ratio = (
            df.loc[valid_depth, "drain_width_m"] /
            df.loc[valid_depth, "drain_depth_m"]
        )

        print("\nWidth / depth ratio:")
        print(f"Median : {ratio.median():.3f}")
        print(f"Max    : {ratio.max():.3f}")
        print(f"> 20   : {(ratio > 20).sum()}")
        print(f"> 100  : {(ratio > 100).sum()}")

    # --------------------------------------------------------
    # Elevation
    # --------------------------------------------------------

    if "elevation_m" in df.columns:

        section(f"{name} - ELEVATION CHECK")

        print(
            f"Min : {df['elevation_m'].min():.3f} m"
        )

        print(
            f"Max : {df['elevation_m'].max():.3f} m"
        )

        print(
            f"> 50m  : {(df['elevation_m'] > 50).sum()}"
        )

        print(
            f"> 100m : {(df['elevation_m'] > 100).sum()}"
        )

        suspicious = df[df["elevation_m"] > 50]

        if len(suspicious) > 0:

            print("\nPotential elevation outliers:")

            cols = [
                c for c in [
                    "location_id",
                    "latitude",
                    "longitude",
                    "elevation_m"
                ]
                if c in suspicious.columns
            ]

            print(
                suspicious[cols]
                .to_string(index=False)
            )

    # --------------------------------------------------------
    # Categorical values
    # --------------------------------------------------------

    categorical_columns = [
        "drain_type",
        "water_flow",
        "drain_status",
        "location_type"
    ]

    for col in categorical_columns:

        if col in df.columns:

            section(f"{name} - {col.upper()}")

            print(
                df[col]
                .value_counts(dropna=False)
                .to_string()
            )


def leakage_check(flood_df, background_df):

    section("LEAKAGE CHECK")

    possible_leakage = [
        "inundation_depth_inches",
        "flood_probability",
        "flood_risk_level",
        "distance_from_nearest_flood_km",
        "rainfall_mean_mm",
        "rainfall_max_mm",
        "rainfall_median_mm",
    ]

    print("Potential leakage / non-predictive columns:\n")

    for col in possible_leakage:

        exists_flood = col in flood_df.columns
        exists_bg = col in background_df.columns

        if exists_flood or exists_bg:

            print(
                f"[CHECK] {col} "
                f"(flood={exists_flood}, background={exists_bg})"
            )


def class_comparison(flood_df, background_df):

    section("FLOOD VS BACKGROUND COMPARISON")

    print(
        f"Flood observations     : {len(flood_df)}"
    )

    print(
        f"Background observations: {len(background_df)}"
    )

    print(
        f"Total                   : "
        f"{len(flood_df) + len(background_df)}"
    )

    if "drainage_capacity_score" in flood_df.columns:

        print("\nDrainage capacity:")
        print(
            "Flood:"
        )
        print(
            flood_df["drainage_capacity_score"]
            .describe()
            .round(3)
            .to_string()
        )

        print("\nBackground:")
        print(
            background_df["drainage_capacity_score"]
            .describe()
            .round(3)
            .to_string()
        )

    if "nearest_drain_distance_km" in flood_df.columns:

        print("\nNearest drain distance:")

        print(
            "Flood median     : "
            f"{flood_df['nearest_drain_distance_km'].median():.3f} km"
        )

        print(
            "Background median: "
            f"{background_df['nearest_drain_distance_km'].median():.3f} km"
        )


def main():

    print("\n")
    print("=" * 70)
    print(" FLOODLINK AI - DATA QUALITY AUDIT")
    print("=" * 70)

    # --------------------------------------------------------
    # Load data
    # --------------------------------------------------------

    print("\nLoading datasets...")

    flood_df = pd.read_csv(FLOOD_FILE)
    background_df = pd.read_csv(BACKGROUND_FILE)

    print("Flood dataset loaded.")
    print("Background dataset loaded.")

    # --------------------------------------------------------
    # Individual audits
    # --------------------------------------------------------

    audit_dataset(
        flood_df,
        "FLOOD OBSERVATIONS"
    )

    audit_dataset(
        background_df,
        "BACKGROUND OBSERVATIONS"
    )

    # --------------------------------------------------------
    # Leakage
    # --------------------------------------------------------

    leakage_check(
        flood_df,
        background_df
    )

    # --------------------------------------------------------
    # Class comparison
    # --------------------------------------------------------

    class_comparison(
        flood_df,
        background_df
    )

    # --------------------------------------------------------
    # Final message
    # --------------------------------------------------------

    section("AUDIT COMPLETED")

    print(
        "Raw datasets were NOT modified."
    )

    print(
        "Use this report before creating the ML dataset."
    )


if __name__ == "__main__":
    main()