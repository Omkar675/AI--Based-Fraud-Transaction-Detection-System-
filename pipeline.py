#ML Pipeline for Universal Fraud Detection System
#Loads and manages all 4 fraud detection models


import pickle
from pydoc import Doc
import numpy as np
import warnings
warnings.filterwarnings('ignore')


class UniversalFraudDetectionPipeline:
    """Main pipeline that routes transactions to appropriate models"""
    
    def __init__(self, model_dir='models/'):
        self.model_dir = model_dir
        self.models = {}
        self.scalers = {}
        self.feature_names = {}
        self.summaries = {}
        self.loaded = False
    
    def load_all_models(self):
        """Load all 4 models and their preprocessing objects"""
        print("=" * 80)
        print("Loading Universal Fraud Detection System...")
        print("=" * 80)
        
        model_types = ['credit_card', 'bank_transfer', 'upi', 'bitcoin']
        
        for model_type in model_types:
            try:
                print(f"\nLoading {model_type}...")
                
                # Load model
                # Load model
                with open(f'{self.model_dir}{model_type}_xgboost.pkl', 'rb') as f:
                    loaded_obj = pickle.load(f)

# Fix: extract model if packaged as dict
                if isinstance(loaded_obj, dict) and "model" in loaded_obj:
                    self.models[model_type] = loaded_obj["model"]
                else:
                    self.models[model_type] = loaded_obj

                
                # Load scaler
                with open(f'{self.model_dir}{model_type}_scaler.pkl', 'rb') as f:
                    self.scalers[model_type] = pickle.load(f)
                
                # Load feature names
                with open(f'{self.model_dir}{model_type}_feature_names.pkl', 'rb') as f:
                    self.feature_names[model_type] = pickle.load(f)
                
                # Load summary
                with open(f'{self.model_dir}{model_type}_model_summary.pkl', 'rb') as f:
                    self.summaries[model_type] = pickle.load(f)
                
                print(f"  ✓ {model_type} loaded successfully")
                
            except Exception as e:
                print(f"  ✗ Error loading {model_type}: {str(e)}")
                continue
        
        self.loaded = True
        print("\n" + "=" * 80)
        print(f"✅ Successfully loaded {len(self.models)} models!")
        print("=" * 80)
        return len(self.models) > 0
    
    def identify_transaction_type(self, transaction_data):
        """Auto-detect transaction type from features"""
        
        # Credit card - has V1, V2, V3 features
        if any(key.startswith('V') and key[1:].isdigit() for key in transaction_data.keys()):
            return 'credit_card'
        
        # Bank transfer - has 'type' field with TRANSFER/CASH_OUT
        if 'type' in transaction_data:
            tx_type = str(transaction_data['type']).upper()
            if tx_type in ['TRANSFER', 'CASH_OUT', 'CASH-OUT']:
                return 'bank_transfer'
        
        # Bitcoin - has feature_1, feature_2, etc.
        if any(key.startswith('feature_') for key in transaction_data.keys()):
            return 'bitcoin'
        
        # UPI - has upi_id or payment_method=UPI
        if 'upi_id' in transaction_data or 'vpa' in transaction_data:
            return 'upi'
        
        if 'payment_method' in transaction_data:
            if str(transaction_data['payment_method']).upper() == 'UPI':
                return 'upi'
        
        # Default to bank_transfer if has amount
        return 'bank_transfer'
    
    def preprocess(self, transaction_data, transaction_type):
        """Prepare transaction data for prediction"""
        
        expected_features = self.feature_names[transaction_type]
        
        # Create feature vector
        features = []
        for feature in expected_features:
            features.append(transaction_data.get(feature, 0))
        
        # Convert to numpy array
        X = np.array(features).reshape(1, -1)
        
        # Scale
        X_scaled = self.scalers[transaction_type].transform(X)
        
        return X_scaled
    
    def predict(self, transaction_data, transaction_type=None):
        """Main prediction function"""
        
        if not self.loaded:
            raise RuntimeError("Models not loaded! Call load_all_models() first.")
        
        # Auto-detect type if not provided
        if transaction_type is None:
            transaction_type = self.identify_transaction_type(transaction_data)
        
        # Validate transaction type
        if transaction_type not in self.models:
            raise ValueError(f"Unknown transaction type: {transaction_type}")
        
        # Preprocess
        X_scaled = self.preprocess(transaction_data, transaction_type)
        
        # Predict
        model = self.models[transaction_type]
        fraud_prob = model.predict_proba(X_scaled)[0][1]
        prediction = int(fraud_prob > 0.5)
        
        # Determine risk level
        if fraud_prob >= 0.8:
            risk_level = "high"
        elif fraud_prob >= 0.6:
            risk_level = "high"
        elif fraud_prob >= 0.4:
            risk_level = "medium"
        elif fraud_prob >= 0.2:
            risk_level = "low"
        else:
            risk_level = "low"

        # ** HEURISTIC SAFETY VALVE **
        amount = float(transaction_data.get('amount', transaction_data.get('Amount', 0)))
        if amount > 10000 and fraud_prob < 0.6:
            print(f"Safety Valve: ${amount} detected. Escalating risk.")
            risk_level = "high"
            fraud_prob = max(fraud_prob, 0.75) # Ensure score bar is at least 75%
        
        # Build result
        roc = self.summaries[transaction_type].get('best_roc_auc', 0)

        result = {
            'transaction_type': transaction_type,
            'prediction': 'FRAUD' if (fraud_prob > 0.5 or risk_level == "high") else 'LEGITIMATE',
            'fraud_probability': float(round(fraud_prob * 100, 2)),
            'risk_level': risk_level,
            'model_accuracy': float(round(roc * 100, 2)) if roc else "N/A"
        }

        return result
    
    def get_system_info(self):
        """Get information about loaded models"""
        return {
            'loaded': self.loaded,
            'available_models': list(self.models.keys()),
            'total_models': len(self.models)
        }


# Test the pipeline
if __name__ == "__main__":
    pipeline = UniversalFraudDetectionPipeline()
    pipeline.load_all_models()
    
    # Test with sample
    sample = {'amount': 100.0}
    result = pipeline.predict(sample, 'bank_transfer')
    print(f"\nTest Result: {result}")