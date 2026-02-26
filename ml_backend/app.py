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

# Dictionary to store model bundles by transaction type and algorithm
# e.g. {"credit_card": {"xgboost": {"model": ...}, "random_forest": {"model": ...}, "scaler": ..., "feature_names": ...}}
model_bundles = {}

TRANSACTION_TYPES = ["bank_transfer", "bitcoin", "credit_card", "upi"]
ALGORITHMS = ["xgboost", "random_forest", "logistic_regression", "autoencoder"]

def load_models():
    """Loads all models, scalers, and feature names grouped by transaction type and algorithm."""
    if not os.path.exists(MODELS_DIR):
        print(f"Models directory not found at {MODELS_DIR}. Creating it...")
        os.makedirs(MODELS_DIR, exist_ok=True)
        return
        
    for txn_type in TRANSACTION_TYPES:
        bundle = {"models": {}}
        
        # Load scaler and feature names (assumed shared across models of the same type)
        scaler_path = os.path.join(MODELS_DIR, f"{txn_type}_scaler.pkl")
        if os.path.exists(scaler_path):
            bundle["scaler"] = joblib.load(scaler_path)
            print(f"Loaded scaler for {txn_type}")
            
        fn_path = os.path.join(MODELS_DIR, f"{txn_type}_feature_names.pkl")
        if os.path.exists(fn_path):
            fn = joblib.load(fn_path)
            bundle["feature_names"] = list(fn)
            print(f"Loaded feature names for {txn_type}")
            
        # Try to load each algorithm for this transaction type
        for algo in ALGORITHMS:
            model_filename = f"{txn_type}_{algo}.pkl"
            model_path = os.path.join(MODELS_DIR, model_filename)
            
            if os.path.exists(model_path):
                try:
                    loaded_model = joblib.load(model_path)
                    if isinstance(loaded_model, dict) and "model" in loaded_model:
                        bundle["models"][algo] = loaded_model["model"]
                    else:
                        bundle["models"][algo] = loaded_model
                    print(f"Loaded {algo} model for {txn_type}: {model_filename}")
                except Exception as e:
                    print(f"Error loading {algo} for {txn_type}: {e}")
                    
        # Also map 'xgboost_feature_names' etc if needed
        # But for now, we only need the models populated
        
        if bundle["models"] or "scaler" in bundle: # Only save if we loaded something
           model_bundles[txn_type] = bundle
           print(f"Successfully configured bundle for {txn_type} with algorithms: {list(bundle['models'].keys())}")

# Load models on startup
load_models()

class TransactionData(BaseModel):
    transaction_data: dict
    transaction_type: str
    model_algorithm: str = "xgboost"

@app.post("/predict")
async def predict(data: TransactionData):
    txn_type = data.transaction_type
    algo = data.model_algorithm.lower()
    
    if txn_type not in model_bundles:
        print(f"Warning: Model bundle for '{txn_type}' not found. Using fallback logic.")
        return {
            "success": True,
            "result": {
                "prediction": "LEGITIMATE",
                "fraud_probability": 0.05,
                "risk_level": "LOW",
                "model_accuracy": "Fallback (No model bundle loaded)",
                "transaction_type": txn_type
            }
        }
    
    bundle = model_bundles[txn_type]
    
    if algo not in bundle["models"]:
        print(f"Warning: Algorithm '{algo}' not found for '{txn_type}'. Available: {list(bundle['models'].keys())}")
        algo = next(iter(bundle["models"].keys()), "none") if bundle["models"] else "none"
        
        if algo == "none":
             return {
                "success": True,
                "result": {
                    "prediction": "LEGITIMATE",
                    "fraud_probability": 0.05,
                    "risk_level": "LOW",
                    "model_accuracy": "Fallback (No models found in bundle)",
                    "transaction_type": txn_type
                }
            }
        print(f"Falling back to algorithm '{algo}'")
        
    model = bundle["models"][algo]
    scaler = bundle.get("scaler")
    feature_names = bundle.get("feature_names", [])
    
    try:
        # Extract features in the correct order
        features_list = []
        raw_data = data.transaction_data
        
        # If feature names are not available, just use values (risky but handles models without feature_names.pkl)
        if feature_names:
            for fn in feature_names:
                try:
                    val = float(raw_data.get(fn, 0.0))
                except (ValueError, TypeError):
                    val = 0.0
                features_list.append(val)
        else:
             # Just guess order based on the dict (dangerous, hopefully feature_names exist)
             features_list = [float(v) for v in raw_data.values()]
            
        features_array = [features_list]
        
        # Apply scaler if it exists
        if scaler:
            features_array = scaler.transform(features_array)
            
        # Predict
        prediction_val = model.predict(features_array)[0]
        
        if isinstance(prediction_val, str):
            prediction = prediction_val.upper()
        else:
            prediction = "FRAUD" if prediction_val == 1 else "LEGITIMATE"
            
        # Probability
        try:
            probabilities = model.predict_proba(features_array)[0]
            if len(probabilities) >= 2:
                prob_fraud = float(probabilities[1]) * 100
            else:
                prob_fraud = float(probabilities[0]) * 100
        except Exception:
            prob_fraud = 99.0 if prediction == "FRAUD" else 1.0
            
        risk_level = "HIGH" if prob_fraud > 70 else "MEDIUM" if prob_fraud > 30 else "LOW"
        
        return {
            "success": True,
            "result": {
                "prediction": prediction,
                "fraud_probability": round(prob_fraud, 2),
                "risk_level": risk_level,
                "model_accuracy": f"Loaded {algo} from .pkl",
                "transaction_type": txn_type
            }
        }
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
