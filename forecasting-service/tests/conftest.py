import pytest
from datetime import date, timedelta
from typing import List
from app.schemas import DailySalesInput


@pytest.fixture
def sample_sales_history() -> List[DailySalesInput]:
    """
    Generates a realistic 88-day historical sales dataset for 15 menu items
    spanning 2026-08-05 to 2026-10-31, including:
    - Multiple duplicate sales lines on the same day
    - Zero-sales days that need zero-imputation
    - CANCELLED and PREPARING orders that must be excluded
    """
    records: List[DailySalesInput] = []
    start_date = date(2026, 8, 5)
    num_days = 88
    num_items = 15

    for d in range(num_days):
        current_date = start_date + timedelta(days=d)
        dow = current_date.weekday()
        # Weekend multiplier
        multiplier = 1.5 if dow in [5, 6] else 1.0

        for item_id in range(1, num_items + 1):
            # Simulate intermittent demand: item 15 sells less frequently
            if item_id == 15 and d % 3 != 0:
                continue

            base_qty = (item_id % 5 + 1) * multiplier
            records.append(DailySalesInput(
                date=current_date,
                menu_item_id=item_id,
                quantity_sold=float(base_qty),
                order_status="COMPLETED"
            ))

            # Add a duplicate line on day 10 for item 1 to test aggregation
            if d == 10 and item_id == 1:
                records.append(DailySalesInput(
                    date=current_date,
                    menu_item_id=item_id,
                    quantity_sold=3.0,
                    order_status="COMPLETED"
                ))

            # Add cancelled orders that should be excluded
            if d % 7 == 0 and item_id == 2:
                records.append(DailySalesInput(
                    date=current_date,
                    menu_item_id=item_id,
                    quantity_sold=10.0,
                    order_status="CANCELLED"
                ))

    return records
