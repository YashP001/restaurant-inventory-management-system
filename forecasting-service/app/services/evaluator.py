import logging
from datetime import date, timedelta
from typing import Dict, List, Tuple
import numpy as np
import pandas as pd

from app.schemas import ModelMetrics, EvaluateResponse
from app.services.preprocessor import DataPreprocessor
from app.services.baseline import SeasonalNaiveForecaster
from app.services.random_forest import RandomForestForecaster

logger = logging.getLogger(__name__)


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> ModelMetrics:
    """
    Computes MAE, RMSE, and WMAPE on 1D numpy arrays.
    """
    if len(y_true) == 0:
        return ModelMetrics(mae=0.0, rmse=0.0, wmape=0.0, total_validation_observations=0)

    errors = np.abs(y_true - y_pred)
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    sum_true = float(np.sum(y_true))
    if sum_true > 0:
        wmape = float((np.sum(errors) / sum_true) * 100.0)
    else:
        wmape = 0.0

    return ModelMetrics(
        mae=round(mae, 4),
        rmse=round(rmse, 4),
        wmape=round(wmape, 2),
        total_validation_observations=len(y_true)
    )


class ModelEvaluator:
    """
    Orchestrates chronological model evaluation and model selection between
    Seasonal Naive Baseline and Random Forest Regressor.
    """

    @staticmethod
    def evaluate_chronological(
        full_grid: pd.DataFrame,
        train_days: int = 75,
        val_days: int = 14
    ) -> Tuple[ModelMetrics, ModelMetrics, str, str, dict, np.ndarray, np.ndarray]:
        """
        Splits data chronologically into train and validation periods.
        Evaluates both models on identical validation observations.

        Returns:
            (baseline_metrics, rf_metrics, selected_model, rationale, split_summary, y_true, y_pred_selected)
        """
        unique_dates = sorted(full_grid["date"].unique())
        total_days = len(unique_dates)

        if total_days < (train_days + val_days):
            # Dynamic fallback: reserve last 14 days (or 20%) for validation, remaining for training
            if total_days > 21:
                val_days = min(14, total_days // 5)
                train_days = total_days - val_days
            else:
                raise ValueError(
                    f"Insufficient chronological history. Expected at least {train_days + val_days} days, "
                    f"found {total_days} days."
                )

        train_dates = unique_dates[:train_days]
        val_dates = unique_dates[train_days:train_days + val_days]

        val_start_date = val_dates[0]
        val_end_date = val_dates[-1]

        split_summary = {
            "total_calendar_days": total_days,
            "train_days_count": len(train_dates),
            "train_start_date": str(train_dates[0]),
            "train_end_date": str(train_dates[-1]),
            "val_days_count": len(val_dates),
            "val_start_date": str(val_start_date),
            "val_end_date": str(val_end_date),
            "menu_items_count": int(full_grid["menu_item_id"].nunique())
        }

        # 1. Evaluate Seasonal Naive Baseline
        baseline = SeasonalNaiveForecaster()
        y_true_base, y_pred_base = baseline.evaluate_on_period(full_grid, val_start_date, val_end_date)
        baseline_metrics = calculate_metrics(y_true_base, y_pred_base)

        # 2. Evaluate Random Forest Regressor
        rf = RandomForestForecaster(n_estimators=100, max_depth=5, random_state=42)
        y_true_rf, y_pred_rf = rf.evaluate_recursive_on_period(full_grid, val_start_date, val_end_date)
        rf_metrics = calculate_metrics(y_true_rf, y_pred_rf)

        # 3. Model Selection Rule:
        # Compare on identical validation observations.
        # Select Random Forest only if it strictly outperforms baseline on WMAPE and MAE/RMSE.
        rf_wins_wmape = rf_metrics.wmape < baseline_metrics.wmape
        rf_wins_mae = rf_metrics.mae < baseline_metrics.mae

        if rf_wins_wmape and rf_wins_mae:
            selected_model = "RandomForestRegressor"
            rationale = (
                f"RandomForestRegressor selected: Lower validation WMAPE ({rf_metrics.wmape}% vs "
                f"{baseline_metrics.wmape}%) and lower MAE ({rf_metrics.mae} vs {baseline_metrics.mae})."
            )
            y_pred_selected = y_pred_rf
        else:
            selected_model = "SeasonalNaive_7D"
            if rf_metrics.wmape >= baseline_metrics.wmape:
                diff = rf_metrics.wmape - baseline_metrics.wmape
                rationale = (
                    f"SeasonalNaive_7D baseline selected: Random Forest did not outperform baseline "
                    f"(Baseline WMAPE {baseline_metrics.wmape}% vs RF {rf_metrics.wmape}%, delta +{round(diff, 2)}%). "
                    f"Simpler baseline preferred to avoid unnecessary complexity and potential overfitting."
                )
            else:
                rationale = (
                    f"SeasonalNaive_7D baseline selected: Performance difference was not conclusive across both "
                    f"WMAPE and MAE metrics. Simpler baseline chosen."
                )
            y_pred_selected = y_pred_base

        logger.info("Evaluation complete. Selected: %s. Rationale: %s", selected_model, rationale)

        return (
            baseline_metrics,
            rf_metrics,
            selected_model,
            rationale,
            split_summary,
            y_true_base,
            y_pred_selected
        )
