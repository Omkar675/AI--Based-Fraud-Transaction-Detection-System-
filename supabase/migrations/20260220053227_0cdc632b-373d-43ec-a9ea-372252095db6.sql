-- Enable realtime for transactions and fraud_analysis tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_analysis;