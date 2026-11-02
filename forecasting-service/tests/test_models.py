from datetime import date, timedelta
import pytest
import numpy as np
import pandas as pd

from app.schemas import DailySalesInput
from app.services.preprocessor import DataPreprocessor
from app.services.baseline import SeasonalNaiveForecaster
from app.services.random_forest import RandomForestForecaster
from app.services.evaluator import calculate_metrics, ModelEvaluator


def test_baseline_forecast_produces_7_days_all_items(sample_sales_history):
    """Verify Seasonal Naive baseline generates predictions for all 7 future dates and 15 items."""
    grid = DataPreprocessor.build_daily_item_matrix(sample_sales_history)
    baseline = SeasonalNaiveForecaster()
    forecast_df = baseline.forecast_7_days(grid, horizon_days=7)

    # 15 items * 7 days = 105 forecast points
    assert len(forecast_df) == 105
    assert forecast_df["predicted_quantity"].min() >= 0.0

    max_date = grid["date"].max()
    expected_dates = {max_date + timedelta(days=h) for h in range(1, 8)}
    assert set(forecast_df["date"]) == expected_dates
    assert set(forecast_df["menu_item_id"]) == set(range(1, 16))


def test_random_forest_recursive_forecast(sample_sales_history):
    """Verify Random Forest recursive multi-step forecaster produces 7 days without negative values."""
    grid = DataPreprocessor.build_daily_item_matrix(sample_sales_history)
    rf = RandomForestForecaster(n_estimators=50, max_depth=4, random_state=42)
    forecast_df = rf.forecast_7_days_recursive(grid, horizon_days=7)

    assert len(forecast_df) == 105
    assert forecast_df["predicted_quantity"].min() >= 0.0
    assert not forecast_df["predicted_quantity"].isna().any()

    max_date = grid["date"].max()
    expected_dates = {max_date + timedelta(days=h) for h in range(1, 8)}
    assert set(forecast_df["date"]) == expected_dates


def test_evaluation_metrics_calculation():
    """Verify MAE, RMSE, and WMAPE calculations on known ground truths."""
    y_true = np.array([10.0, 20.0, 30.0, 0.0])
    y_pred = np.array([12.0, 18.0, 33.0, 1.0])
    # Absolute errors: 2, 2, 3, 1 -> sum = 8.0
    # MAE = 8 / 4 = 2.0
    # Squared errors: 4, 4, 9, 1 -> sum = 18.0 -> mean = 4.5 -> RMSE = sqrt(4.5) ~= 2.1213
    # Sum true: 60.0 -> WMAPE = (8 / 60) * 100 = 13.33%

    metrics = calculate_metrics(y_true, y_pred)
    assert metrics.mae == 2.0
    assert abs(metrics.rmse - 2.1213) < 0.001
    assert abs(metrics.wmape - 13.33) < 0.01
    assert metrics.total_validation_observations == 4


def test_model_selection_rule(sample_sales_history):
    """Verify evaluator compares both models on identical validation observations."""
    grid = DataPreprocessor.build_daily_item_matrix(sample_sales_history)
    (
        base_metrics,
        rf_metrics,
        selected_model,
        rationale,
        split_summary,
        y_true,
        y_pred_selected
    ) = ModelEvaluator.evaluate_chronological(grid, train_days=70, val_days=14)

    assert selected_model in ["RandomForestRegressor", "SeasonalNaive_7D"]
    assert "validation" in rationale.lower() or "selected" in rationale.lower()
    assert base_metrics.total_validation_observations == rf_metrics.total_validation_observations
    assert base_metrics.total_validation_observations == 14 * 15  # 14 days * 15 items = 210 observations
    assert split_summary["val_days_count"] == 14
