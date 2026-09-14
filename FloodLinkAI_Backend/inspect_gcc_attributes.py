"""
FloodLink AI
GCC Storm Water Drain - Raw Attribute Inspection

Purpose:
    Inspect specific GCC Storm_Water_Drain records.

OBJECTIDs:
    2045
    2091
    2167

The GCC Layer 8 geometry uses:
    EPSG:32644
    WGS 84 / UTM Zone 44N

This script:
    1. Queries the original GCC Layer 8.
    2. Retrieves all raw attributes.
    3. Retrieves complete geometry.
    4. Prints every attribute.
    5. Calculates geometry extent.
    6. Calculates actual line length from geometry.
    7. Compares geometry length with GCC drain_len/dlen_km.
    8. Saves results to CSV.
    9. Saves geometry summary to a second CSV.
"""

import os
import requests
import pandas as pd

from shapely.geometry import LineString, MultiLineString


# ============================================================
# CONFIGURATION
# ============================================================

GCC_URL = (
    "https://gisgcc.chennaicorporation.gov.in/"
    "server/rest/services/GCCDepts/"
    "GCC_COLLABORATION_LAYER/MapServer/8/query"
)

OBJECT_IDS = [
    2045,
    2091,
    2167
]

OUTPUT_ATTRIBUTES_CSV = os.path.join(
    "data",
    "processed",
    "gcc_selected_raw_attributes.csv"
)

OUTPUT_GEOMETRY_CSV = os.path.join(
    "data",
    "processed",
    "gcc_selected_geometry_summary.csv"
)


# ============================================================
# HELPER
# ============================================================

def safe_float(value):
    """
    Convert a value to float where possible.
    """

    try:
        if value is None:
            return None

        return float(value)

    except (TypeError, ValueError):
        return None


# ============================================================
# CONVERT ARC GIS GEOMETRY TO SHAPELY
# ============================================================

def geometry_to_shapely(geometry):
    """
    Convert ArcGIS polyline geometry to Shapely geometry.
    """

    if not geometry:
        return None

    paths = geometry.get("paths", [])

    if not paths:
        return None

    lines = []

    for path in paths:

        if not path:
            continue

        if len(path) < 2:
            continue

        try:

            line = LineString(path)

            if not line.is_empty:
                lines.append(line)

        except Exception as e:

            print(
                f"Warning: could not convert path: {e}"
            )

    if not lines:
        return None

    if len(lines) == 1:
        return lines[0]

    return MultiLineString(lines)


# ============================================================
# QUERY ONE OBJECTID
# ============================================================

def query_objectid(objectid):

    print("\n" + "=" * 90)
    print(f" QUERYING GCC OBJECTID {objectid}")
    print("=" * 90)

    params = {
        "where": f"OBJECTID = {objectid}",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "json"
    }

    print("\nRequest parameters:")
    print(params)

    try:

        response = requests.get(
            GCC_URL,
            params=params,
            timeout=60
        )

        response.raise_for_status()

        data = response.json()

    except Exception as e:

        print("\nERROR:")
        print(e)

        return None

    # --------------------------------------------------------
    # Check ArcGIS error
    # --------------------------------------------------------

    if "error" in data:

        print("\nGCC API ERROR:")
        print(data["error"])

        return None

    # --------------------------------------------------------
    # Extract features
    # --------------------------------------------------------

    features = data.get(
        "features",
        []
    )

    if not features:

        print(
            f"\nNo feature found for OBJECTID {objectid}."
        )

        return None

    print(
        f"\nFeatures returned: {len(features)}"
    )

    return features[0]


# ============================================================
# PRINT ALL RAW ATTRIBUTES
# ============================================================

def print_attributes(attributes):

    print("\n" + "-" * 90)
    print(" ALL RAW GCC ATTRIBUTES")
    print("-" * 90)

    for key in sorted(attributes.keys()):

        value = attributes[key]

        print(
            f"{key:<30} : {value}"
        )


# ============================================================
# ANALYZE GEOMETRY
# ============================================================

def analyze_geometry(geometry):

    print("\n" + "-" * 90)
    print(" GEOMETRY ANALYSIS")
    print("-" * 90)

    if not geometry:

        print("\nNo geometry returned.")

        return None

    print(
        f"\nGeometry spatial reference:"
    )

    spatial_reference = geometry.get(
        "spatialReference",
        {}
    )

    if spatial_reference:

        print(
            f"  WKID       : "
            f"{spatial_reference.get('wkid')}"
        )

        print(
            f"  Latest WKID: "
            f"{spatial_reference.get('latestWkid')}"
        )

    paths = geometry.get(
        "paths",
        []
    )

    print(
        f"\nNumber of paths: {len(paths)}"
    )

    total_vertices = 0

    all_x = []
    all_y = []

    path_lengths = []

    shapely_geometry = geometry_to_shapely(
        geometry
    )

    # --------------------------------------------------------
    # Analyze every path
    # --------------------------------------------------------

    for path_index, path in enumerate(paths):

        vertex_count = len(path)

        total_vertices += vertex_count

        print(
            f"\nPath {path_index + 1}:"
        )

        print(
            f"  Vertices: {vertex_count}"
        )

        if path:

            first = path[0]
            last = path[-1]

            print(
                f"  First vertex: "
                f"X={first[0]}, Y={first[1]}"
            )

            print(
                f"  Last vertex : "
                f"X={last[0]}, Y={last[1]}"
            )

        # ----------------------------------------------------
        # Collect coordinates
        # ----------------------------------------------------

        for point in path:

            if len(point) >= 2:

                x = safe_float(point[0])
                y = safe_float(point[1])

                if x is not None:
                    all_x.append(x)

                if y is not None:
                    all_y.append(y)

        # ----------------------------------------------------
        # Calculate individual path length
        # ----------------------------------------------------

        try:

            if len(path) >= 2:

                path_line = LineString(path)

                length_m = path_line.length

                path_lengths.append(
                    length_m
                )

                print(
                    f"  Calculated length: "
                    f"{length_m:.3f} m"
                )

                print(
                    f"  Calculated length: "
                    f"{length_m / 1000:.6f} km"
                )

        except Exception as e:

            print(
                f"  Could not calculate length: {e}"
            )

    # --------------------------------------------------------
    # Overall geometry length
    # --------------------------------------------------------

    calculated_length_m = None

    if shapely_geometry is not None:

        calculated_length_m = (
            shapely_geometry.length
        )

    # --------------------------------------------------------
    # Geometry extent
    # --------------------------------------------------------

    if all_x and all_y:

        min_x = min(all_x)
        max_x = max(all_x)

        min_y = min(all_y)
        max_y = max(all_y)

        print("\nGeometry extent:")
        print(
            f"  Min X: {min_x:.3f}"
        )
        print(
            f"  Max X: {max_x:.3f}"
        )
        print(
            f"  Min Y: {min_y:.3f}"
        )
        print(
            f"  Max Y: {max_y:.3f}"
        )

        print(
            f"\nBounding box width : "
            f"{max_x - min_x:.3f} m"
        )

        print(
            f"Bounding box height: "
            f"{max_y - min_y:.3f} m"
        )

    else:

        min_x = None
        max_x = None
        min_y = None
        max_y = None

    print(
        f"\nTotal vertices: "
        f"{total_vertices}"
    )

    print(
        f"Total calculated geometry length: "
        f"{calculated_length_m:.3f} m"
        if calculated_length_m is not None
        else
        "Total calculated geometry length: N/A"
    )

    if calculated_length_m is not None:

        print(
            f"Total calculated geometry length: "
            f"{calculated_length_m / 1000:.6f} km"
        )

    return {

        "geometry_wkid":
            spatial_reference.get("wkid"),

        "geometry_latest_wkid":
            spatial_reference.get("latestWkid"),

        "path_count":
            len(paths),

        "vertex_count":
            total_vertices,

        "min_x":
            min_x,

        "max_x":
            max_x,

        "min_y":
            min_y,

        "max_y":
            max_y,

        "bbox_width_m":
            (
                max_x - min_x
                if min_x is not None
                else None
            ),

        "bbox_height_m":
            (
                max_y - min_y
                if min_y is not None
                else None
            ),

        "geometry_length_m":
            calculated_length_m,

        "geometry_length_km":
            (
                calculated_length_m / 1000
                if calculated_length_m is not None
                else None
            )
    }


# ============================================================
# COMPARE GCC ATTRIBUTES WITH GEOMETRY
# ============================================================

def compare_lengths(
    attributes,
    geometry_info
):

    print("\n" + "-" * 90)
    print(" GCC ATTRIBUTE vs GEOMETRY LENGTH")
    print("-" * 90)

    gcc_drain_len = safe_float(
        attributes.get("drain_len")
    )

    gcc_dlen_km = safe_float(
        attributes.get("dlen_km")
    )

    geometry_length_m = (
        geometry_info.get(
            "geometry_length_m"
        )
        if geometry_info
        else None
    )

    print(
        f"\nGCC drain_len : "
        f"{gcc_drain_len}"
    )

    print(
        f"GCC dlen_km   : "
        f"{gcc_dlen_km}"
    )

    print(
        f"Geometry len  : "
        f"{geometry_length_m}"
    )

    # --------------------------------------------------------
    # Compare drain_len with geometry
    # --------------------------------------------------------

    if (
        gcc_drain_len is not None
        and geometry_length_m is not None
    ):

        difference_m = (
            gcc_drain_len
            - geometry_length_m
        )

        difference_percent = (
            abs(difference_m)
            / geometry_length_m
            * 100
            if geometry_length_m != 0
            else None
        )

        print(
            f"\nDifference "
            f"(drain_len - geometry): "
            f"{difference_m:.3f} m"
        )

        if difference_percent is not None:

            print(
                f"Difference percentage: "
                f"{difference_percent:.2f}%"
            )

    # --------------------------------------------------------
    # Compare dlen_km with geometry
    # --------------------------------------------------------

    if (
        gcc_dlen_km is not None
        and geometry_length_m is not None
    ):

        geometry_km = (
            geometry_length_m / 1000
        )

        difference_km = (
            gcc_dlen_km
            - geometry_km
        )

        print(
            f"\nDifference "
            f"(dlen_km - geometry): "
            f"{difference_km:.6f} km"
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 90)
    print(
        " FLOODLINK AI - GCC RAW ATTRIBUTE INSPECTION"
    )
    print("=" * 90)

    print("\nGCC Layer:")
    print(GCC_URL)

    print("\nTarget OBJECTIDs:")
    print(
        ", ".join(
            str(x)
            for x in OBJECT_IDS
        )
    )

    print(
        "\nGeometry CRS expected:"
        " EPSG:32644"
    )

    all_attribute_results = []
    all_geometry_results = []

    # --------------------------------------------------------
    # Process each OBJECTID
    # --------------------------------------------------------

    for objectid in OBJECT_IDS:

        feature = query_objectid(
            objectid
        )

        if feature is None:
            continue

        attributes = feature.get(
            "attributes",
            {}
        )

        geometry = feature.get(
            "geometry"
        )

        # ----------------------------------------------------
        # Print raw attributes
        # ----------------------------------------------------

        print_attributes(
            attributes
        )

        # ----------------------------------------------------
        # Analyze geometry
        # ----------------------------------------------------

        geometry_info = analyze_geometry(
            geometry
        )

        # ----------------------------------------------------
        # Compare lengths
        # ----------------------------------------------------

        compare_lengths(
            attributes,
            geometry_info
        )

        # ----------------------------------------------------
        # Build attribute result
        # ----------------------------------------------------

        attribute_result = {}

        for key, value in attributes.items():

            attribute_result[key] = value

        all_attribute_results.append(
            attribute_result
        )

        # ----------------------------------------------------
        # Build geometry result
        # ----------------------------------------------------

        geometry_result = {

            "OBJECTID":
                attributes.get(
                    "OBJECTID"
                ),

            "drain_type":
                attributes.get(
                    "drain_type"
                ),

            "drain_wid":
                attributes.get(
                    "drain_wid"
                ),

            "drain_dep":
                attributes.get(
                    "drain_dep"
                ),

            "drain_len":
                attributes.get(
                    "drain_len"
                ),

            "dlen_km":
                attributes.get(
                    "dlen_km"
                ),

            "zone":
                attributes.get(
                    "zone"
                ),

            "ward":
                attributes.get(
                    "ward"
                ),

            "status":
                attributes.get(
                    "status"
                ),

            "water_flow":
                attributes.get(
                    "water_flow"
                )
        }

        if geometry_info:

            geometry_result.update(
                geometry_info
            )

        all_geometry_results.append(
            geometry_result
        )

    # --------------------------------------------------------
    # Save attributes CSV
    # --------------------------------------------------------

    print("\n" + "=" * 90)
    print(" SAVING RAW ATTRIBUTE RESULTS")
    print("=" * 90)

    os.makedirs(
        os.path.dirname(
            OUTPUT_ATTRIBUTES_CSV
        ),
        exist_ok=True
    )

    if all_attribute_results:

        attributes_df = pd.DataFrame(
            all_attribute_results
        )

        attributes_df.to_csv(
            OUTPUT_ATTRIBUTES_CSV,
            index=False
        )

        print(
            "\nSaved:"
        )

        print(
            os.path.abspath(
                OUTPUT_ATTRIBUTES_CSV
            )
        )

        print(
            f"\nRows saved: "
            f"{len(attributes_df)}"
        )

    else:

        print(
            "\nNo attribute records to save."
        )

    # --------------------------------------------------------
    # Save geometry CSV
    # --------------------------------------------------------

    print("\n" + "=" * 90)
    print(" SAVING GEOMETRY RESULTS")
    print("=" * 90)

    if all_geometry_results:

        geometry_df = pd.DataFrame(
            all_geometry_results
        )

        geometry_df.to_csv(
            OUTPUT_GEOMETRY_CSV,
            index=False
        )

        print(
            "\nSaved:"
        )

        print(
            os.path.abspath(
                OUTPUT_GEOMETRY_CSV
            )
        )

        print(
            f"\nRows saved: "
            f"{len(geometry_df)}"
        )

    else:

        print(
            "\nNo geometry records to save."
        )

    # --------------------------------------------------------
    # Final summary
    # --------------------------------------------------------

    print("\n" + "=" * 90)
    print(" INSPECTION COMPLETED")
    print("=" * 90)

    print(
        "\nFiles generated:"
    )

    print(
        f"1. {OUTPUT_ATTRIBUTES_CSV}"
    )

    print(
        f"2. {OUTPUT_GEOMETRY_CSV}"
    )

    print(
        "\nTarget OBJECTIDs:"
    )

    print(
        "2045, 2091, 2167"
    )

    print(
        "\nUse the output to determine whether "
        "the large drain_wid values are genuine "
        "GCC source values or data-entry/field issues."
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()