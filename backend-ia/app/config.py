import os
from dotenv import load_dotenv

load_dotenv()

# API Key for service-to-service auth
API_KEY = os.getenv("API_KEY", "")

# Ollama
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama.railway.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

# Database URLs (READ-ONLY connections)
DB_URLS = {
    "sistema": os.getenv("DATABASE_SISTEMA_URL", ""),
    "clientes": os.getenv("DATABASE_CLIENTES_URL", ""),
    "capacidades": os.getenv("DATABASE_CAPACIDADES_URL", ""),
    "ventas": os.getenv("DATABASE_VENTAS_URL", ""),
    "cobranza": os.getenv("DATABASE_COBRANZA_URL", ""),
    "originacion": os.getenv("DATABASE_ORIGINACION_URL", ""),
}
