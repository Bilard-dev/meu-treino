import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zeenqrjrqpaqewzqkfdb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZW5xcmpycXBhcWV3enFrZmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1OTYxNTYsImV4cCI6MjEwOTE3MjE1Nn0.sgzzCMjul-ASCPqbE0X_s1axUeJrh_aG5ZjBfS-x42Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
