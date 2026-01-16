-- Add default payment instructions column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_payment_instructions TEXT;