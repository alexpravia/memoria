import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zpxyqomebbjadqvgpapw.supabase.co";
const supabaseAnonKey = "sb_publishable_zuXXnzGR2Ba-JsL3awTQsQ_JyoQQZVC";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
