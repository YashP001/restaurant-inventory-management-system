import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd

from app.schemas import DailyItemForecast, PredictDemandResponse
from app.services.preprocessor import DataPreprocessor
from app.services.baseline import SeasonalNaiveForecaster
from app.services.random_forest import RandomForestForecaster
from app.services.evaluator import ModelEvaluator

logger = logging.getLogger(__name__)


class DemandPredictor:
    """
    Coordinates data preprocessing, model selection via chronological validation,
    7-day multi-step forecast generation, and defensible empirical residual-based
    uncertainty bound calculation.
    """

    @staticmethod
    def generate_demand_forecast(
        preprocessed_grid: pd.DataFrame,
        horizon_days: int = 7
    ) -> Tuple[str, str, List[DailyItemForecast]]:
        """
        1. Evaluates baseline vs RF chronologically to pick the best model for this dataset.
        2. Computes empirical validation residuals to derive uncertainty bounds.
        3. Generates horizon_days predictions for all menu items.
        4. Calculates defensible empirical uncertainty bounds (clamped >= 0).

        Returns:
            (selected_model_name, uncertainty_method, forecasts_list)
        """
        # Step 1: Run chronological evaluation for model selection & residual estimation
        try:
            (
                base_metrics,
                rf_metrics,
                selected_model_name,
                rationale,
                split_summary,
                y_true_val,
                y_pred_val
            ) = ModelEvaluator.evaluate_chronological(preprocessed_grid)

            # Compute empirical residual statistics from validation set
            residuals = y_true_val - y_pred_val
            # Use empirical 10th and 90th percentiles or 1.645 * std
            std_residual = float(np.std(residuals)) if len(residuals) > 0 else 1.0
            # Mean error bias adjustment is zero-centered for bounds
            uncertainty_margin = max(0.5, 1.645 * std_residual)
            uncertainty_method = "empirical_residual_std_provisional"

        except Exception as e:
            logger.warning("Falling back to default model due to evaluation warning: %s", e)
            selected_model_name = "SeasonalNaive_7D"
            uncertainty_margin = 1.0
            uncertainty_method = "provisional_heuristic_uncalibrated"

        # Step 2: Fit and forecast on entire preprocessed history
        if selected_model_name == "RandomForestRegressor":
            rf = RandomForestForecaster(n_estimators=100, max_depth=5, random_state=42)
            forecast_df = rf.forecast_7_days_recursive(preprocessed_grid, horizon_days=horizon_days)
        else:
            selected_model_name = "SeasonalNaive_7D"
            baseline = SeasonalNaiveForecaster()
            forecast_df = baseline.forecast_7_days_recursive(preprocessed_grid, horizon_days=horizon_days) \
                if hasattr(baseline, "forecast_7_days_recursive") else baseline.forecast_7_days(preprocessed_grid, horizon_days=horizon_days)

        # Step 3: Format predictions with empirical uncertainty bounds
        forecasts: List[DailyItemForecast] = []
        for _, row in forecast_df.iterrows():
            pred_qty = float(row["predicted_quantity"])
            lower = max(0.0, round(pred_qty - uncertainty_margin, 2))
            upper = round(pred_qty + uncertainty_margin, 2)

            forecasts.append(DailyItemForecast(
                date=row["date"],
                menu_item_id=int(row["menu_item_id"]),
                predicted_quantity=pred_qty,
                confidence_lower_bound=lower,
                confidence_upper_bound=upper
            ))

        return selected_model_name, uncertainty_method, forecasts
