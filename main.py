"""
FastAPI Backend for Universal Fraud Detection System
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
from pipeline import UniversalFraudDetectionPipeline
import traceback
import os

# Initialize FastAPI
app = FastAPI(
    title="Universal Fraud Detection API",
    description="AI-powered fraud detection across 4 transaction types",
    version="1.0.0"
)

# ✅ CORS — allows your Lovable frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "https://*.lovable.app",
        "https://*.lovableproject.com",
        "*"  # Remove this in production, keep only your exact Lovable URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize pipeline
pipeline = UniversalFraudDetectionPipeline(model_dir='models/')

@app.on_event("startup")
async def startup_event():
    success = pipeline.load_all_models()
    if not success:
        print("⚠️ Warning: Some models failed to load")


# ── Request / Response Models ──────────────────────────────────────────────────

class TransactionRequest(BaseModel):
    transaction_data: Dict[str, Any]
    transaction_type: Optional[str] = None  # auto-detected if not provided

class PredictionResponse(BaseModel):
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "Universal Fraud Detection API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    try:
        info = pipeline.get_system_info()
        return {
            "status": "healthy",
            "models_loaded": info['loaded'],
            "available_models": info['available_models'],
            "total_models": info['total_models']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unhealthy: {str(e)}")


@app.get("/models")
async def get_models():
    try:
        info = pipeline.get_system_info()
        model_details = {}
        for model_type in info['available_models']:
            summary = pipeline.summaries[model_type]
            model_details[model_type] = {
                "name": model_type.replace('_', ' ').title(),
                "accuracy": round(summary['best_roc_auc'] * 100, 2),
                "samples_trained": summary.get('total_samples', 'N/A')
            }
        return {"success": True, "total_models": info['total_models'], "models": model_details}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/transaction-types")
async def get_transaction_types():
    return {
        "success": True,
        "transaction_types": [
            {"id": "credit_card",   "name": "Credit Card",   "icon": "💳"},
            {"id": "bank_transfer", "name": "Bank Transfer", "icon": "🏦"},
            {"id": "upi",           "name": "UPI Payment",   "icon": "📱"},
            {"id": "bitcoin",       "name": "Bitcoin",       "icon": "₿"},
        ]
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict_fraud(request: TransactionRequest):
    """
    Predict whether a transaction is fraudulent.

    Example — Bank Transfer:
    {
        "transaction_data": { "amount": 9000.0, "type": "TRANSFER", "oldbalanceOrg": 9000.0, "newbalanceOrig": 0.0 },
        "transaction_type": "bank_transfer"
    }

    Example — Credit Card:
    {
        "transaction_data": { "V1": -1.35, "V2": -0.07, "Amount": 149.62 },
        "transaction_type": "credit_card"
    }

    Example — UPI:
    {
        "transaction_data": { "amount": 5000.0, "upi_id": "user@bank" },
        "transaction_type": "upi"
    }

    Example — Bitcoin:
    {
        "transaction_data": { "feature_1": 0.5, "feature_2": 1.2 },
        "transaction_type": "bitcoin"
    }
    """
    try:
        if not request.transaction_data:
            raise HTTPException(status_code=400, detail="transaction_data is required")

        result = pipeline.predict(request.transaction_data, request.transaction_type)
        return PredictionResponse(success=True, result=result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Prediction error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/batch")
async def predict_batch(transactions: list[TransactionRequest]):
    """Run fraud detection on multiple transactions at once."""
    try:
        results = []
        for i, txn in enumerate(transactions):
            try:
                result = pipeline.predict(txn.transaction_data, txn.transaction_type)
                results.append({"index": i, "success": True, "result": result})
            except Exception as e:
                results.append({"index": i, "success": False, "error": str(e)})

        successful  = sum(1 for r in results if r.get('success'))
        fraud_count = sum(1 for r in results if r.get('success') and r['result']['prediction'] == 'FRAUD')

        return {
            "success": True,
            "summary": {
                "total": len(results),
                "successful": successful,
                "failed": len(results) - successful,
                "fraud_detected": fraud_count
            },
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"\n🚀 Starting Fraud Detection API on http://0.0.0.0:{port}")
    print(f"📖 Docs: http://localhost:{port}/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=port)