import logging
from datetime import date, timedelta
from typing import Dict, List, Tuple
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class SeasonalNaiveForecaster:
    """
    Seven-day Seasonal Naive baseline model for restaurant demand forecasting.
    Predicts demand for day (T + h) using the observed demand from (T + h - 7),
    matching the exact day of the week from the previous 7-day cycle.
    """

    def __init__(self):
        self.model_name = "SeasonalNaive_7D"
        self.version = "1.0.0"

    def forecast_7_days(
        self,
        daily_grid: pd.DataFrame,
        horizon_days: int = 7
    ) -> pd.DataFrame:
        """
        Generates h-day forecasts for each menu item using seasonal lag-7 values.

        daily_grid must have ['date', 'menu_item_id', 'quantity_sold'].
        Returns DataFrame with ['date', 'menu_item_id', 'predicted_quantity'].
        """
        results = []
        max_date = daily_grid["date"].max()
        item_ids = sorted(daily_grid["menu_item_id"].unique())

        for item_id in item_ids:
            item_df = daily_grid[daily_grid["menu_item_id"] == item_id].sort_values("date")
            history_map = dict(zip(item_df["date"], item_df["quantity_sold"]))

            for h in range(1, horizon_days + 1):
                target_date = max_date + timedelta(days=h)
                # Seasonal naive looks back 7 days
                lookback_date = target_date - timedelta(days=7)

                pred_val = history_map.get(lookback_date, 0.0)
                # Ensure non-negative
                pred_val = max(0.0, float(pred_val))

                results.append({
                    "date": target_date,
                    "menu_item_id": item_id,
                    "predicted_quantity": round(pred_val, 2)
                })

        return pd.DataFrame(results)

    def evaluate_on_period(
        self,
        full_grid: pd.DataFrame,
        val_start_date: date,
        val_end_date: date
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Evaluates seasonal naive predictions over a designated validation date window.
        Returns (y_true, y_pred) as 1D numpy arrays.
        """
        y_true_list = []
        y_pred_list = []

        item_ids = sorted(full_grid["menu_item_id"].unique())
        for item_id in item_ids:
            item_df = full_grid[full_grid["menu_item_id"] == item_id].sort_values("date")
            history_map = dict(zip(item_df["date"], item_df["quantity_sold"]))

            val_rows = item_df[(item_df["date"] >= val_start_date) & (item_df["date"] <= val_end_date)]
            for _, row in val_rows.iterrows():
                target_date = row["date"]
                actual = float(row["quantity_sold"])
                lookback_date = target_date - timedelta(days=7)
                pred = float(history_map.get(lookback_date, 0.0))

                y_true_list.append(actual)
                y_pred_list.append(max(0.0, pred))

        return np.array(y_true_list), np.array(y_pred_list)
