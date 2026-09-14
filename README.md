🌧️ FloodLink AI
From Rainfall to Road-Level Action
An AI-powered urban flood nowcasting and decision-support system that combines rainfall, drainage, elevation, land-use, and historical flood patterns to estimate flood risk and support faster local response.

🚨 Problem Statement
SIH26085 — Urban Flood Nowcasting System (Drainage and Rainfall Coupling)
Urban flooding can develop rapidly when intense rainfall exceeds the capacity of drainage infrastructure.

Existing flood monitoring approaches often depend on isolated rainfall information or post-flood observations. This creates a gap between:

Rainfall → Drainage Response → Flood Risk → Action

FloodLink AI aims to bridge this gap by combining multiple spatial and environmental factors into a single map-based decision-support platform.

💡 Our Solution
FloodLink AI is a mobile-based urban flood nowcasting and decision-support platform designed to estimate localized flood risk and provide actionable information.

The system combines:

🌧️ Real-time / near-real-time rainfall information
🕳️ Storm-water drainage network data
⛰️ Elevation and terrain information
🏙️ Land-use and urban characteristics
🌊 Historical flood patterns
🤖 Machine Learning-based risk estimation
🗺️ Map-based visualization
⚠️ Risk-level classification
🚧 Road-level risk awareness
🧠 Decision-support recommendations
Our initial pilot focuses on Velachery, Chennai, an area that is vulnerable to urban flooding.

🎯 Objectives
Predict localized urban flood susceptibility.
Combine rainfall intensity with drainage and terrain conditions.
Identify high-risk roads and areas.
Provide an easy-to-understand flood risk map.
Support authorities and response teams with decision-support information.
Enable faster preventive actions before severe flooding occurs.
Create a scalable architecture that can be extended to other urban regions.
✨ Key Features
🌧️ Rainfall Monitoring
FloodLink AI incorporates rainfall information to estimate the potential impact of precipitation on urban areas.

Rainfall intensity is converted into a normalized risk score and combined with other environmental factors.

🗺️ Interactive Flood Risk Map
The application provides a map-based visualization of flood-prone areas.

The map can display:

Risk zones
High-risk roads
Drainage network
Location-based flood information
Risk levels
Spatial information
The current prototype uses OpenStreetMap-based map visualization.

🕳️ Drainage Analysis
The system incorporates storm-water drainage information to understand how drainage infrastructure can influence flood susceptibility.

The prototype integrates drainage information from the Greater Chennai Corporation (GCC) GIS data.

Relevant drainage attributes include information such as:

Drain type
Water flow
Status
Drain length
Location
Ward / zone information
⛰️ Elevation Analysis
Elevation plays an important role in urban flood susceptibility.

Low-lying areas can have a greater tendency to accumulate water depending on rainfall and drainage conditions.

FloodLink AI incorporates elevation information into the spatial risk analysis.

🤖 Machine Learning
FloodLink AI uses a Random Forest-based machine learning model for flood susceptibility estimation.

The ML pipeline is designed to learn relationships between spatial/environmental features and flood-risk labels.

The current prototype uses spatial validation to reduce the possibility of relying on simple random splitting of nearby geographic samples.

Important Note
The current system is a prototype developed for the hackathon.

The model should not be interpreted as a production-grade flood prediction system or as having guaranteed real-world prediction accuracy.

Further validation using larger, high-quality, geographically representative historical datasets is required before operational deployment.

🧠 Risk Estimation Approach
The prototype combines multiple factors to generate an overall flood-risk estimate.

Conceptually:

              ┌──────────────────┐
              │ Rainfall Data    │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Rainfall Risk    │
              │   Calculation    │
              └────────┬─────────┘
                       │
                       │
┌──────────────────────┼──────────────────────┐
│                      │                      │
▼                      ▼                      ▼
Elevation          Drainage             Historical
Analysis           Analysis              Flood Data
│                      │                      │
└──────────────────────┼──────────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Spatial / ML     │
              │ Risk Estimation  │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Flood Risk Score │
              └────────┬─────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       MODERATE       HIGH       CRITICAL
          │            │            │
          └────────────┼────────────┘
                       ▼
              ┌──────────────────┐
              │ Decision Support │
              └──────────────────┘
