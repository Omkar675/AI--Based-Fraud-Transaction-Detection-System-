import joblib
import os
import json

models_dir = 'ml_backend/models'
results = {}

for f in os.listdir(models_dir):
    if f.endswith('_feature_names.pkl'):
        try:
            names = joblib.load(os.path.join(models_dir, f))
            results[f] = list(names) if hasattr(names, '__iter__') else str(names)
        except Exception as e:
            results[f] = f"Error: {str(e)}"

with open('feature_audit.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Feature audit complete. Check feature_audit.json")
