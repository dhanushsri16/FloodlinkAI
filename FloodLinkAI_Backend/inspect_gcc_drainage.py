"""
FloodLink AI
GCC Storm Water Drain Inspection

Purpose:
- Inspect suspicious drainage records from the flood dataset.
- Query the original GCC Storm_Water_Drain layer (Layer 8).
- GCC geometry is in EPSG:32644 (WGS 84 / UTM Zone 44N).
- Flood observations are stored as EPSG:4326 latitude/longitude.
- Convert flood points: EPSG:4326 -> EPSG:32644.
- Calculate TRUE point-to-line distance using Shapely.
- Compare our stored drainage values with the original GCC values.
- Save the inspection results to CSV.
"""

import os
import math
import requests
import pandas as pd

from shapely.geometry import Point, LineString, MultiLineString
from pyproj import Transformer


# ============================================================
# CONFIGURATION
# ============================================================

FLOOD_CSV = os.path.join(
    "data",
    "raw",
    "floodlink_final_real_dataset.csv"
)

OUTPUT_CSV = os.path.join(
    "data",
    "processed",
    "gcc_suspicious_drain_inspection_corrected.csv"
)

GCC_URL = (
    "https://gisgcc.chennaicorporation.gov.in/"
    "server/rest/services/GCCDepts/"
    "GCC_COLLABORATION_LAYER/MapServer/8/query"
)

# Flood dataset coordinates
SOURCE_CRS = "EPSG:4326"

# GCC Storm Water Drain geometry CRS
GCC_CRS = "EPSG:32644"

# Suspicious width threshold
WIDTH_THRESHOLD = 20.0

# Maximum records requested per API call
PAGE_SIZE = 2000


# ============================================================
# CRS TRANSFORMER
# ============================================================

transformer = Transformer.from_crs(
    SOURCE_CRS,
    GCC_CRS,
    always_xy=True
)


# ============================================================
# HELPER: CONVERT LAT/LON TO UTM
# ============================================================

def latlon_to_utm(latitude, longitude):
    """
    Convert EPSG:4326 latitude/longitude to EPSG:32644.

    Input:
        latitude
        longitude

    Output:
        x, y in UTM meters
    """

    x, y = transformer.transform(
        longitude,
        latitude
    )

    return x, y


# ============================================================
# HELPER: BUILD SHAPELY LINE
# ============================================================

def geometry_to_shapely(geometry):
    """
    Convert ArcGIS geometry JSON into a Shapely LineString
    or MultiLineString.
    """

    if not geometry:
        return None

    paths = geometry.get("paths")

    if not paths:
        return None

    lines = []

    for path in paths:

        if not path or len(path) < 2:
            continue

        try:
            line = LineString(path)

            if not line.is_empty and line.length > 0:
                lines.append(line)

        except Exception:
            continue

    if not lines:
        return None

    if len(lines) == 1:
        return lines[0]

    return MultiLineString(lines)


# ============================================================
# QUERY GCC DRAINAGE DATA
# ============================================================

def query_gcc_drainage():

    print("\n" + "=" * 80)
    print(" QUERYING ORIGINAL GCC STORM WATER DRAIN LAYER")
    print("=" * 80)

    print("\nGCC URL:")
    print(GCC_URL)

    all_features = []

    offset = 0

    while True:

        params = {
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "f": "json",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE
        }

        print(
            f"\nRequesting GCC records "
            f"{offset} - {offset + PAGE_SIZE - 1}..."
        )

        try:

            response = requests.get(
                GCC_URL,
                params=params,
                timeout=60
            )

            response.raise_for_status()

            data = response.json()

        except Exception as e:

            print("\nERROR querying GCC:")
            print(e)

            return []

        if "error" in data:

            print("\nGCC API ERROR:")
            print(data["error"])

            return []

        features = data.get("features", [])

        print(
            f"Received {len(features)} features."
        )

        if not features:
            break

        all_features.extend(features)

        exceeded_limit = data.get(
            "exceededTransferLimit",
            False
        )

        if not exceeded_limit:
            break

        offset += PAGE_SIZE

    print(
        f"\nTotal GCC drainage features loaded: "
        f"{len(all_features)}"
    )

    return all_features


# ============================================================
# EXTRACT GCC ATTRIBUTE
# ============================================================

def get_attr(attributes, *names):

    for name in names:

        if name in attributes:

            value = attributes[name]

            if value is not None:
                return value

    return None


# ============================================================
# FIND TRUE NEAREST LINE
# ============================================================

def find_nearest_drain(
    flood_lat,
    flood_lon,
    gcc_features
):

    # --------------------------------------------------------
    # Convert flood coordinate to UTM
    # --------------------------------------------------------

    x, y = latlon_to_utm(
        flood_lat,
        flood_lon
    )

    flood_point = Point(x, y)

    nearest_feature = None
    nearest_line = None
    nearest_distance = float("inf")

    # --------------------------------------------------------
    # Check every GCC drainage line
    # --------------------------------------------------------

    for feature in gcc_features:

        geometry = feature.get("geometry")

        line = geometry_to_shapely(
            geometry
        )

        if line is None:
            continue

        # TRUE point-to-line distance
        distance_m = flood_point.distance(line)

        if distance_m < nearest_distance:

            nearest_distance = distance_m
            nearest_feature = feature
            nearest_line = line

    if nearest_feature is None:

        return None

    attributes = nearest_feature.get(
        "attributes",
        {}
    )

    geometry = nearest_feature.get(
        "geometry",
        {}
    )

    # --------------------------------------------------------
    # Extract original GCC attributes
    # --------------------------------------------------------

    objectid = get_attr(
        attributes,
        "OBJECTID",
        "objectid"
    )

    drain_width = get_attr(
        attributes,
        "drain_wid"
    )

    drain_depth = get_attr(
        attributes,
        "drain_dep"
    )

    drain_len = get_attr(
        attributes,
        "drain_len"
    )

    dlen_km = get_attr(
        attributes,
        "dlen_km"
    )

    drain_type = get_attr(
        attributes,
        "drain_type"
    )

    water_flow = get_attr(
        attributes,
        "water_flow"
    )

    status = get_attr(
        attributes,
        "status"
    )

    zone = get_attr(
        attributes,
        "zone"
    )

    ward = get_attr(
        attributes,
        "ward"
    )

    # --------------------------------------------------------
    # Geometry information
    # --------------------------------------------------------

    paths = geometry.get(
        "paths",
        []
    )

    vertex_count = sum(
        len(path)
        for path in paths
    )

    path_count = len(paths)

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return {

        "gcc_objectid": objectid,

        "gcc_drain_wid_m": drain_width,

        "gcc_drain_dep_m": drain_depth,

        "gcc_drain_len_m": drain_len,

        "gcc_dlen_km": dlen_km,

        "gcc_drain_type": drain_type,

        "gcc_water_flow": water_flow,

        "gcc_status": status,

        "gcc_zone": zone,

        "gcc_ward": ward,

        "nearest_drain_distance_m":
            nearest_distance,

        "nearest_drain_distance_km":
            nearest_distance / 1000.0,

        "utm_x":
            x,

        "utm_y":
            y,

        "geometry_path_count":
            path_count,

        "geometry_vertex_count":
            vertex_count
    }


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 80)
    print(" FLOODLINK AI - CORRECTED GCC DRAINAGE INSPECTION")
    print("=" * 80)

    # --------------------------------------------------------
    # Load flood dataset
    # --------------------------------------------------------

    print("\nLoading flood dataset...")

    if not os.path.exists(FLOOD_CSV):

        print("\nERROR:")
        print(
            f"Flood dataset not found:\n{FLOOD_CSV}"
        )

        return

    df = pd.read_csv(
        FLOOD_CSV
    )

    print(
        f"Loaded {len(df)} flood observations."
    )

    # --------------------------------------------------------
    # Find suspicious records
    # --------------------------------------------------------

    suspicious = df[
        df["drain_width_m"] > WIDTH_THRESHOLD
    ].copy()

    print("\n" + "=" * 80)
    print(" SUSPICIOUS FLOOD RECORDS")
    print("=" * 80)

    print(
        f"\nFound {len(suspicious)} records "
        f"with drain_width_m > "
        f"{WIDTH_THRESHOLD} m."
    )

    if suspicious.empty:

        print("\nNo suspicious records found.")

        return

    print(
        suspicious[
            [
                "latitude",
                "longitude",
                "drain_width_m",
                "drain_depth_m",
                "drain_length_km"
            ]
        ].to_string(index=False)
    )

    # --------------------------------------------------------
    # Query GCC
    # --------------------------------------------------------

    gcc_features = query_gcc_drainage()

    if not gcc_features:

        print("\nNo GCC drainage features found.")

        return

    # --------------------------------------------------------
    # Process suspicious records
    # --------------------------------------------------------

    results = []

    print("\n" + "=" * 80)
    print(" TRUE UTM POINT-TO-LINE MATCHING")
    print("=" * 80)

    for index, row in suspicious.iterrows():

        flood_lat = float(
            row["latitude"]
        )

        flood_lon = float(
            row["longitude"]
        )

        print("\n" + "-" * 80)

        print(
            f"Flood record index : {index}"
        )

        print(
            f"Location            : "
            f"{flood_lat:.6f}, "
            f"{flood_lon:.6f}"
        )

        print(
            f"Our CSV width       : "
            f"{row['drain_width_m']}"
        )

        print(
            f"Our CSV depth       : "
            f"{row['drain_depth_m']}"
        )

        print(
            f"Our CSV length      : "
            f"{row['drain_length_km']}"
        )

        print("\nConverting EPSG:4326 -> EPSG:32644...")

        x, y = latlon_to_utm(
            flood_lat,
            flood_lon
        )

        print(
            f"UTM X               : {x:.3f}"
        )

        print(
            f"UTM Y               : {y:.3f}"
        )

        print("\nFinding TRUE nearest GCC line...")

        match = find_nearest_drain(
            flood_lat,
            flood_lon,
            gcc_features
        )

        if match is None:

            print(
                "\nNO GCC DRAINAGE MATCH FOUND."
            )

            continue

        # ----------------------------------------------------
        # Print result
        # ----------------------------------------------------

        print("\nGCC MATCH FOUND")

        print(
            f"OBJECTID            : "
            f"{match['gcc_objectid']}"
        )

        print(
            f"GCC drain_wid       : "
            f"{match['gcc_drain_wid_m']}"
        )

        print(
            f"GCC drain_dep       : "
            f"{match['gcc_drain_dep_m']}"
        )

        print(
            f"GCC drain_len       : "
            f"{match['gcc_drain_len_m']}"
        )

        print(
            f"GCC dlen_km         : "
            f"{match['gcc_dlen_km']}"
        )

        print(
            f"GCC drain_type      : "
            f"{match['gcc_drain_type']}"
        )

        print(
            f"GCC water_flow      : "
            f"{match['gcc_water_flow']}"
        )

        print(
            f"GCC status          : "
            f"{match['gcc_status']}"
        )

        print(
            f"GCC zone            : "
            f"{match['gcc_zone']}"
        )

        print(
            f"GCC ward            : "
            f"{match['gcc_ward']}"
        )

        print(
            f"TRUE distance       : "
            f"{match['nearest_drain_distance_m']:.2f} m"
        )

        print(
            f"TRUE distance       : "
            f"{match['nearest_drain_distance_km']:.6f} km"
        )

        print(
            f"Geometry paths      : "
            f"{match['geometry_path_count']}"
        )

        print(
            f"Geometry vertices   : "
            f"{match['geometry_vertex_count']}"
        )

        # ----------------------------------------------------
        # Combine original CSV + GCC values
        # ----------------------------------------------------

        result = {

            "flood_record_index":
                index,

            "latitude":
                flood_lat,

            "longitude":
                flood_lon,

            "our_drain_width_m":
                row["drain_width_m"],

            "our_drain_depth_m":
                row["drain_depth_m"],

            "our_drain_length_km":
                row["drain_length_km"],

            "our_drain_type":
                row.get("drain_type"),

            "our_water_flow":
                row.get("water_flow"),

            "our_drain_status":
                row.get("drain_status"),

            **match
        }

        results.append(result)

    # --------------------------------------------------------
    # Save output
    # --------------------------------------------------------

    print("\n" + "=" * 80)
    print(" SAVING INSPECTION REPORT")
    print("=" * 80)

    os.makedirs(
        os.path.dirname(OUTPUT_CSV),
        exist_ok=True
    )

    result_df = pd.DataFrame(
        results
    )

    result_df.to_csv(
        OUTPUT_CSV,
        index=False
    )

    print(
        f"\nSaved corrected report:"
    )

    print(
        os.path.abspath(
            OUTPUT_CSV
        )
    )

    print(
        f"\nSuccessfully matched "
        f"{len(result_df)} suspicious records."
    )

    print("\n" + "=" * 80)
    print(" INSPECTION COMPLETED")
    print("=" * 80)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()