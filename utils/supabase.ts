import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dsobhcwteqmdcrmtdwuv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzb2JoY3d0ZXFtZGNybXRkd3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjE4ODMsImV4cCI6MjA5MTkzNzg4M30.yKBFTblml1aV1pMWAUYO_SUMzGkgtu6QShTsSWyYGFA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)