import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor

from app.services.preprocessor import DataPreprocessor

logger = logging.getLogger(__name__)


class RandomForestForecaster:
    """
    Random Forest Regressor for daily restaurant menu demand forecasting.
    Configured conservatively to prevent overfitting on small/synthetic datasets:
    n_estimators=100, max_depth=5, random_state=42.
    """

    FEATURE_COLS = ["menu_item_id", "day_of_week", "is_weekend", "lag_1", "lag_7", "rolling_mean_7"]

    def __init__(self, n_estimators: int = 100, max_depth: int = 5, random_state: int = 42):
        self.model_name = "RandomForestRegressor"
        self.version = "1.0.0"
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state
        self.model = RandomForestRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            random_state=self.random_state
        )
        self.is_fitted = False

    def fit(self, training_feat_df: pd.DataFrame) -> "RandomForestForecaster":
        """
        Fits the Random Forest model on training feature dataframe.
        Drops rows with NaNs resulting from warm-up lags (first 7 days).
        """
        clean_df = training_feat_df.dropna(subset=self.FEATURE_COLS + ["quantity_sold"]).copy()
        if len(clean_df) == 0:
            raise ValueError("No valid training samples available after dropping initial lag NaNs.")

        X = clean_df[self.FEATURE_COLS]
        y = clean_df["quantity_sold"]

        self.model.fit(X, y)
        self.is_fitted = True
        logger.info("Fitted RandomForestRegressor on %d observations.", len(clean_df))
        return self

    def predict_single_step(self, X_df: pd.DataFrame) -> np.ndarray:
        """
        Predicts single step, ensuring non-negative output.
        """
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before calling predict.")
        preds = self.model.predict(X_df[self.FEATURE_COLS])
        return np.maximum(0.0, preds)

    def forecast_7_days_recursive(
        self,
        daily_grid: pd.DataFrame,
        horizon_days: int = 7
    ) -> pd.DataFrame:
        """
        Generates multi-step recursive forecasts for all menu items for the next horizon_days.
        At each step h:
        - lag_1 uses predicted value from h-1 (or observed t for h=1)
        - lag_7 uses observed or predicted value from h-7
        - rolling_mean_7 uses mean of the most recent 7 values
        """
        if not self.is_fitted:
            # Fit on available data
            feat_df = DataPreprocessor.engineer_features(daily_grid)
            self.fit(feat_df)

        max_date = daily_grid["date"].max()
        item_ids = sorted(daily_grid["menu_item_id"].unique())

        results = []

        # Maintain a dynamic history series for each item
        for item_id in item_ids:
            item_df = daily_grid[daily_grid["menu_item_id"] == item_id].sort_values("date")
            history_dates = list(item_df["date"])
            history_vals = list(item_df["quantity_sold"].astype(float))

            for h in range(1, horizon_days + 1):
                target_date = max_date + timedelta(days=h)
                dow = target_date.weekday()
                is_wknd = 1 if dow in [5, 6] else 0

                # lag_1 is the last value in our dynamic history (index -1)
                lag_1 = history_vals[-1]

                # lag_7 is the 7th value back in our dynamic history (index -7)
                lag_7 = history_vals[-7] if len(history_vals) >= 7 else history_vals[0]

                # rolling_mean_7 is the average of the last 7 values
                recent_7 = history_vals[-7:] if len(history_vals) >= 7 else history_vals
                rolling_mean_7 = float(np.mean(recent_7))

                input_row = pd.DataFrame([{
                    "menu_item_id": item_id,
                    "day_of_week": dow,
                    "is_weekend": is_wknd,
                    "lag_1": lag_1,
                    "lag_7": lag_7,
                    "rolling_mean_7": rolling_mean_7
                }])

                pred = float(self.predict_single_step(input_row)[0])
                pred_clean = round(pred, 2)

                # Append to dynamic series for subsequent recursive steps
                history_dates.append(target_date)
                history_vals.append(pred_clean)

                results.append({
                    "date": target_date,
                    "menu_item_id": item_id,
                    "predicted_quantity": pred_clean
                })

        return pd.DataFrame(results)

    def evaluate_recursive_on_period(
        self,
        full_grid: pd.DataFrame,
        val_start_date: date,
        val_end_date: date
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Evaluates recursive predictions over the validation period:
        Fits model strictly on data prior to val_start_date,
        then recursively forecasts each day in [val_start_date, val_end_date].
        Returns (y_true, y_pred) as 1D numpy arrays.
        """
        train_grid = full_grid[full_grid["date"] < val_start_date].copy()
        train_feat = DataPreprocessor.engineer_features(train_grid)
        self.fit(train_feat)

        val_grid = full_grid[(full_grid["date"] >= val_start_date) & (full_grid["date"] <= val_end_date)].copy()
        val_dates = sorted(val_grid["date"].unique())

        y_true_list = []
        y_pred_list = []

        item_ids = sorted(full_grid["menu_item_id"].unique())

        for item_id in item_ids:
            # Historical training observations up to val_start_date
            item_train = train_grid[train_grid["menu_item_id"] == item_id].sort_values("date")
            history_vals = list(item_train["quantity_sold"].astype(float))

            item_val = val_grid[val_grid["menu_item_id"] == item_id].sort_values("date")
            val_actual_map = dict(zip(item_val["date"], item_val["quantity_sold"]))

            for target_date in val_dates:
                actual = float(val_actual_map.get(target_date, 0.0))
                dow = target_date.weekday()
                is_wknd = 1 if dow in [5, 6] else 0

                lag_1 = history_vals[-1]
                lag_7 = history_vals[-7] if len(history_vals) >= 7 else history_vals[0]
                rolling_mean_7 = float(np.mean(history_vals[-7:] if len(history_vals) >= 7 else history_vals))

                input_row = pd.DataFrame([{
                    "menu_item_id": item_id,
                    "day_of_week": dow,
                    "is_weekend": is_wknd,
                    "lag_1": lag_1,
                    "lag_7": lag_7,
                    "rolling_mean_7": rolling_mean_7
                }])

                pred = float(self.predict_single_step(input_row)[0])
                pred_clean = round(pred, 2)

                y_true_list.append(actual)
                y_pred_list.append(pred_clean)

                # For multi-step recursive tracking during validation
                history_vals.append(pred_clean)

        return np.array(y_true_list), np.array(y_pred_list)
