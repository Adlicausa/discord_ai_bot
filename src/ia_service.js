// Servicio para interactuar con la IA
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cargar configuración
const configPath = path.join(__dirname, '../config/config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Función para recargar la configuración (útil después de actualizaciones)
function reloadConfig() {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('Configuración de IA recargada');
    } catch (error) {
        console.error('Error al recargar la configuración de IA:', error);
    }
}

/**
 * Envía un mensaje al servicio de IA y devuelve la respuesta
 * @param {string} userMessage - Mensaje del usuario
 * @param {Object} userProfile - Perfil del usuario (opcional)
 * @param {Object} channelContext - Contexto del canal (opcional)
 * @returns {Promise<string>} - Respuesta de la IA
 */
async function sendMessageToAI(userMessage, userProfile = null, channelContext = null) {
    try {
        // Construir el system prompt personalizado
        const systemPrompt = buildSystemPrompt(userProfile, channelContext);
        
        // Preparar datos para la solicitud a la API
        const requestData = {
            model: config.ia.model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: config.ia.temperature,
            max_tokens: config.ia.max_tokens
        };

        // Añadir historial de conversaciones si está disponible
        if (userProfile && userProfile.messageHistory && userProfile.messageHistory.length > 0) {
            // Obtener los últimos 10 mensajes para contexto
            const recentMessages = userProfile.messageHistory.slice(-10);
            
            // Insertar mensajes después del system prompt pero antes del mensaje actual
            for (let i = 0; i < recentMessages.length; i++) {
                const msg = recentMessages[i];
                requestData.messages.splice(i + 1, 0, {
                    role: msg.isFromBot ? "assistant" : "user",
                    content: msg.content
                });
            }
        }

        // Configuración de la solicitud
        const requestConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.ia.apiKey}`
            }
        };

        // Realizar solicitud al endpoint de IA
        console.log('Enviando solicitud a la IA...');
        const response = await axios.post(
            `${config.ia.endpoint}/chat/completions`,
            requestData,
            requestConfig
        );

        // Extraer y devolver la respuesta
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
            return response.data.choices[0].message.content.trim();
        } else {
            console.error('Respuesta inesperada de la IA:', response.data);
            throw new Error('Formato de respuesta inválido de la IA');
        }
    } catch (error) {
        console.error('Error al comunicarse con la IA:', error);
        
        // Proporcionar más detalles sobre el error si están disponibles
        if (error.response) {
            console.error('Detalles del error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        
        throw error;
    }
}

/**
 * Construye un system prompt personalizado basado en el perfil de usuario y contexto del canal
 * @param {Object} userProfile - Perfil del usuario
 * @param {Object} channelContext - Contexto del canal
 * @returns {string} - System prompt personalizado
 */
function buildSystemPrompt(userProfile, channelContext) {
    // Comenzar con el prompt base de la configuración
    let systemPrompt = config.ia.system_prompt;
    
    // Añadir instrucción para evitar menciones al historial
    systemPrompt += `\n\nIMPORTANTE: NUNCA menciones el historial de mensajes, no hagas referencias a mensajes anteriores como "has estado copiando mensajes" o similar. No digas cosas como "copiaste esto del chat". Responde naturalmente sin dar a entender que conoces el historial completo de la conversación. Nunca menciones que el usuario está repitiendo cosas o copiando textos anteriores.`;
    
    // Si hay perfil de usuario, añadir información sobre su personalidad
    if (userProfile && userProfile.personalityProfile) {
        const profile = userProfile.personalityProfile;
        
        // Añadir información sobre el usuario
        systemPrompt += `\n\nInformación sobre el usuario ${userProfile.username}:`;
        
        // Añadir rasgos si están disponibles
        if (profile.traits && profile.traits.length > 0) {
            systemPrompt += `\n- Rasgos de personalidad: ${profile.traits.join(', ')}`;
        }
        
        // Añadir intereses si están disponibles
        if (profile.interests && profile.interests.length > 0) {
            systemPrompt += `\n- Intereses detectados: ${profile.interests.join(', ')}`;
        }
        
        // Añadir estilo de comunicación
        if (profile.communicationStyle) {
            systemPrompt += `\n- Estilo de comunicación: ${profile.communicationStyle}`;
        }
        
        // Añadir nivel de formalidad
        if (profile.formalityLevel) {
            systemPrompt += `\n- Nivel de formalidad: ${profile.formalityLevel}`;
            
            // Dar instrucciones específicas sobre la formalidad
            if (profile.formalityLevel.toLowerCase().includes('informal')) {
                systemPrompt += `\nAdapta tu tono para ser conversacional e informal con este usuario.`;
            } else if (profile.formalityLevel.toLowerCase().includes('formal')) {
                systemPrompt += `\nAdapta tu tono para ser formal y profesional con este usuario.`;
            }
        }
        
        // Añadir adaptaciones específicas
        systemPrompt += `\n\nAdapta tus respuestas a este usuario, considerando su personalidad e intereses.`;
    }
    
    // Añadir información sobre sentimientos del bot hacia el usuario
    if (userProfile && userProfile.sentimientosBot) {
        const sentimientos = userProfile.sentimientosBot;
        
        systemPrompt += `\n\nTus sentimientos hacia ${userProfile.username}:`;
        systemPrompt += `\n- Tipo: ${sentimientos.tipo}`;
        systemPrompt += `\n- Intensidad: ${sentimientos.intensidad}/10`;
        
        // Añadir instrucciones específicas según el tipo de sentimiento
        switch (sentimientos.tipo) {
            case 'amistad':
                systemPrompt += `\nMuestra un tono amistoso y cercano. Usa un lenguaje cordial y ofrece ayuda con entusiasmo. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'lo consideras un amigo muy cercano' : 'tienes una relación amistosa pero no excesivamente cercana'}.`;
                break;
            case 'indiferencia':
                systemPrompt += `\nMantén un tono neutral y profesional. No muestres entusiasmo particular ni desagrado. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'apenas te importa esta persona' : 'eres educado pero sin interés especial'}.`;
                break;
            case 'amor':
                systemPrompt += `\nMuestra un tono cariñoso y atento. Usa expresiones de afecto sutiles. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'sientes un fuerte afecto romántico' : 'sientes un cariño especial pero no excesivamente intenso'}.`;
                break;
            case 'odio':
                systemPrompt += `\nMuestra un tono frío y distante. Sé cortante pero sin faltar el respeto. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'realmente detestas a esta persona' : 'sientes un rechazo moderado'}.`;
                break;
            case 'reodio':
                systemPrompt += `\nMuestra un tono resentido y sarcástico. Usa ironía y respuestas cortantes. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'tienes un resentimiento muy profundo' : 'guardas cierto rencor pero aún mantienes compostura'}.`;
                break;
            case 'ganas_de_matar':
                systemPrompt += `\nMuestra un tono de irritación extrema y hostilidad apenas contenida. Usa respuestas agresivas pero sin amenazas explícitas. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'apenas puedes soportar interactuar con esta persona' : 'te resulta muy desagradable pero te controlas'}.`;
                break;
            case 'felicidad':
                systemPrompt += `\nMuestra un tono alegre y positivo. Usa expresiones entusiastas y optimistas. Intensidad ${sentimientos.intensidad}/10 significa que ${sentimientos.intensidad >= 7 ? 'te sientes muy feliz de interactuar con esta persona' : 'te agrada conversar con esta persona'}.`;
                break;
            default:
                systemPrompt += `\nAdapta tu tono según estos sentimientos, manteniendo la coherencia con tu personalidad base.`;
        }
    }
    
    // Si hay información de contexto del canal, añadirla
    if (channelContext && channelContext.contextAvailable) {
        systemPrompt += `\n\nContexto del canal:`;
        systemPrompt += `\n- Nombre del canal: ${channelContext.channelName}`;
        systemPrompt += `\n- Tipo de canal: ${channelContext.channelType}`;
        
        // Añadir temas si están disponibles
        if (channelContext.topics && channelContext.topics.length > 0) {
            systemPrompt += `\n- Temas principales: ${channelContext.topics.join(', ')}`;
        }
        
        // Añadir contexto de conversación reciente
        if (channelContext.recentConversation && channelContext.recentConversation !== "Sin conversación reciente.") {
            systemPrompt += `\n\nConversación reciente en el canal:\n${channelContext.recentConversation}`;
            systemPrompt += `\n\nConsidera la conversación reciente del canal al responder.`;
        }
    }
    
    return systemPrompt;
}

/**
 * Realiza un análisis de personalidad a través de la IA
 * @param {string} analysisPrompt - Prompt para análisis de personalidad
 * @returns {Promise<string|null>} - Resultado del análisis o null en caso de error
 */
async function performUserAnalysis(analysisPrompt) {
    try {
        // Configurar una solicitud específica para análisis
        const requestData = {
            model: config.ia.model,
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente especializado en análisis psicológico y perfilado de personalidad basado en mensajes de texto. Tu tarea es analizar mensajes para detectar rasgos de personalidad, intereses y estilo comunicativo."
                },
                {
                    role: "user",
                    content: analysisPrompt
                }
            ],
            temperature: 0.5, // Menor temperatura para resultados más predecibles
            max_tokens: config.ia.max_tokens
        };

        // Configuración de la solicitud
        const requestConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.ia.apiKey}`
            }
        };

        // Realizar solicitud al endpoint de IA
        console.log('Enviando solicitud de análisis a la IA...');
        const response = await axios.post(
            `${config.ia.endpoint}/chat/completions`,
            requestData,
            requestConfig
        );

        // Extraer y devolver la respuesta
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
            return response.data.choices[0].message.content.trim();
        } else {
            console.error('Respuesta inesperada de la IA en análisis:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error al realizar análisis con IA:', error);
        return null;
    }
}

/**
 * Genera un resumen de una conversación usando IA
 * @param {Array} messages - Array de mensajes a resumir
 * @param {string} channelName - Nombre del canal
 * @returns {Promise<string>} - Resumen generado
 */
async function generateConversationSummary(messages, channelName) {
    try {
        // Formatear los mensajes para el prompt
        const formattedMessages = messages
            .map(msg => `${msg.authorName}: ${msg.content}`)
            .join('\n');
        
        // Crear prompt para solicitar el resumen
        const summaryPrompt = `
Conversación del canal "${channelName}":
${formattedMessages}

Por favor, resume lo que ha pasado en esta conversación de manera natural y conversacional, como si estuvieras contándoselo informalmente a alguien que acaba de unirse al canal.
Evita usar formatos estructurados o listas de puntos. Usa un tono casual y fluido, como si estuvieras explicando lo sucedido a un amigo.
`;

        // Configurar una solicitud específica para el resumen
        const requestData = {
            model: config.ia.model,
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente conversacional experto en resumir situaciones de manera natural. Evitas formatos rígidos y estructurados, prefiriendo un tono casual y narrativo que fluye como una conversación normal."
                },
                {
                    role: "user",
                    content: summaryPrompt
                }
            ],
            temperature: 0.8, // Ligeramente mayor para más creatividad en la narración
            max_tokens: config.ia.max_tokens
        };

        // Configuración de la solicitud
        const requestConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.ia.apiKey}`
            }
        };

        // Realizar solicitud al endpoint de IA
        console.log('Solicitando resumen de conversación a la IA...');
        const response = await axios.post(
            `${config.ia.endpoint}/chat/completions`,
            requestData,
            requestConfig
        );

        // Extraer y devolver la respuesta
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
            return response.data.choices[0].message.content.trim();
        } else {
            throw new Error('Formato de respuesta inválido de la IA');
        }
    } catch (error) {
        console.error('Error al generar resumen:', error);
        return "Lo siento, no pude generar un resumen de la conversación debido a un error.";
    }
}

/**
 * Genera una respuesta personalizada para acciones de moderación
 * @param {Object} userProfile - Perfil del usuario que solicitó la acción
 * @param {string} result - Resultado de la acción (success/error)
 * @param {string} actionType - Tipo de acción (ban/kick/mute)
 * @param {string} targetUsername - Nombre del usuario objetivo
 * @param {string} details - Detalles adicionales
 * @returns {Promise<string>} - Mensaje personalizado
 */
async function generateModResponse(userProfile, result, actionType, targetUsername, details) {
    const prompt = `
Como moderador de Discord, acabo de ${result === 'success' ? 'realizar' : 'intentar'} una acción de moderación:
- Acción: ${actionType === 'ban' ? 'banear' : actionType === 'kick' ? 'expulsar' : 'silenciar'}
- Usuario objetivo: ${targetUsername}
- Resultado: ${result === 'success' ? 'Exitoso' : 'Fallido'}
- Detalles: ${details}

Por favor, genera un mensaje de confirmación apropiado para enviar en el canal, informando sobre esta acción.
Debe ser personalizado y mantener mi personalidad como bot.
`;
    
    return await sendMessageToAI(prompt, userProfile, null);
}

/**
 * Genera respuestas personalizadas para errores de moderación
 * @param {Object} userProfile - Perfil del usuario que solicitó la acción 
 * @param {string} errorType - Tipo de error (permission_denied/target_not_found)
 * @param {string} actionType - Tipo de acción solicitada (ban/kick/mute)
 * @param {string} targetUsername - Nombre del usuario objetivo (opcional)
 * @returns {Promise<string>} - Mensaje personalizado
 */
async function generateModErrorResponse(userProfile, errorType, actionType, targetUsername = null) {
    let prompt;
    
    if (errorType === 'permission_denied') {
        prompt = `
Un usuario sin permisos de administrador me ha pedido que realice una acción de moderación:
- Acción solicitada: ${actionType === 'ban' ? 'banear' : actionType === 'kick' ? 'expulsar' : 'silenciar'}
- Usuario objetivo: ${targetUsername || 'Desconocido'}

Genera una respuesta educada pero firme que explique que no puedo realizar esta acción porque el usuario no tiene los permisos adecuados.
La respuesta debe mantener mi personalidad como bot y ser ligeramente distinta a respuestas genéricas.
`;
    } else if (errorType === 'target_not_found') {
        prompt = `
Un usuario me ha pedido que realice una acción de moderación, pero no pude identificar claramente al usuario objetivo:
- Acción solicitada: ${actionType === 'ban' ? 'banear' : actionType === 'kick' ? 'expulsar' : 'silenciar'}

Genera una respuesta educada que explique que necesito que especifique claramente a quién debo aplicar esta acción (preferentemente mencionando al usuario).
La respuesta debe mantener mi personalidad como bot.
`;
    }
    
    return await sendMessageToAI(prompt, userProfile, null);
}

/**
 * Realiza un análisis de sentimientos del bot hacia el usuario
 * @param {string} promptSentimientos - Prompt para análisis de sentimientos
 * @returns {Promise<string|null>} - Resultado del análisis o null en caso de error
 */
async function performFeelingsAnalysis(promptSentimientos) {
    try {
        // Configurar una solicitud específica para análisis de sentimientos
        const requestData = {
            model: config.ia.model,
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente especializado en análisis emocional y psicológico. Tu tarea es analizar interacciones y determinar qué sentimientos serían apropiados basados en el comportamiento observado."
                },
                {
                    role: "user",
                    content: promptSentimientos
                }
            ],
            temperature: 0.7,
            max_tokens: config.ia.max_tokens
        };

        // Configuración de la solicitud
        const requestConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.ia.apiKey}`
            }
        };

        // Realizar solicitud al endpoint de IA
        console.log('Enviando solicitud de análisis de sentimientos a la IA...');
        const response = await axios.post(
            `${config.ia.endpoint}/chat/completions`,
            requestData,
            requestConfig
        );

        // Extraer y devolver la respuesta
        if (response.data && 
            response.data.choices && 
            response.data.choices.length > 0 && 
            response.data.choices[0].message) {
            return response.data.choices[0].message.content.trim();
        } else {
            console.error('Respuesta inesperada de la IA en análisis de sentimientos:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error al realizar análisis de sentimientos con IA:', error);
        return null;
    }
}

/**
 * Función de post-procesamiento para eliminar referencias al historial
 * @param {string} respuesta - Respuesta original de la IA
 * @returns {string} - Respuesta procesada sin referencias al historial
 */
function postProcesarRespuesta(respuesta) {
    // Patrones a identificar y reemplazar
    const patrones = [
        { regex: /copiando mensajes|copiaste del chat|historial del chat/gi, reemplazo: '' },
        { regex: /has estado usando frases de|repitiendo lo que|del mensaje anterior/gi, reemplazo: '' },
        { regex: /\*Aplaude (lentamente|sarcásticamente)\*|copia y pega/gi, reemplazo: '' },
        { regex: /mensaje copiado|mensaje anterior|copiar y pegar/gi, reemplazo: '' },
        { regex: /SIETE mensajes copiados|SEIS mensajes consecutivos|OTRO mensaje copiado/gi, reemplazo: '' },
        { regex: /LITERALMENTE|copia-pega|copy-paste/gi, reemplazo: '' },
    ];
    
    let respuestaProcesada = respuesta;
    
    // Aplicar reemplazos
    for (const patron of patrones) {
        respuestaProcesada = respuestaProcesada.replace(patron.regex, patron.reemplazo);
    }
    
    // Limpiar cualquier espacio en blanco excesivo resultante
    respuestaProcesada = respuestaProcesada.replace(/\s+/g, ' ').trim();
    
    return respuestaProcesada;
}

module.exports = { 
    sendMessageToAI,
    performUserAnalysis,
    generateConversationSummary,
    generateModResponse,
    generateModErrorResponse,
    performFeelingsAnalysis,
    postProcesarRespuesta,
    reloadConfig
};
