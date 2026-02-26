import joblib
for name in ['credit_card_xgboost.pkl', 'credit_card_scaler.pkl', 'credit_card_feature_names.pkl']:
    try:
        m = joblib.load(f'models/{name}')
        print(f"--- {name} ---")
        print(type(m))
        if isinstance(m, dict):
            print(m.keys())
    except Exception as e:
        print(f"Error {name}: {e}")
