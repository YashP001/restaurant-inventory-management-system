import logging
from datetime import date, timedelta
from typing import List, Optional, Tuple, Set
import pandas as pd
import numpy as np

from app.schemas import DailySalesInput

logger = logging.getLogger(__name__)


class DataPreprocessor:
    """
    Handles data ingestion, filtering, zero-imputation over full calendar grids,
    and lookahead-free feature engineering for restaurant demand forecasting.
    """

    @staticmethod
    def filter_completed_sales(records: List[DailySalesInput]) -> List[DailySalesInput]:
        """
        Filter out non-completed orders (e.g., CANCELLED, PENDING, PREPARING).
        Only strictly completed sales represent true realized demand.
        """
        completed = [
            r for r in records
            if r.order_status is None or r.order_status.strip().upper() == "COMPLETED"
        ]
        logger.info("Filtered %d records to %d completed records", len(records), len(completed))
        return completed

    @staticmethod
    def build_daily_item_matrix(
        records: List[DailySalesInput],
        explicit_menu_item_ids: Optional[List[int]] = None
    ) -> pd.DataFrame:
        """
        Constructs a complete calendar grid (Cartesian product of all calendar dates
        and all distinct menu items). Aggregates duplicate lines and fills missing
        combinations with zero.

        Returns DataFrame columns:
        ['date', 'menu_item_id', 'quantity_sold', 'day_of_week', 'is_weekend']
        """
        if not records:
            raise ValueError("No sales records provided for preprocessing.")

        # 1. Filter completed records
        completed_records = DataPreprocessor.filter_completed_sales(records)
        if not completed_records:
            raise ValueError("No completed sales records found after filtering.")

        # 2. Extract into DataFrame
        raw_df = pd.DataFrame([
            {
                "date": pd.to_datetime(r.date).date(),
                "menu_item_id": int(r.menu_item_id),
                "quantity_sold": float(r.quantity_sold)
            }
            for r in completed_records
        ])

        # 3. Aggregate multiple order lines on the same date and menu_item_id
        agg_df = raw_df.groupby(["date", "menu_item_id"], as_index=False)["quantity_sold"].sum()

        # 4. Determine complete date range
        min_date = agg_df["date"].min()
        max_date = agg_df["date"].max()
        all_dates = [min_date + timedelta(days=i) for i in range((max_date - min_date).days + 1)]

        # 5. Determine menu item IDs
        if explicit_menu_item_ids:
            all_item_ids = sorted(list(set(explicit_menu_item_ids)))
        else:
            all_item_ids = sorted(agg_df["menu_item_id"].unique().tolist())

        # 6. Build full Cartesian grid
        grid_index = pd.MultiIndex.from_product(
            [all_dates, all_item_ids],
            names=["date", "menu_item_id"]
        )
        grid_df = pd.DataFrame(index=grid_index).reset_index()

        # 7. Merge aggregated sales with grid and zero-fill missing sales
        merged_df = pd.merge(grid_df, agg_df, on=["date", "menu_item_id"], how="left")
        merged_df["quantity_sold"] = merged_df["quantity_sold"].fillna(0.0)

        # 8. Calendar features
        merged_df["date_dt"] = pd.to_datetime(merged_df["date"])
        merged_df["day_of_week"] = merged_df["date_dt"].dt.day_of_week  # 0=Monday, 6=Sunday
        merged_df["is_weekend"] = merged_df["day_of_week"].isin([5, 6]).astype(int)
        merged_df = merged_df.drop(columns=["date_dt"])

        merged_df = merged_df.sort_values(by=["menu_item_id", "date"]).reset_index(drop=True)

        logger.info(
            "Constructed complete grid: %d dates x %d items = %d observations.",
            len(all_dates), len(all_item_ids), len(merged_df)
        )
        return merged_df

    @staticmethod
    def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates lag and rolling features strictly shifted to eliminate lookahead leakage.

        For each menu_item_id:
        - lag_1: quantity sold on t-1
        - lag_7: quantity sold on t-7
        - rolling_mean_7: 7-day average of quantity sold from t-7 to t-1
          (shifted by 1 so target day t sales are never included)

        Rows with NaNs in feature columns (the initial warm-up period) are flagged or dropped
        during supervised training.
        """
        df_feat = df.sort_values(by=["menu_item_id", "date"]).copy()

        # Shifted lag features per item
        df_feat["lag_1"] = df_feat.groupby("menu_item_id")["quantity_sold"].shift(1)
        df_feat["lag_7"] = df_feat.groupby("menu_item_id")["quantity_sold"].shift(7)

        # rolling_mean_7: shift(1) ensures the rolling window encompasses t-7 to t-1
        df_feat["rolling_mean_7"] = (
            df_feat.groupby("menu_item_id")["quantity_sold"]
            .shift(1)
            .rolling(window=7, min_periods=7)
            .mean()
        )

        return df_feat
