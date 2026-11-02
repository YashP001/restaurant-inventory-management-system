import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
import numpy as np

from app.schemas import (
    PredictDemandRequest,
    PredictDemandResponse,
    EvaluateRequest,
    EvaluateResponse
)
from app.services.preprocessor import DataPreprocessor
from app.services.evaluator import ModelEvaluator
from app.services.predictor import DemandPredictor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Forecasting"])


@router.post(
    "/predict/demand",
    response_model=PredictDemandResponse,
    summary="Generate 7-day restaurant menu demand forecasts",
    description="Accepts historical sales records, constructs a complete zero-imputed calendar grid, selects the best performing model, and returns 7-day demand predictions with empirical uncertainty bounds."
)
def predict_demand(request: PredictDemandRequest):
    try:
        if not request.sales_history:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Sales history cannot be empty."
            )

        # 1. Build zero-imputed calendar grid
        daily_grid = DataPreprocessor.build_daily_item_matrix(
            records=request.sales_history,
            explicit_menu_item_ids=request.menu_item_ids
        )

        # 2. Check sufficient observations
        num_dates = daily_grid["date"].nunique()
        if num_dates < 14:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"At least 14 days of historical data are required for weekly lag forecasting. Found {num_dates} days."
            )

        # 3. Generate forecasts
        model_name, uncertainty_method, forecasts = DemandPredictor.generate_demand_forecast(
            preprocessed_grid=daily_grid,
            horizon_days=request.forecast_horizon_days
        )

        return PredictDemandResponse(
            status="success",
            model_name=model_name,
            model_version="1.0.0",
            forecast_horizon_days=request.forecast_horizon_days,
            total_forecasts=len(forecasts),
            uncertainty_method=uncertainty_method,
            generated_at=datetime.now(timezone.utc),
            forecasts=forecasts
        )

    except HTTPException:
        raise
    except ValueError as ve:
        logger.warning("Validation error in predict_demand: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        logger.error("Unexpected error in predict_demand: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating demand forecasts. Please verify historical input data."
        )


@router.post(
    "/evaluate",
    response_model=EvaluateResponse,
    summary="Chronologically evaluate forecasting models",
    description="Splits historical observations chronologically into train and validation sets, evaluates Seasonal Naive and Random Forest on MAE, RMSE, and WMAPE, and applies selection rule."
)
def evaluate_models(request: EvaluateRequest):
    try:
        if not request.sales_history:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Sales history cannot be empty."
            )

        # 1. Build zero-imputed calendar grid
        daily_grid = DataPreprocessor.build_daily_item_matrix(
            records=request.sales_history,
            explicit_menu_item_ids=request.menu_item_ids
        )

        # 2. Chronological evaluation
        (
            base_metrics,
            rf_metrics,
            selected_model,
            rationale,
            split_summary,
            _,
            _
        ) = ModelEvaluator.evaluate_chronological(
            full_grid=daily_grid,
            train_days=request.train_days,
            val_days=request.val_days
        )

        return EvaluateResponse(
            status="success",
            split_summary=split_summary,
            baseline_metrics=base_metrics,
            rf_metrics=rf_metrics,
            selected_model=selected_model,
            selection_rationale=rationale,
            evaluated_at=datetime.now(timezone.utc)
        )

    except HTTPException:
        raise
    except ValueError as ve:
        logger.warning("Validation error in evaluate_models: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        logger.error("Unexpected error in evaluate_models: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while evaluating demand models. Please verify historical input data."
        )
