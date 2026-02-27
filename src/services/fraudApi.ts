export type TransactionType = "bank_transfer" | "credit_card" | "upi" | "bitcoin";

export interface PredictionResult {
    prediction: "FRAUD" | "LEGITIMATE";
    fraud_probability: number;
    risk_level: string;
    model_accuracy: number | string;
    transaction_type: string;
}

export interface PredictionResponse {
    success: boolean;
    result?: PredictionResult;
    error?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export async function predictFraud(
    transactionData: Record<string, any>,
    transactionType: TransactionType,
    modelAlgorithm: string = "xgboost"
): Promise<PredictionResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/predict`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                transaction_data: transactionData,
                transaction_type: transactionType,
                model_algorithm: modelAlgorithm,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to analyze transaction");
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error("Fraud API Error:", error);
        return {
            success: false,
            error: error.message || "Network error. Is the backend running?",
        };
    }
}
