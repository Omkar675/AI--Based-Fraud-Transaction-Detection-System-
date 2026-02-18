
-- Drop the overly permissive policy and replace with user-scoped one
DROP POLICY "Service can insert analysis" ON public.fraud_analysis;
CREATE POLICY "Users can insert own analysis" ON public.fraud_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
