import os
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
model_bundles = {}

TRANSACTION_TYPES = ["bank_transfer", "bitcoin", "credit_card", "upi"]
ALGORITHMS = ["xgboost", "random_forest", "logistic_regression", "autoencoder"]

def get_model_bundle(txn_type):
    if txn_type in model_bundles:
        return model_bundles[txn_type]
    
    if not os.path.exists(MODELS_DIR):
        print(f"Models directory not found at {MODELS_DIR}.")
        return None
        
    print(f"Lazy loading model bundle for: {txn_type}")
    bundle = {"models": {}, "scaler": None, "feature_names": []}
    
    scaler_path = os.path.join(MODELS_DIR, f"{txn_type}_scaler.pkl")
    if os.path.exists(scaler_path):
        bundle["scaler"] = joblib.load(scaler_path)
        
    fn_path = os.path.join(MODELS_DIR, f"{txn_type}_feature_names.pkl")
    if os.path.exists(fn_path):
        fn_data = joblib.load(fn_path)
        bundle["feature_names"] = list(fn_data) if hasattr(fn_data, "__iter__") else []
        
    model_bundles[txn_type] = bundle
    return bundle

def get_algorithm_model(txn_type, algo):
    bundle = get_model_bundle(txn_type)
    if not bundle: return None
    
    if algo in bundle["models"]:
        return bundle["models"][algo]
        
    model_filename = f"{txn_type}_{algo}.pkl"
    model_path = os.path.join(MODELS_DIR, model_filename)
    
    if os.path.exists(model_path):
        print(f"Loading specific model: {model_filename}")
        try:
            loaded_model = joblib.load(model_path)
            model = loaded_model["model"] if isinstance(loaded_model, dict) and "model" in loaded_model else loaded_model
            bundle["models"][algo] = model
            return model
        except Exception as e:
            print(f"Error loading {algo} for {txn_type}: {e}")
    return None

class TransactionData(BaseModel):
    transaction_data: dict
    transaction_type: str
    model_algorithm: str = "xgboost"

@app.post("/predict")
async def predict(data: TransactionData):
    try:
        txn_type = data.transaction_type
        algo = data.model_algorithm.lower()
        
        bundle = get_model_bundle(txn_type)
        if not bundle:
            return {"success": True, "result": {"prediction": "LEGITIMATE", "fraud_probability": 5.0, "risk_level": "low", "model_accuracy": "Fallback", "transaction_type": txn_type}}

        model = get_algorithm_model(txn_type, algo)
        if not model:
            for existing_algo in ALGORITHMS:
                model = get_algorithm_model(txn_type, existing_algo)
                if model:
                    algo = existing_algo
                    break
            if not model:
                return {"success": True, "result": {"prediction": "LEGITIMATE", "fraud_probability": 5.0, "risk_level": "low", "model_accuracy": "Fallback (No models)", "transaction_type": txn_type}}
        
        raw_data = data.transaction_data
        features_list = []
        feature_names = bundle.get("feature_names", [])

        if feature_names:
            for fn in feature_names:
                try:
                    features_list.append(float(raw_data.get(fn, 0.0)))
                except:
                    features_list.append(0.0)
        else:
            features_list = [float(v) for v in raw_data.values()]
            
        features_array = [features_list]
        
        scaler = bundle.get("scaler")
        if scaler and hasattr(scaler, "transform"):
            features_array = scaler.transform(features_array)
            
        prediction_val = model.predict(features_array)[0]
        prediction = str(prediction_val).upper() if isinstance(prediction_val, str) else ("FRAUD" if prediction_val == 1 else "LEGITIMATE")
        
        prob_fraud = 10.0
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(features_array)[0]
            prob_fraud = float(probs[1] if len(probs) > 1 else probs[0]) * 100
        else:
            prob_fraud = 90.0 if prediction == "FRAUD" else 10.0

        amount_val = 0.0
        for amt_key in ['amount', 'Amount', 'amount (INR)']:
            if amt_key in raw_data:
                try:
                    amount_val = float(raw_data[amt_key])
                    break
                except: continue
        
        if amount_val > 3000 and prediction == "LEGITIMATE":
            prob_fraud = 75.0 if amount_val > 10000 else 55.0
            
        risk_level = "high" if prob_fraud > 70 else "medium" if prob_fraud > 30 else "low"
        
        return {
            "success": True,
            "result": {
                "prediction": "FRAUD" if (prob_fraud > 50 or risk_level == "high") else "LEGITIMATE",
                "fraud_probability": round(float(prob_fraud), 2),
                "risk_level": risk_level,
                "model_accuracy": f"Loaded {algo}",
                "transaction_type": txn_type
            }
        }
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
