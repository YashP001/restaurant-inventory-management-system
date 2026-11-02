import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Verify GET /health returns 200 with service metadata."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "forecasting-service"
    assert "timestamp" in data


def test_predict_demand_endpoint_success(sample_sales_history):
    """Verify POST /api/v1/predict/demand returns 7 days of predictions with uncertainty bounds."""
    payload = {
        "sales_history": [r.model_dump(mode="json") for r in sample_sales_history],
        "forecast_horizon_days": 7
    }
    response = client.post("/api/v1/predict/demand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["forecast_horizon_days"] == 7
    assert data["total_forecasts"] == 105  # 15 items * 7 days
    assert data["model_name"] in ["RandomForestRegressor", "SeasonalNaive_7D"]
    assert "uncertainty_method" in data

    forecasts = data["forecasts"]
    assert len(forecasts) == 105
    for item in forecasts:
        assert item["predicted_quantity"] >= 0.0
        assert item["confidence_lower_bound"] >= 0.0
        assert item["confidence_upper_bound"] >= item["confidence_lower_bound"]
        assert item["confidence_upper_bound"] >= item["predicted_quantity"]


def test_evaluate_endpoint_success(sample_sales_history):
    """Verify POST /api/v1/evaluate performs chronological train/validation comparison."""
    payload = {
        "sales_history": [r.model_dump(mode="json") for r in sample_sales_history],
        "train_days": 70,
        "val_days": 14
    }
    response = client.post("/api/v1/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "baseline_metrics" in data
    assert "rf_metrics" in data
    assert data["baseline_metrics"]["total_validation_observations"] == 210
    assert data["rf_metrics"]["total_validation_observations"] == 210
    assert data["selected_model"] in ["RandomForestRegressor", "SeasonalNaive_7D"]
    assert len(data["selection_rationale"]) > 10


def test_invalid_sales_history_empty():
    """Verify empty sales_history returns 422."""
    payload = {
        "sales_history": [],
        "forecast_horizon_days": 7
    }
    response = client.post("/api/v1/predict/demand", json=payload)
    assert response.status_code == 422


def test_negative_quantity_validation():
    """Verify negative quantity returns 422 validation error."""
    payload = {
        "sales_history": [
            {
                "date": "2026-08-05",
                "menu_item_id": 1,
                "quantity_sold": -5.0,
                "order_status": "COMPLETED"
            }
        ],
        "forecast_horizon_days": 7
    }
    response = client.post("/api/v1/predict/demand", json=payload)
    assert response.status_code == 422


def test_insufficient_history_rejection():
    """Verify history with fewer than 14 days returns 400."""
    records = [
        {
            "date": str(date(2026, 8, 1) + timedelta(days=i)),
            "menu_item_id": 1,
            "quantity_sold": 5.0,
            "order_status": "COMPLETED"
        }
        for i in range(5)  # only 5 days
    ]
    payload = {
        "sales_history": records,
        "forecast_horizon_days": 7
    }
    response = client.post("/api/v1/predict/demand", json=payload)
    assert response.status_code == 400
    assert "14 days" in response.json()["detail"]
