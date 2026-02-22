# Deploy Ollama en Railway

## Crear servicio

1. En Railway → tu proyecto → **New Service** → **Docker Image**
2. Imagen: `ollama/ollama`
3. **NO hacer deploy todavía**

## Configurar antes del deploy

### Variables de entorno
| Variable | Valor |
|---|---|
| `OLLAMA_HOST` | `0.0.0.0` |

### Volume
- Settings → **Add Volume**
- Mount Path: `/root/.ollama`

### Start Command
```bash
bash -c "ollama serve & sleep 5 && ollama pull llama3.2:3b && wait"
```

### Private Networking
- Settings → Networking → habilitar **Private Networking**
- Anotar la URL interna (ej: `ollama.railway.internal`)

## Hacer deploy

1. Hacer deploy y esperar a que esté verde
2. En logs debe aparecer el pull del modelo y luego `Uvicorn running`

## Verificar

En logs del servicio debe verse:
```
pulling ... 100%
success
```

## Conectar con agente-api

En servicio **agente-api** → Variables:
```
OLLAMA_URL=http://<url-interna-ollama>.railway.internal:11434
OLLAMA_MODEL=llama3.2:3b
```

Redeploy de agente-api.

## Recursos

- RAM: ~8-11 GB
- Modelo: llama3.2:3b (~2 GB)
- Puerto: 11434 (interno, no exponer público)
