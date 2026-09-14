import pandas as pd
import numpy as np
import joblib

from pathlib import Path

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score
)

from sklearn.model_selection import GroupShuffleSplit


# ============================================================
# FloodLink AI - Spatially Validated Random Forest
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_FILE = (
    BASE_DIR
    / "data"
    / "processed"
    / "floodlink_ml_dataset.csv"
)

MODEL_DIR = BASE_DIR / "ml"

MODEL_FILE = MODEL_DIR / "floodlink_model.joblib"
PIPELINE_FILE = MODEL_DIR / "floodlink_pipeline.joblib"


print("=" * 70)
print(" FloodLink AI - Spatial Random Forest Training")
print("=" * 70)


# ============================================================
# 1. Load dataset
# ============================================================

print("\nLoading ML dataset...")

df = pd.read_csv(DATA_FILE)

print(f"Dataset shape: {df.shape}")

print("\nColumns:")
print(df.columns.tolist())


# ============================================================
# 2. Basic validation
# ============================================================

required_columns = [
    "latitude",
    "longitude",
    "nearest_drain_distance_km",
    "drain_width_m",
    "drain_depth_m",
    "drain_length_km",
    "drain_type",
    "water_flow",
    "drain_status",
    "elevation_m",
    "target"
]

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )


# ============================================================
# 3. Clean numeric values
# ============================================================

numeric_columns = [
    "latitude",
    "longitude",
    "nearest_drain_distance_km",
    "drain_width_m",
    "drain_depth_m",
    "drain_length_km",
    "elevation_m"
]

for col in numeric_columns:

    df[col] = pd.to_numeric(
        df[col],
        errors="coerce"
    )


# Remove rows with missing required values

df = df.dropna(
    subset=required_columns
).reset_index(drop=True)


print(f"\nDataset after cleaning: {df.shape}")


# ============================================================
# 4. Target validation
# ============================================================

df["target"] = df["target"].astype(int)

print("\nTarget distribution:")

print(
    df["target"]
    .value_counts()
    .sort_index()
)

if df["target"].nunique() != 2:

    raise ValueError(
        "Target must contain both classes 0 and 1."
    )


# ============================================================
# 5. Create spatial groups
# ============================================================
#
# IMPORTANT:
#
# latitude and longitude are NOT ML features.
#
# They are used ONLY to create geographic groups for
# spatial validation.
#
# Nearby points are placed into the same spatial block.
#
# This prevents nearby observations from appearing in both
# training and testing sets.
# ============================================================

print("\nCreating spatial validation groups...")

# Approximate spatial grid.
#
# 0.01 degree is roughly around 1 km in latitude.
#
# This creates geographic blocks rather than random rows.

SPATIAL_GRID_SIZE = 0.01

df["spatial_lat"] = (
    np.floor(
        df["latitude"] / SPATIAL_GRID_SIZE
    )
)

df["spatial_lon"] = (
    np.floor(
        df["longitude"] / SPATIAL_GRID_SIZE
    )
)

df["spatial_group"] = (
    df["spatial_lat"].astype(str)
    + "_"
    + df["spatial_lon"].astype(str)
)


print(
    f"Number of spatial groups: "
    f"{df['spatial_group'].nunique()}"
)


# ============================================================
# 6. Define ML features
# ============================================================
#
# latitude and longitude are deliberately excluded.
#
# spatial_lat, spatial_lon and spatial_group are also excluded.
#
# target is excluded from X.
# ============================================================

numeric_features = [
    "nearest_drain_distance_km",
    "drain_width_m",
    "drain_depth_m",
    "drain_length_km",
    "elevation_m"
]

categorical_features = [
    "drain_type",
    "water_flow",
    "drain_status"
]

feature_columns = (
    numeric_features
    + categorical_features
)

X = df[feature_columns].copy()

y = df["target"].copy()

groups = df["spatial_group"].copy()


print("\nRandom Forest features:")

for feature in feature_columns:
    print(f"  - {feature}")


print("\nExcluded from ML features:")

print("  - latitude")
print("  - longitude")
print("  - spatial_lat")
print("  - spatial_lon")
print("  - spatial_group")
print("  - target")


# ============================================================
# 7. Spatial train/test split
# ============================================================

print("\nCreating spatial train/test split...")

splitter = GroupShuffleSplit(
    n_splits=50,
    test_size=0.20,
    random_state=42
)


# Find a split where BOTH train and test contain
# flood and background observations.

selected_split = None

for split_number, (train_idx, test_idx) in enumerate(
    splitter.split(X, y, groups=groups),
    start=1
):

    train_classes = y.iloc[train_idx].nunique()
    test_classes = y.iloc[test_idx].nunique()

    if train_classes == 2 and test_classes == 2:

        selected_split = (
            train_idx,
            test_idx
        )

        print(
            f"Valid spatial split found "
            f"on attempt {split_number}."
        )

        break


if selected_split is None:

    raise ValueError(
        "Could not create a spatial split containing "
        "both target classes in train and test."
    )


train_idx, test_idx = selected_split


X_train = X.iloc[train_idx].copy()
X_test = X.iloc[test_idx].copy()

y_train = y.iloc[train_idx].copy()
y_test = y.iloc[test_idx].copy()

groups_train = groups.iloc[train_idx]
groups_test = groups.iloc[test_idx]


# ============================================================
# 8. Verify spatial separation
# ============================================================

overlap = set(groups_train).intersection(
    set(groups_test)
)

print(
    f"\nSpatial groups in training: "
    f"{groups_train.nunique()}"
)

print(
    f"Spatial groups in testing : "
    f"{groups_test.nunique()}"
)

print(
    f"Overlapping spatial groups: "
    f"{len(overlap)}"
)

if len(overlap) != 0:

    raise ValueError(
        "Spatial leakage detected! "
        "Training and testing groups overlap."
    )


# ============================================================
# 9. Show split information
# ============================================================

print("\nTraining rows:", len(X_train))
print("Testing rows :", len(X_test))

print("\nTraining target distribution:")
print(y_train.value_counts().sort_index())

print("\nTesting target distribution:")
print(y_test.value_counts().sort_index())


# ============================================================
# 10. Preprocessing
# ============================================================

print("\nBuilding preprocessing pipeline...")

preprocessor = ColumnTransformer(
    transformers=[
        (
            "numeric",
            "passthrough",
            numeric_features
        ),

        (
            "categorical",
            OneHotEncoder(
                handle_unknown="ignore"
            ),
            categorical_features
        )
    ]
)


# ============================================================
# 11. Random Forest
# ============================================================

print("\nCreating Random Forest...")

model = RandomForestClassifier(
    n_estimators=500,
    max_depth=None,
    min_samples_split=4,
    min_samples_leaf=2,
    max_features="sqrt",
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)


# ============================================================
# 12. Complete ML pipeline
# ============================================================

pipeline = Pipeline(
    steps=[
        (
            "preprocessor",
            preprocessor
        ),

        (
            "classifier",
            model
        )
    ]
)


# ============================================================
# 13. Train
# ============================================================

print("\nTraining Random Forest...")

pipeline.fit(
    X_train,
    y_train
)

print("Training completed!")


# ============================================================
# 14. Predictions
# ============================================================

print("\nGenerating predictions...")

y_pred = pipeline.predict(X_test)

y_probability = pipeline.predict_proba(
    X_test
)[:, 1]


# ============================================================
# 15. Evaluation
# ============================================================

accuracy = accuracy_score(
    y_test,
    y_pred
)

roc_auc = roc_auc_score(
    y_test,
    y_probability
)

print("\n" + "=" * 70)
print(" MODEL PERFORMANCE - SPATIAL TEST SET")
print("=" * 70)

print(
    f"\nAccuracy : {accuracy:.4f}"
)

print(
    f"ROC-AUC  : {roc_auc:.4f}"
)

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        y_pred,
        target_names=[
            "Background",
            "Flood"
        ],
        digits=4
    )
)


# ============================================================
# 16. Confusion matrix
# ============================================================

cm = confusion_matrix(
    y_test,
    y_pred
)

print("Confusion Matrix:")

print(cm)


# ============================================================
# 17. Feature importance
# ============================================================

print("\n" + "=" * 70)
print(" FEATURE IMPORTANCE")
print("=" * 70)

# Get transformed feature names

preprocessor_fitted = (
    pipeline.named_steps["preprocessor"]
)

classifier_fitted = (
    pipeline.named_steps["classifier"]
)

feature_names = (
    preprocessor_fitted
    .get_feature_names_out()
)

importance_values = (
    classifier_fitted
    .feature_importances_
)

importance_df = pd.DataFrame(
    {
        "feature": feature_names,
        "importance": importance_values
    }
)

importance_df = (
    importance_df
    .sort_values(
        "importance",
        ascending=False
    )
    .reset_index(drop=True)
)

print(
    importance_df.to_string(
        index=False
    )
)


# ============================================================
# 18. Save model
# ============================================================

print("\nSaving trained model...")

MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)

joblib.dump(
    classifier_fitted,
    MODEL_FILE
)

joblib.dump(
    pipeline,
    PIPELINE_FILE
)


# ============================================================
# 19. Save training metadata
# ============================================================

metadata = {

    "model_type":
        "RandomForestClassifier",

    "validation":
        "Spatial GroupShuffleSplit",

    "spatial_grid_size":
        SPATIAL_GRID_SIZE,

    "random_state":
        42,

    "n_estimators":
        500,

    "features":
        feature_columns,

    "numeric_features":
        numeric_features,

    "categorical_features":
        categorical_features,

    "excluded_from_features":
        [
            "latitude",
            "longitude",
            "spatial_lat",
            "spatial_lon",
            "spatial_group"
        ],

    "train_rows":
        int(len(X_train)),

    "test_rows":
        int(len(X_test)),

    "accuracy":
        float(accuracy),

    "roc_auc":
        float(roc_auc)
}

METADATA_FILE = (
    MODEL_DIR
    / "training_metadata.joblib"
)

joblib.dump(
    metadata,
    METADATA_FILE
)


# ============================================================
# 20. Final summary
# ============================================================

print("\n" + "=" * 70)
print(" TRAINING COMPLETED SUCCESSFULLY")
print("=" * 70)

print("\nSaved files:")

print(
    f"Model    : {MODEL_FILE}"
)

print(
    f"Pipeline : {PIPELINE_FILE}"
)

print(
    f"Metadata : {METADATA_FILE}"
)

print("\nFinal spatial test performance:")

print(
    f"Accuracy : {accuracy:.4f}"
)

print(
    f"ROC-AUC  : {roc_auc:.4f}"
)

print("\nImportant:")
print(
    "Latitude and longitude were NOT used "
    "as Random Forest prediction features."
)

print(
    "They were used ONLY for spatial validation."
)

print("\nDone.")