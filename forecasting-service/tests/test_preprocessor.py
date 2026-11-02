from datetime import date, timedelta
import pytest
import pandas as pd
import numpy as np

from app.schemas import DailySalesInput
from app.services.preprocessor import DataPreprocessor


def test_exclusion_of_non_completed_orders():
    """Verify cancelled or preparing orders are strictly excluded."""
    records = [
        DailySalesInput(date=date(2026, 8, 5), menu_item_id=1, quantity_sold=5.0, order_status="COMPLETED"),
        DailySalesInput(date=date(2026, 8, 5), menu_item_id=2, quantity_sold=4.0, order_status="CANCELLED"),
        DailySalesInput(date=date(2026, 8, 5), menu_item_id=3, quantity_sold=3.0, order_status="PREPARING"),
        DailySalesInput(date=date(2026, 8, 5), menu_item_id=4, quantity_sold=2.0, order_status="CONFIRMED"),
    ]
    filtered = DataPreprocessor.filter_completed_sales(records)
    assert len(filtered) == 1
    assert filtered[0].menu_item_id == 1
    assert filtered[0].quantity_sold == 5.0


def test_aggregation_of_duplicate_daily_sales():
    """Verify multiple order lines for the same menu item and date are summed."""
    records = [
        DailySalesInput(date=date(2026, 8, 5), menu_item_id=1, quantity_sold=2.0, order_status="COMPLETED"),
        DailySalesInput(date=date(2026, 8, 5), menu_item_id=1, quantity_sold=3.5, order_status="COMPLETED"),
    ]
    df = DataPreprocessor.build_daily_item_matrix(records)
    item_rows = df[df["menu_item_id"] == 1]
    assert len(item_rows) == 1
    assert item_rows.iloc[0]["quantity_sold"] == 5.5


def test_complete_calendar_grid_and_zero_imputation():
    """Verify complete Cartesian product and zero-filling of missing combinations."""
    # Item 1 has sales on day 1 and 3; Item 2 only on day 2
    records = [
        DailySalesInput(date=date(2026, 8, 1), menu_item_id=1, quantity_sold=4.0, order_status="COMPLETED"),
        DailySalesInput(date=date(2026, 8, 2), menu_item_id=2, quantity_sold=6.0, order_status="COMPLETED"),
        DailySalesInput(date=date(2026, 8, 3), menu_item_id=1, quantity_sold=5.0, order_status="COMPLETED"),
    ]
    df = DataPreprocessor.build_daily_item_matrix(records)

    # 3 calendar days (Aug 1, 2, 3) x 2 items (1, 2) = 6 rows
    assert len(df) == 6
    assert set(df["menu_item_id"]) == {1, 2}
    assert set(df["date"]) == {date(2026, 8, 1), date(2026, 8, 2), date(2026, 8, 3)}

    # Item 1 on Aug 2 should be 0.0
    item1_aug2 = df[(df["menu_item_id"] == 1) & (df["date"] == date(2026, 8, 2))]
    assert len(item1_aug2) == 1
    assert item1_aug2.iloc[0]["quantity_sold"] == 0.0

    # Item 2 on Aug 1 should be 0.0
    item2_aug1 = df[(df["menu_item_id"] == 2) & (df["date"] == date(2026, 8, 1))]
    assert len(item2_aug1) == 1
    assert item2_aug1.iloc[0]["quantity_sold"] == 0.0


def test_lag_and_rolling_features_no_lookahead_leakage():
    """Verify lag and rolling features never include target day's actual sales."""
    # Build 10 days of known sales for item 1: quantities 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    records = [
        DailySalesInput(
            date=date(2026, 8, 1) + timedelta(days=i),
            menu_item_id=1,
            quantity_sold=float(i + 1),
            order_status="COMPLETED"
        )
        for i in range(10)
    ]
    df = DataPreprocessor.build_daily_item_matrix(records)
    feat_df = DataPreprocessor.engineer_features(df)

    # On day index 7 (Aug 8, quantity=8):
    # lag_1 should be quantity from day index 6 (Aug 7) = 7.0
    # lag_7 should be quantity from day index 0 (Aug 1) = 1.0
    # rolling_mean_7 should be mean of quantities from day indices 0..6 (1..7) = 28/7 = 4.0
    row_day8 = feat_df[feat_df["date"] == date(2026, 8, 8)].iloc[0]
    assert row_day8["quantity_sold"] == 8.0
    assert row_day8["lag_1"] == 7.0
    assert row_day8["lag_7"] == 1.0
    assert row_day8["rolling_mean_7"] == 4.0

    # Ensure changing day 8 quantity does not alter lag_1, lag_7, or rolling_mean_7 on day 8
    records_mod = [
        DailySalesInput(
            date=date(2026, 8, 1) + timedelta(days=i),
            menu_item_id=1,
            quantity_sold=999.0 if i == 7 else float(i + 1),
            order_status="COMPLETED"
        )
        for i in range(10)
    ]
    df_mod = DataPreprocessor.build_daily_item_matrix(records_mod)
    feat_df_mod = DataPreprocessor.engineer_features(df_mod)
    row_day8_mod = feat_df_mod[feat_df_mod["date"] == date(2026, 8, 8)].iloc[0]

    assert row_day8_mod["lag_1"] == 7.0
    assert row_day8_mod["lag_7"] == 1.0
    assert row_day8_mod["rolling_mean_7"] == 4.0
