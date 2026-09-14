import os
import re
import math
import requests
import pandas as pd
from pyproj import Transformer
from shapely.geometry import Point, LineString


# ============================================================
# FloodLink AI
# CLEAN GCC STORM WATER DRAINAGE DATA PIPELINE
# ============================================================
#
# INPUT:
#   data/raw/floodlink_final_real_dataset.csv
#   data/raw/floodlink_background_enriched.csv
#
# SOURCE:
#   Official GCC Storm Water Drain Layer - Layer 8
#
# OUTPUT:
#   data/processed/flood_clean_drainage.csv
#   data/processed/background_clean_drainage.csv
#
# IMPORTANT:
#   - Uses TRUE point-to-line distance
#   - Converts EPSG:4326 -> EPSG:32644
#   - Uses drain_size for physical width/depth
#   - Rejects 0 x 0 width/depth as invalid
#   - Uses drain_len for drainage length
#   - Does NOT use old drainage_capacity_score
#
# ============================================================


# ============================================================
# 1. PROJECT PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

RAW_DIR = os.path.join(
    BASE_DIR,
    "data",
    "raw"
)

PROCESSED_DIR = os.path.join(
    BASE_DIR,
    "data",
    "processed"
)

os.makedirs(
    PROCESSED_DIR,
    exist_ok=True
)


FLOOD_FILE = os.path.join(
    RAW_DIR,
    "floodlink_final_real_dataset.csv"
)

BACKGROUND_FILE = os.path.join(
    RAW_DIR,
    "floodlink_background_enriched.csv"
)

FLOOD_OUTPUT = os.path.join(
    PROCESSED_DIR,
    "flood_clean_drainage.csv"
)

BACKGROUND_OUTPUT = os.path.join(
    PROCESSED_DIR,
    "background_clean_drainage.csv"
)


# ============================================================
# 2. OFFICIAL GCC API
# ============================================================

GCC_URL = (
    "https://gisgcc.chennaicorporation.gov.in/server/rest/services/"
    "GCCDepts/GCC_COLLABORATION_LAYER/MapServer/8/query"
)


# ============================================================
# 3. COORDINATE SYSTEM
# ============================================================
#
# Flood/background coordinates:
#   EPSG:4326
#   Latitude / Longitude
#
# GCC drainage geometry:
#   EPSG:32644
#   WGS 84 / UTM Zone 44N
#
# ============================================================

WGS84_TO_UTM = Transformer.from_crs(
    "EPSG:4326",
    "EPSG:32644",
    always_xy=True
)


# ============================================================
# 4. API SETTINGS
# ============================================================

BATCH_SIZE = 2000


# ============================================================
# 5. HELPER FUNCTIONS
# ============================================================

def safe_float(value):
    """
    Safely convert a value to float.
    """

    if value is None:
        return None

    try:

        if pd.isna(value):
            return None

    except Exception:
        pass

    try:
        return float(value)

    except (
        ValueError,
        TypeError
    ):
        return None


def clean_text(value):
    """
    Clean text values.
    """

    if value is None:
        return None

    text = str(value).strip()

    if text == "":
        return None

    return text


# ============================================================
# 6. NORMALIZE DRAIN TYPE
# ============================================================

def normalize_drain_type(value):

    value = clean_text(value)

    if value is None:
        return "UNKNOWN"

    text = value.lower()

    if "side" in text:
        return "SIDE_DRAIN"

    if "open" in text:
        return "OPEN_DRAIN"

    if "swd" in text:
        return "SWD"

    return value.upper().replace(
        " ",
        "_"
    )


# ============================================================
# 7. NORMALIZE STATUS
# ============================================================

def normalize_status(value):

    value = clean_text(value)

    if value is None:
        return "UNKNOWN"

    text = value.lower()

    if text == "good":
        return "GOOD"

    if text == "bad":
        return "BAD"

    return value.upper().replace(
        " ",
        "_"
    )


# ============================================================
# 8. NORMALIZE WATER FLOW
# ============================================================

def normalize_water_flow(value):

    value = clean_text(value)

    if value is None:
        return "UNKNOWN"

    text = value.lower()

    if text == "yes":
        return "YES"

    if text == "no":
        return "NO"

    return value.upper()


# ============================================================
# 9. PARSE drain_size
# ============================================================
#
# Examples:
#
#   1.2 x 1.2
#   1.48 x 1.48
#   2 x 3
#   1.5X2
#
# Returns:
#
#   width, depth
#
# ============================================================

def parse_drain_size(value):

    if value is None:
        return None, None

    text = str(value).strip().lower()

    if text == "":
        return None, None

    # Normalize symbols
    text = text.replace(
        "×",
        "x"
    )

    text = text.replace(
        "*",
        "x"
    )

    match = re.search(
        r"([-+]?\d*\.?\d+)\s*x\s*([-+]?\d*\.?\d+)",
        text
    )

    if match is None:
        return None, None

    width = safe_float(
        match.group(1)
    )

    depth = safe_float(
        match.group(2)
    )

    return width, depth


# ============================================================
# 10. BUILD SHAPELY LINES
# ============================================================

def build_lines_from_paths(paths):

    lines = []

    if not paths:
        return lines

    for path in paths:

        if not path:
            continue

        if len(path) < 2:
            continue

        try:

            line = LineString(
                path
            )

            if not line.is_empty:

                lines.append(
                    line
                )

        except Exception:
            continue

    return lines


# ============================================================
# 11. DOWNLOAD ALL GCC DRAINAGE DATA
# ============================================================

def fetch_gcc_drainage():

    print()
    print("=" * 70)
    print("Downloading official GCC Storm Water Drain data")
    print("=" * 70)

    all_features = []

    offset = 0

    while True:

        print()
        print(
            f"Fetching records "
            f"{offset + 1} - "
            f"{offset + BATCH_SIZE} ..."
        )

        params = {

            "where": "1=1",

            "outFields": "*",

            "returnGeometry": "true",

            "outSR": "32644",

            "f": "json",

            "resultOffset": offset,

            "resultRecordCount": BATCH_SIZE
        }

        try:

            response = requests.get(
                GCC_URL,
                params=params,
                timeout=120
            )

            response.raise_for_status()

            data = response.json()

        except Exception as exc:

            raise RuntimeError(
                "Failed to download GCC data: "
                + str(exc)
            )

        if "error" in data:

            raise RuntimeError(
                "GCC API error: "
                + str(data["error"])
            )

        features = data.get(
            "features",
            []
        )

        if not features:
            break

        all_features.extend(
            features
        )

        print(
            "Received",
            len(features),
            "features"
        )

        if len(features) < BATCH_SIZE:
            break

        offset += BATCH_SIZE

    print()
    print(
        "Total GCC drainage features:",
        len(all_features)
    )

    return all_features


# ============================================================
# 12. PREPARE GCC FEATURES
# ============================================================

def prepare_gcc_features(features):

    print()
    print(
        "Preparing GCC drainage geometries..."
    )

    prepared = []

    for feature in features:

        attributes = feature.get(
            "attributes",
            {}
        )

        geometry = feature.get(
            "geometry",
            {}
        )

        paths = geometry.get(
            "paths",
            []
        )

        lines = build_lines_from_paths(
            paths
        )

        if not lines:
            continue

        geometry_length_m = sum(
            line.length
            for line in lines
        )

        prepared.append(
            {
                "objectid":
                    attributes.get(
                        "objectid"
                    ),

                "attributes":
                    attributes,

                "lines":
                    lines,

                "geometry_length_m":
                    geometry_length_m
            }
        )

    print(
        "Usable GCC line features:",
        len(prepared)
    )

    return prepared


# ============================================================
# 13. FIND TRUE NEAREST DRAIN
# ============================================================

def find_nearest_drain(
    latitude,
    longitude,
    gcc_features
):

    lat = safe_float(
        latitude
    )

    lon = safe_float(
        longitude
    )

    if lat is None or lon is None:
        return None

    # --------------------------------------------------------
    # Convert WGS84 lat/lon -> UTM meters
    # --------------------------------------------------------

    x, y = WGS84_TO_UTM.transform(
        lon,
        lat
    )

    point = Point(
        x,
        y
    )

    nearest_feature = None

    nearest_distance = float(
        "inf"
    )

    # --------------------------------------------------------
    # TRUE point-to-line distance
    # --------------------------------------------------------

    for feature in gcc_features:

        for line in feature["lines"]:

            try:

                distance = point.distance(
                    line
                )

            except Exception:

                continue

            if distance < nearest_distance:

                nearest_distance = distance

                nearest_feature = feature

    if nearest_feature is None:
        return None

    return {

        "objectid":
            nearest_feature["objectid"],

        "distance_m":
            nearest_distance,

        "distance_km":
            nearest_distance / 1000.0,

        "attributes":
            nearest_feature["attributes"],

        "geometry_length_m":
            nearest_feature[
                "geometry_length_m"
            ]
    }


# ============================================================
# 14. CLEAN ONE LOCATION
# ============================================================

def clean_location(
    row,
    gcc_features,
    dataset_type
):

    latitude = safe_float(
        row.get("latitude")
    )

    longitude = safe_float(
        row.get("longitude")
    )

    if latitude is None:
        return None

    if longitude is None:
        return None

    nearest = find_nearest_drain(
        latitude,
        longitude,
        gcc_features
    )

    if nearest is None:

        print(
            "WARNING: No drain found for",
            latitude,
            longitude
        )

        return None

    attrs = nearest[
        "attributes"
    ]

    # ========================================================
    # RAW GCC ATTRIBUTES
    # ========================================================

    raw_width = safe_float(
        attrs.get("drain_wid")
    )

    raw_depth = safe_float(
        attrs.get("drain_dep")
    )

    raw_length = safe_float(
        attrs.get("drain_len")
    )

    drain_size = clean_text(
        attrs.get("drain_size")
    )

    # ========================================================
    # PARSE drain_size
    # ========================================================

    parsed_width, parsed_depth = parse_drain_size(
        drain_size
    )

    # ========================================================
    # CLEAN WIDTH
    # ========================================================
    #
    # Priority:
    #
    # 1. Valid drain_size width
    # 2. Valid raw drain_wid <= 20m
    # 3. Missing
    #
    # 0 is NOT considered a valid physical width.
    #
    # ========================================================

    if parsed_width is not None:

        if parsed_width > 0:

            clean_width = parsed_width

            width_source = (
                "drain_size"
            )

        else:

            clean_width = None

            width_source = (
                "ZERO_OR_INVALID_DRAIN_SIZE"
            )

    elif raw_width is not None:

        if 0 < raw_width <= 20:

            clean_width = raw_width

            width_source = (
                "drain_wid"
            )

        else:

            clean_width = None

            width_source = (
                "INVALID_RAW_WIDTH"
            )

    else:

        clean_width = None

        width_source = "MISSING"

    # ========================================================
    # CLEAN DEPTH
    # ========================================================
    #
    # 0 is NOT considered a valid physical depth.
    #
    # ========================================================

    if parsed_depth is not None:

        if parsed_depth > 0:

            clean_depth = parsed_depth

            depth_source = (
                "drain_size"
            )

        else:

            clean_depth = None

            depth_source = (
                "ZERO_OR_INVALID_DRAIN_SIZE"
            )

    elif raw_depth is not None:

        if 0 < raw_depth <= 20:

            clean_depth = raw_depth

            depth_source = (
                "drain_dep"
            )

        else:

            clean_depth = None

            depth_source = (
                "INVALID_RAW_DEPTH"
            )

    else:

        clean_depth = None

        depth_source = "MISSING"

    # ========================================================
    # CLEAN LENGTH
    # ========================================================
    #
    # Prefer GCC drain_len.
    #
    # If unavailable, use geometry length.
    #
    # ========================================================

    if raw_length is not None and raw_length > 0:

        clean_length_m = raw_length

        length_source = (
            "drain_len"
        )

    else:

        clean_length_m = nearest[
            "geometry_length_m"
        ]

        length_source = (
            "geometry"
        )

    if (
        clean_length_m is not None
        and clean_length_m > 0
    ):

        clean_length_km = (
            clean_length_m / 1000.0
        )

    else:

        clean_length_km = None

    # ========================================================
    # CATEGORICAL DATA
    # ========================================================

    drain_type = normalize_drain_type(
        attrs.get("drain_type")
    )

    water_flow = normalize_water_flow(
        attrs.get("water_flow")
    )

    drain_status = normalize_status(
        attrs.get("status")
    )

    # ========================================================
    # OTHER GCC ATTRIBUTES
    # ========================================================

    zone = clean_text(
        attrs.get("zone")
    )

    ward = clean_text(
        attrs.get("ward")
    )

    location = clean_text(
        attrs.get("location")
    )

    cover = clean_text(
        attrs.get("cover")
    )

    material = clean_text(
        attrs.get("typ_mat")
    )

    # ========================================================
    # FINAL CLEAN RECORD
    # ========================================================

    result = {

        # -----------------------------------------------
        # Location
        # -----------------------------------------------

        "latitude":
            latitude,

        "longitude":
            longitude,

        "dataset_type":
            dataset_type,

        # -----------------------------------------------
        # GCC identity
        # -----------------------------------------------

        "gcc_objectid":
            attrs.get("objectid"),

        "gcc_zone":
            zone,

        "gcc_ward":
            ward,

        "gcc_location":
            location,

        # -----------------------------------------------
        # CLEAN DRAINAGE FEATURES
        # -----------------------------------------------

        "nearest_drain_distance_km":
            round(
                nearest["distance_km"],
                6
            ),

        "drain_width_m":
            clean_width,

        "drain_depth_m":
            clean_depth,

        "drain_length_km":
            round(
                clean_length_km,
                6
            )
            if clean_length_km is not None
            else None,

        "drain_type":
            drain_type,

        "water_flow":
            water_flow,

        "drain_status":
            drain_status,

        # -----------------------------------------------
        # RAW / AUDIT FIELDS
        # -----------------------------------------------

        "drain_size_raw":
            drain_size,

        "drain_width_raw":
            raw_width,

        "drain_depth_raw":
            raw_depth,

        "drain_length_raw_m":
            raw_length,

        "drain_width_source":
            width_source,

        "drain_depth_source":
            depth_source,

        "drain_length_source":
            length_source,

        "geometry_length_m":
            round(
                nearest[
                    "geometry_length_m"
                ],
                3
            ),

        "distance_to_drain_m":
            round(
                nearest[
                    "distance_m"
                ],
                3
            )
    }

    return result


# ============================================================
# 15. PROCESS COMPLETE DATASET
# ============================================================

def process_dataset(
    input_file,
    output_file,
    gcc_features,
    dataset_type
):

    print()
    print("=" * 70)
    print(
        f"Processing {dataset_type.upper()} dataset"
    )
    print("=" * 70)

    df = pd.read_csv(
        input_file
    )

    print(
        "Input rows:",
        len(df)
    )

    required_columns = [
        "latitude",
        "longitude"
    ]

    for column in required_columns:

        if column not in df.columns:

            raise ValueError(
                f"Required column missing: {column}"
            )

    results = []

    total = len(df)

    for index, row in df.iterrows():

        result = clean_location(
            row,
            gcc_features,
            dataset_type
        )

        if result is not None:

            results.append(
                result
            )

        if (
            (index + 1) % 25 == 0
            or index == total - 1
        ):

            print(
                f"Processed "
                f"{index + 1}/{total}"
            )

    result_df = pd.DataFrame(
        results
    )

    result_df.to_csv(
        output_file,
        index=False
    )

    print()
    print(
        "Saved:"
    )

    print(
        output_file
    )

    print(
        "Output rows:",
        len(result_df)
    )

    return result_df


# ============================================================
# 16. QUALITY REPORT
# ============================================================

def print_quality_report(
    df,
    dataset_name
):

    print()
    print("=" * 70)
    print(
        f"QUALITY REPORT - "
        f"{dataset_name.upper()}"
    )
    print("=" * 70)

    print()
    print(
        "Rows:",
        len(df)
    )

    if len(df) == 0:
        return

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    print()
    print(
        "Missing values:"
    )

    print(
        df[
            [
                "drain_width_m",
                "drain_depth_m",
                "drain_length_km",
                "nearest_drain_distance_km",
                "drain_type",
                "water_flow",
                "drain_status"
            ]
        ].isna().sum()
    )

    # --------------------------------------------------------
    # Drain type
    # --------------------------------------------------------

    print()
    print(
        "Drain types:"
    )

    print(
        df[
            "drain_type"
        ].value_counts(
            dropna=False
        )
    )

    # --------------------------------------------------------
    # Water flow
    # --------------------------------------------------------

    print()
    print(
        "Water flow:"
    )

    print(
        df[
            "water_flow"
        ].value_counts(
            dropna=False
        )
    )

    # --------------------------------------------------------
    # Status
    # --------------------------------------------------------

    print()
    print(
        "Drain status:"
    )

    print(
        df[
            "drain_status"
        ].value_counts(
            dropna=False
        )
    )

    # --------------------------------------------------------
    # Width
    # --------------------------------------------------------

    print()
    print(
        "Width statistics:"
    )

    print(
        df[
            "drain_width_m"
        ].describe()
    )

    # --------------------------------------------------------
    # Depth
    # --------------------------------------------------------

    print()
    print(
        "Depth statistics:"
    )

    print(
        df[
            "drain_depth_m"
        ].describe()
    )

    # --------------------------------------------------------
    # Length
    # --------------------------------------------------------

    print()
    print(
        "Length statistics (km):"
    )

    print(
        df[
            "drain_length_km"
        ].describe()
    )

    # --------------------------------------------------------
    # Distance
    # --------------------------------------------------------

    print()
    print(
        "Nearest drain distance (km):"
    )

    print(
        df[
            "nearest_drain_distance_km"
        ].describe()
    )

    # --------------------------------------------------------
    # Suspicious width
    # --------------------------------------------------------

    suspicious_widths = df[
        df["drain_width_m"] > 20
    ]

    print()
    print(
        "Clean width > 20m:",
        len(suspicious_widths)
    )

    # --------------------------------------------------------
    # Suspicious zero width/depth
    # --------------------------------------------------------

    zero_dimension_rows = df[
        (
            df["drain_width_m"].fillna(0) <= 0
        )
        |
        (
            df["drain_depth_m"].fillna(0) <= 0
        )
    ]

    print(
        "Zero/invalid physical dimensions:",
        len(zero_dimension_rows)
    )

    if len(zero_dimension_rows) > 0:

        print()

        print(
            zero_dimension_rows[
                [
                    "latitude",
                    "longitude",
                    "gcc_objectid",
                    "drain_width_m",
                    "drain_depth_m",
                    "drain_size_raw",
                    "drain_width_raw",
                    "drain_depth_raw",
                    "drain_length_km",
                    "nearest_drain_distance_km",
                    "drain_type",
                    "drain_status",
                    "drain_width_source",
                    "drain_depth_source"
                ]
            ].to_string(
                index=False
            )
        )


# ============================================================
# 17. MAIN
# ============================================================

def main():

    print()
    print("=" * 70)
    print(
        " FloodLink AI - Clean GCC Drainage Pipeline"
    )
    print("=" * 70)

    print()
    print(
        "Project directory:"
    )

    print(
        BASE_DIR
    )

    # ========================================================
    # CHECK INPUT FILES
    # ========================================================

    if not os.path.exists(
        FLOOD_FILE
    ):

        raise FileNotFoundError(
            "Flood dataset not found:\n"
            + FLOOD_FILE
        )

    if not os.path.exists(
        BACKGROUND_FILE
    ):

        raise FileNotFoundError(
            "Background dataset not found:\n"
            + BACKGROUND_FILE
        )

    # ========================================================
    # DOWNLOAD GCC DATA
    # ========================================================

    gcc_raw = fetch_gcc_drainage()

    if not gcc_raw:

        raise RuntimeError(
            "No GCC drainage data received."
        )

    # ========================================================
    # PREPARE GEOMETRY
    # ========================================================

    gcc_features = prepare_gcc_features(
        gcc_raw
    )

    if not gcc_features:

        raise RuntimeError(
            "No usable GCC drainage geometries."
        )

    # ========================================================
    # FLOOD DATASET
    # ========================================================

    flood_df = process_dataset(
        input_file=FLOOD_FILE,

        output_file=FLOOD_OUTPUT,

        gcc_features=gcc_features,

        dataset_type="FLOOD"
    )

    # ========================================================
    # BACKGROUND DATASET
    # ========================================================

    background_df = process_dataset(
        input_file=BACKGROUND_FILE,

        output_file=BACKGROUND_OUTPUT,

        gcc_features=gcc_features,

        dataset_type="BACKGROUND"
    )

    # ========================================================
    # QUALITY REPORTS
    # ========================================================

    print_quality_report(
        flood_df,
        "Flood"
    )

    print_quality_report(
        background_df,
        "Background"
    )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print()
    print("=" * 70)
    print(
        " CLEAN DRAINAGE PIPELINE COMPLETED"
    )
    print("=" * 70)

    print()
    print(
        "Flood output:"
    )

    print(
        FLOOD_OUTPUT
    )

    print()
    print(
        "Background output:"
    )

    print(
        BACKGROUND_OUTPUT
    )

    print()
    print(
        "Important:"
    )

    print(
        "1. Old drainage_capacity_score was NOT used."
    )

    print(
        "2. True point-to-line distance was used."
    )

    print(
        "3. drain_size is preferred for width/depth."
    )

    print(
        "4. 0 x 0 dimensions are treated as missing."
    )

    print(
        "5. drain_len / geometry is used for length."
    )

    print(
        "6. Raw GCC fields are retained for auditing."
    )

    print()
    print(
        "Next step:"
    )

    print(
        "Build the clean ML dataset."
    )


# ============================================================
# 18. RUN
# ============================================================

if __name__ == "__main__":
    main()