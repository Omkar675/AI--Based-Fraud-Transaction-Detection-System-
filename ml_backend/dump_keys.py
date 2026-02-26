import joblib
import json

out = {}
for name in ['credit_card_xgboost.pkl', 'credit_card_scaler.pkl', 'credit_card_feature_names.pkl']:
    try:
        m = joblib.load(f'models/{name}')
        
        t = str(type(m))
        if isinstance(m, dict):
            keys = list(m.keys())
            out[name] = {"type": t, "keys": keys}
        else:
            out[name] = {"type": t}
    except Exception as e:
        out[name] = {"error": str(e)}

with open('model_info.json', 'w') as f:
    json.dump(out, f, indent=2)
