import os
import numpy as np
import time
from sklearn.datasets import make_classification, load_iris, fetch_california_housing
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, mean_squared_error, classification_report
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Create output directory
output_dir = '/data/outputs'
os.makedirs(output_dir, exist_ok=True)

# Function to log progress
def log_progress(message):
    print(f"{message}")
    with open(f"{output_dir}/log.txt", "a") as f:
        f.write(f"{message}\n")

log_progress("Starting advanced text-based ML demo...")

# Function to create a text-based heatmap
def text_heatmap(matrix, row_labels=None, col_labels=None, title="Heatmap"):
    result = [title + "\n"]
    
    # Add column headers if provided
    if col_labels:
        header = "    "  # Space for row labels
        for label in col_labels:
            header += f"{label:8.8s} "
        result.append(header)
    
    # Add rows with labels if provided
    for i, row in enumerate(matrix):
        line = f"{row_labels[i]:4.4s} " if row_labels else f"{i:4d} "
        for val in row:
            # Use different symbols based on value
            if val > 0.8:
                symbol = "███"
            elif val > 0.6:
                symbol = "▓▓▓"
            elif val > 0.4:
                symbol = "▒▒▒"
            elif val > 0.2:
                symbol = "░░░"
            else:
                symbol = "   "
            line += f"{symbol} {val:.2f} "
        result.append(line)
    
    return "\n".join(result)

# Function to create a text-based bar chart
def text_bar_chart(values, labels=None, title="Bar Chart", max_width=40):
    result = [title + "\n"]
    
    # Find the maximum value for scaling
    max_val = max(values)
    
    # Create bars
    for i, val in enumerate(values):
        # Calculate bar length
        bar_len = int((val / max_val) * max_width)
        bar = "█" * bar_len
        
        # Add label if provided
        label = labels[i] if labels else f"Item {i+1}"
        result.append(f"{label:15.15s} | {bar} {val:.4f}")
    
    return "\n".join(result)

# 1. Classification Task
log_progress("PART 1: Classification Task")
log_progress("Generating synthetic classification dataset...")
X_class, y_class = make_classification(
    n_samples=1000,
    n_features=10,
    n_informative=5,
    n_redundant=2,
    n_classes=3,
    random_state=42
)

X_train, X_test, y_train, y_test = train_test_split(X_class, y_class, test_size=0.3, random_state=42)
log_progress(f"Dataset created with {len(X_train)} training samples and {len(X_test)} test samples")

# Train classifier
log_progress("Training Random Forest classifier...")
start_time = time.time()
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)
training_time = time.time() - start_time

# Evaluate
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
log_progress(f"Model accuracy: {accuracy:.4f}")
log_progress(f"Training time: {training_time:.2f} seconds")

# Feature importance analysis
log_progress("Analyzing feature importance...")
importances = clf.feature_importances_
feature_names = [f"Feature {i+1}" for i in range(X_class.shape[1])]

# Create text-based bar chart for feature importance
importance_chart = text_bar_chart(
    importances, 
    feature_names, 
    title="Feature Importance"
)
log_progress("Feature importance analysis complete")

# 2. Regression Task with Real Dataset
log_progress("\nPART 2: Regression Task")
log_progress("Loading California housing dataset...")
housing = fetch_california_housing()
X_reg, y_reg = housing.data, housing.target

# Normalize features
scaler = StandardScaler()
X_reg_scaled = scaler.fit_transform(X_reg)

X_reg_train, X_reg_test, y_reg_train, y_reg_test = train_test_split(
    X_reg_scaled, y_reg, test_size=0.3, random_state=42
)

log_progress(f"Housing dataset loaded with {X_reg.shape[0]} samples and {X_reg.shape[1]} features")

# Train regressor
log_progress("Training Random Forest regressor...")
start_time = time.time()
reg = RandomForestRegressor(n_estimators=100, random_state=42)
reg.fit(X_reg_train, y_reg_train)
reg_training_time = time.time() - start_time

# Evaluate
y_reg_pred = reg.predict(X_reg_test)
mse = mean_squared_error(y_reg_test, y_reg_pred)
rmse = np.sqrt(mse)
log_progress(f"Model RMSE: {rmse:.4f}")
log_progress(f"Training time: {reg_training_time:.2f} seconds")

# Feature importance for regression
reg_importances = reg.feature_importances_
reg_feature_names = housing.feature_names

# Create text-based bar chart for regression feature importance
reg_importance_chart = text_bar_chart(
    reg_importances, 
    reg_feature_names, 
    title="Housing Feature Importance"
)
log_progress("Housing feature importance analysis complete")

# 3. PCA Analysis
log_progress("\nPART 3: PCA Dimensionality Reduction")
log_progress("Performing PCA on classification dataset...")

pca = PCA()
pca.fit(X_class)
explained_variance = pca.explained_variance_ratio_

# Create text-based bar chart for explained variance
variance_chart = text_bar_chart(
    explained_variance, 
    [f"PC {i+1}" for i in range(len(explained_variance))], 
    title="PCA Explained Variance"
)

# Calculate cumulative explained variance
cumulative_variance = np.cumsum(explained_variance)
log_progress(f"Number of components for 90% variance: {np.argmax(cumulative_variance >= 0.9) + 1}")

# 4. Feature Correlation Matrix
log_progress("\nPART 4: Feature Correlation Analysis")
log_progress("Calculating feature correlation matrix...")

# Calculate correlation matrix
corr_matrix = np.corrcoef(X_class.T)

# Create text-based heatmap for correlation
corr_heatmap = text_heatmap(
    corr_matrix, 
    feature_names, 
    feature_names, 
    title="Feature Correlation Matrix"
)

# Save all results to a comprehensive report
log_progress("\nSaving comprehensive analysis report...")
with open(f"{output_dir}/ml_analysis_report.txt", "w") as f:
    f.write("# Advanced Machine Learning Analysis Report\n\n")
    
    f.write("## 1. Classification Task\n\n")
    f.write(f"Dataset: Synthetic classification with {len(X_class)} samples, {X_class.shape[1]} features\n")
    f.write(f"Classes: 3\n")
    f.write(f"Training samples: {len(X_train)}\n")
    f.write(f"Test samples: {len(X_test)}\n\n")
    f.write(f"Model: Random Forest with 100 estimators\n")
    f.write(f"Training time: {training_time:.2f} seconds\n")
    f.write(f"Accuracy: {accuracy:.4f}\n\n")
    f.write(importance_chart)
    f.write("\n\n")
    
    f.write("## 2. Regression Task (California Housing)\n\n")
    f.write(f"Dataset: California Housing with {len(X_reg)} samples, {X_reg.shape[1]} features\n")
    f.write(f"Training samples: {len(X_reg_train)}\n")
    f.write(f"Test samples: {len(X_reg_test)}\n\n")
    f.write(f"Model: Random Forest Regressor with 100 estimators\n")
    f.write(f"Training time: {reg_training_time:.2f} seconds\n")
    f.write(f"RMSE: {rmse:.4f}\n\n")
    f.write(reg_importance_chart)
    f.write("\n\n")
    
    f.write("## 3. PCA Analysis\n\n")
    f.write(variance_chart)
    f.write("\n\n")
    f.write(f"Cumulative explained variance:\n")
    for i, var in enumerate(cumulative_variance):
        f.write(f"PC 1-{i+1}: {var:.4f}\n")
    f.write("\n\n")
    
    f.write("## 4. Feature Correlation Analysis\n\n")
    f.write(corr_heatmap)

# Save a summary of the classification report
with open(f"{output_dir}/classification_report.txt", "w") as f:
    f.write("# Classification Report\n\n")
    f.write(classification_report(y_test, y_pred))

# Save feature importance data
np.savetxt(f"{output_dir}/feature_importance.txt", importances)
np.savetxt(f"{output_dir}/housing_feature_importance.txt", reg_importances)

# Save PCA results
np.savetxt(f"{output_dir}/pca_explained_variance.txt", explained_variance)
np.savetxt(f"{output_dir}/pca_cumulative_variance.txt", cumulative_variance)

# Save correlation matrix
np.savetxt(f"{output_dir}/correlation_matrix.txt", corr_matrix)

log_progress("Demo completed successfully!")
log_progress(f"All results saved to {output_dir}")