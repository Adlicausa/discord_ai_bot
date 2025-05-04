# Bot de Discord con IA y Memoria

Un bot para Discord que responde automáticamente a menciones utilizando una IA compatible con OpenAI, con sistema avanzado de memoria y personalización de respuestas.

## Características

- Responde automáticamente cuando es mencionado
- Utiliza un endpoint de IA compatible con OpenAI
- **Sistema de memoria**: Recuerda conversaciones anteriores con cada usuario
- **Análisis de usuarios**: Detecta la personalidad y estilo de comunicación
- **Conciencia de contexto**: Tiene en cuenta el canal y conversaciones recientes
- **Respuestas personalizadas**: Adapta sus respuestas según el perfil del usuario
- **Resumen de conversaciones**: Puede resumir las últimas conversaciones del canal cuando se le solicita
- Configuración sencilla a través de un archivo JSON

## Requisitos previos

- Node.js (versión 16.9.0 o superior)
- NPM (normalmente viene con Node.js)
- Un token de bot de Discord (obtenido desde [Discord Developer Portal](https://discord.com/developers/applications))
- Acceso a un endpoint de IA compatible con OpenAI

## Instalación

1. Clona este repositorio o descarga los archivos
2. Instala las dependencias:

```bash
npm install
```

3. Configura el bot:
   - Edita el archivo `config/config.json` con tu token de Discord, endpoint de IA y demás configuraciones

## Configuración

Edita el archivo `config/config.json` con la siguiente estructura:

```json
{
  "bot": {
    "token": "TU_TOKEN_DEL_BOT_DISCORD",
    "prefix": "!",
    "status": "Respondiendo con IA"
  },
  "ia": {
    "endpoint": "https://tu-endpoint-compatible-openai.com",
    "apiKey": "TU_API_KEY",
    "model": "nombre-del-modelo",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "Eres un asistente amigable que responde a preguntas."
  }
}
```

### Parámetros de configuración

#### Bot
- `token`: El token de tu bot de Discord
- `prefix`: Prefijo para comandos (por defecto "!")
- `status`: Texto que se mostrará como estado del bot en Discord

#### IA
- `endpoint`: URL base del endpoint compatible con OpenAI (sin incluir el `/v1`)
- `apiKey`: Tu clave de API para el servicio de IA
- `model`: Nombre del modelo de IA a utilizar
- `temperature`: Controla la aleatoriedad de las respuestas (0-1)
- `max_tokens`: Cantidad máxima de tokens en la respuesta
- `system_prompt`: Instrucciones para el comportamiento de la IA

## Uso

1. Inicia el bot:

```bash
node src/index.js
```

2. **Interacción con el bot:**
   - **Menciones:** Menciona al bot (`@nombre-del-bot`) seguido de tu mensaje o pregunta
   - **Comandos de administración:** Usa los comandos especiales para administrar el bot

### Sistema de memoria e inteligencia

El bot cuenta con un avanzado sistema de memoria e inteligencia:

- **Memoria de usuario**: Recuerda todas las conversaciones anteriores con cada usuario.
- **Análisis de personalidad**: Cuando un nuevo usuario interactúa con el bot, éste analiza sus mensajes para determinar su estilo comunicativo y preferencias.
- **Actualizaciones periódicas**: Cada 10 mensajes, el bot actualiza su análisis del usuario para mantenerlo relevante.
- **Contexto del canal**: El bot es consciente del canal en el que está siendo mencionado y puede adaptar sus respuestas.

Todos estos datos se almacenan en la carpeta `data/` en los siguientes subdirectorios:
- `data/users/`: Perfiles de usuario y análisis de personalidad
- `data/conversations/`: Historiales de conversación
- `data/channels/`: Información de contexto de canales

### Resumen de conversaciones

El bot puede generar resúmenes detallados de conversaciones recientes en un canal cuando se le solicita:

- **Cómo solicitarlo**: Simplemente menciona al bot (`@nombre-del-bot`) y pídele un resumen:
  ```
  @BotIA puedes resumir lo que ha pasado en este canal?
  @BotIA haz un resumen de la conversación de hoy
  @BotIA resumen de los últimos 30 mensajes
  ```

- **Personalización**: Puedes especificar cuántos mensajes quieres que resuma (hasta un máximo de 50):
  ```
  @BotIA resumen de los últimos 15 mensajes
  @BotIA puedes resumirme los 25 mensajes anteriores?
  ```

- **Contenido del resumen**: El bot analizará las conversaciones para identificar:
  - Temas principales discutidos
  - Participantes clave en la conversación
  - Decisiones o conclusiones importantes
  - Puntos destacados de la discusión

Si no se especifica un número de mensajes, el bot resumirá los últimos 20 mensajes por defecto.

### Funciones de moderación

El bot incluye funcionalidades de moderación que solo pueden ser utilizadas por administradores:

- **Banear usuarios**: Para prohibir permanentemente el acceso de un usuario al servidor:
  ```
  @BotIA banea a @Usuario razón: spam continuo
  @BotIA por favor da ban a @Usuario porque estaba acosando a otros miembros
  ```

- **Expulsar usuarios**: Para eliminar temporalmente a un usuario del servidor:
  ```
  @BotIA expulsa a @Usuario razón: lenguaje inapropiado
  @BotIA kickea a @Usuario por violar las reglas del servidor
  ```

- **Silenciar usuarios**: Para aplicar un timeout a un usuario:
  ```
  @BotIA silencia a @Usuario durante 30 minutos razón: spam
  @BotIA mutea a @Usuario por 2 horas porque está enviando muchos mensajes
  ```

**Características principales**:

- **Solo para administradores**: Estas funciones solo pueden ser utilizadas por usuarios con permisos de administrador
- **Respuestas personalizadas**: Cuando un usuario sin permisos intenta usar estas funciones, el bot responde con un mensaje personalizado generado por la IA
- **Confirmación integrada**: Después de cada acción de moderación, el bot envía un mensaje generado por IA confirmando la acción realizada
- **Duración personalizable**: Para la función de silenciar, puedes especificar la duración en minutos, horas o días (por defecto: 1 hora)
- **Registro automático**: Todas las acciones de moderación se registran en el sistema de memoria del bot

### Comandos disponibles

- **!configurar** - Permite a los administradores modificar la configuración del bot en tiempo real
  ```
  !configurar [sección] [clave] [valor]
  ```
  Por ejemplo:
  ```
  !configurar ia temperature 0.8
  !configurar bot status "Aprendiendo cosas nuevas"
  !configurar ia system_prompt "Eres un asistente profesional y conciso"
  ```

  Para ver la configuración actual:
  ```
  !configurar ver
  ```

  **Nota:** Solo los administradores del servidor pueden usar este comando.

## Estructura del proyecto

```
Discord_Bot_Remake/
├── config/
│   └── config.json       # Configuración del bot y la IA
├── data/
│   ├── users/            # Datos de usuario y análisis de personalidad
│   ├── conversations/    # Historiales de conversación
│   └── channels/         # Información de contexto de canales
├── src/
│   ├── index.js          # Punto de entrada principal
│   ├── bot.js            # Configuración y funcionalidades del bot
│   ├── ia_service.js     # Servicio para interactuar con la IA
│   ├── memory_manager.js # Sistema de gestión de memoria
│   ├── user_analyzer.js  # Analizador de perfiles de usuario
│   ├── context_manager.js # Gestor de contexto de canales
│   └── data_storage.js   # Sistema de almacenamiento de datos
├── package.json          # Dependencias del proyecto
└── README.md             # Este archivo
```

## Cómo funciona el sistema de memoria

1. **Primer contacto**: Cuando un usuario menciona al bot por primera vez, se crea un perfil para este usuario.
2. **Análisis inicial**: El bot analiza hasta 20 mensajes recientes del usuario para determinar su personalidad, intereses y estilo de comunicación.
3. **Personalización**: Las respuestas se adaptan según el perfil detectado (formal/informal, detallado/conciso, etc.).
4. **Memoria continua**: Cada interacción se guarda y se utiliza para contextualizar futuras conversaciones.
5. **Re-análisis periódico**: Cada 10 mensajes, el bot actualiza su análisis del usuario para mantenerse actualizado.

## Contribuir

Si deseas contribuir a este proyecto, siéntete libre de hacer un fork y enviar un pull request.

## Licencia

[MIT](LICENSE)
