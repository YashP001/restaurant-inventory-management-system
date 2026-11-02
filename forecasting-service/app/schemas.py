from datetime import date as dt_date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class DailySalesInput(BaseModel):
    """
    Individual sales observation from order items / orders.
    Can accept order-level item sales or pre-aggregated daily sales.
    """
    date: dt_date = Field(..., description="Date of the sales record (YYYY-MM-DD)")
    menu_item_id: int = Field(..., ge=1, description="Menu item ID (must be positive integer)")
    quantity_sold: float = Field(..., ge=0.0, description="Quantity sold (must be non-negative)")
    order_status: Optional[str] = Field("COMPLETED", description="Status of order (e.g. COMPLETED, CANCELLED)")

    @field_validator("quantity_sold")
    @classmethod
    def validate_non_negative_quantity(cls, v: float) -> float:
        if v < 0:
            raise ValueError("quantity_sold cannot be negative")
        return v


class PredictDemandRequest(BaseModel):
    """
    Request payload for 7-day demand forecasting.
    """
    sales_history: List[DailySalesInput] = Field(..., min_length=1, description="List of historical sales records")
    forecast_horizon_days: int = Field(7, ge=1, le=30, description="Forecast horizon in days (default: 7)")
    menu_item_ids: Optional[List[int]] = Field(None, description="Optional explicit list of menu item IDs to forecast")


class DailyItemForecast(BaseModel):
    """
    Predicted demand for a single menu item on a single date.
    """
    date: dt_date = Field(..., description="Forecast date (YYYY-MM-DD)")
    menu_item_id: int = Field(..., description="Menu item ID")
    predicted_quantity: float = Field(..., ge=0.0, description="Predicted sales quantity")
    confidence_lower_bound: float = Field(..., ge=0.0, description="Empirical lower uncertainty bound (>= 0)")
    confidence_upper_bound: float = Field(..., ge=0.0, description="Empirical upper uncertainty bound")


class PredictDemandResponse(BaseModel):
    """
    Response payload for demand forecasting.
    """
    status: str = "success"
    model_name: str = Field(..., description="Selected model name (e.g. 'RandomForestRegressor' or 'SeasonalNaive')")
    model_version: str = Field("1.0.0", description="Model version")
    forecast_horizon_days: int
    total_forecasts: int
    uncertainty_method: str = Field(
        ...,
        description="Method used for uncertainty bounds (e.g. 'empirical_validation_residuals')"
    )
    generated_at: datetime
    forecasts: List[DailyItemForecast]


class ModelMetrics(BaseModel):
    """
    Evaluation metrics for a model.
    """
    mae: float = Field(..., description="Mean Absolute Error")
    rmse: float = Field(..., description="Root Mean Squared Error")
    wmape: float = Field(..., description="Weighted Mean Absolute Percentage Error (%)")
    total_validation_observations: int


class EvaluateRequest(BaseModel):
    """
    Request payload for chronological model evaluation.
    """
    sales_history: List[DailySalesInput] = Field(..., min_length=1, description="Historical sales records")
    train_days: int = Field(75, ge=14, description="Number of chronological days for training")
    val_days: int = Field(14, ge=7, description="Number of chronological days for validation")
    menu_item_ids: Optional[List[int]] = Field(None, description="Optional explicit menu item IDs")


class EvaluateResponse(BaseModel):
    """
    Response payload comparing baseline and random forest models.
    """
    status: str = "success"
    split_summary: dict = Field(..., description="Train/validation split details")
    baseline_metrics: ModelMetrics
    rf_metrics: ModelMetrics
    selected_model: str = Field(..., description="Chosen model according to selection rule")
    selection_rationale: str = Field(..., description="Detailed explanation of the selection decision")
    evaluated_at: datetime
