// Official brand logos. The shared UI icon set is embedded by build_templates.py.
const fs=require("fs"),path=require("path");
const SI=require(path.join(process.argv[2],"node_modules/simple-icons"));
const B={claude:"siClaude",anthropic:"siAnthropic",gemini:"siGooglegemini",google:"siGoogle",deepseek:"siDeepseek",mistral:"siMistralai",llama:"siMeta",qwen:"siQwen",kimi:"siKimi",openrouter:"siOpenrouter",huggingface:"siHuggingface",ollama:"siOllama",elevenlabs:"siElevenlabs",whatsapp:"siWhatsapp",telegram:"siTelegram",maps:"siGooglemaps",analytics:"siGoogleanalytics",calendar:"siGooglecalendar",sheets:"siGooglesheets",supabase:"siSupabase",firebase:"siFirebase",pixel:"siMeta",instagram:"siInstagram",youtube:"siYoutube",github:"siGithub",stripe:"siStripe",calendly:"siCalendly",searchconsole:"siGooglesearchconsole",gmail:"siGmail",form:"siFormspree",x:"siX"};
const brands={};for(const [k,v] of Object.entries(B)){const s=SI[v];if(s)brands[k]={p:s.path,c:"#"+s.hex,t:s.title}}
const js="/* Marka logoları: Simple Icons (CC0). */\nconst BRANDS="+JSON.stringify(brands)+";\n";
fs.writeFileSync(path.join(__dirname,"icons.gen.js"),js);
