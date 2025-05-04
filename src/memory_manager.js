// Administrador de memoria para el Bot de Discord con IA
const dataStorage = require('./data_storage');
const { v4: uuidv4 } = require('uuid');

// Límites para mantener en la memoria por usuario
const MESSAGE_HISTORY_LIMIT = 50;
const RECENT_RESPONSES_LIMIT = 10;

/**
 * Crea un nuevo perfil de usuario
 * @param {string} userId - ID del usuario
 * @param {string} username - Nombre del usuario
 * @returns {Object} - Perfil del usuario
 */
function createUserProfile(userId, username) {
    return {
        userId: userId,
        username: username,
        personalityProfile: {
            traits: [],
            interests: [],
            communicationStyle: "neutral"
        },
        sentimientosBot: {
            tipo: "indiferencia",
            intensidad: 5,
            razones: "Perfil inicial",
            evolucion: "Perfil recién creado",
            ultima_actualizacion: new Date().toISOString(),
            historial: []
        },
        respuestasRecientes: [],
        interactionCount: 0,
        lastUpdated: new Date().toISOString(),
        messageHistory: [],
        needsAnalysis: true
    };
}

/**
 * Guarda un mensaje en la memoria para un usuario específico
 * @param {string} userId - ID del usuario
 * @param {string} username - Nombre del usuario
 * @param {string} content - Contenido del mensaje
 * @param {string} channelId - ID del canal
 * @param {boolean} isFromBot - true si el mensaje es del bot, false si es del usuario
 */
async function saveMessage(userId, username, content, channelId, isFromBot) {
    try {
        // Cargar o crear perfil de usuario
        let userProfile = await dataStorage.loadUser(userId);
        if (!userProfile) {
            console.log(`Creando nuevo perfil para usuario ${userId} (${username})`);
            userProfile = createUserProfile(userId, username);
        }
        
        // Incrementar contador de interacciones solo si el mensaje es del usuario
        if (!isFromBot) {
            userProfile.interactionCount++;
            
            // Marcar para análisis cada 10 mensajes
            if (userProfile.interactionCount % 10 === 0) {
                userProfile.needsAnalysis = true;
            }
        }
        
        // Actualizar timestamp
        userProfile.lastUpdated = new Date().toISOString();
        
        // Añadir mensaje al historial
        const message = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            content: content,
            channelId: channelId,
            isFromBot: isFromBot
        };
        userProfile.messageHistory.push(message);
        
        // Limitar el tamaño del historial
        if (userProfile.messageHistory.length > MESSAGE_HISTORY_LIMIT) {
            userProfile.messageHistory = userProfile.messageHistory.slice(-MESSAGE_HISTORY_LIMIT);
        }
        
        // Guardar perfil actualizado
        await dataStorage.saveUser(userId, userProfile);
        
        // También guardar el mensaje en el historial de conversaciones
        await saveMessageInConversation(userId, message);
        
        return userProfile;
    } catch (error) {
        console.error('Error al guardar mensaje en memoria:', error);
        return null;
    }
}

/**
 * Guarda un mensaje en el historial de conversaciones
 * @param {string} userId - ID del usuario
 * @param {Object} message - Objeto del mensaje
 */
async function saveMessageInConversation(userId, message) {
    try {
        // Usamos el formato YYYY-MM-DD como ID de conversación para agrupar por día
        const today = new Date().toISOString().split('T')[0];
        const conversationId = `${userId}_${today}`;
        
        // Cargar conversación existente o crear nueva
        let conversation = await dataStorage.loadConversation(conversationId);
        if (!conversation) {
            conversation = {
                userId: userId,
                date: today,
                messages: []
            };
        }
        
        // Añadir mensaje y guardar
        conversation.messages.push(message);
        await dataStorage.saveConversation(conversationId, conversation);
    } catch (error) {
        console.error('Error al guardar mensaje en conversación:', error);
    }
}

/**
 * Obtiene el perfil de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} - Perfil del usuario o null si no existe
 */
async function getUserProfile(userId) {
    return await dataStorage.loadUser(userId);
}

/**
 * Verifica si un usuario necesita análisis de personalidad
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - true si necesita análisis, false si no
 */
async function userNeedsAnalysis(userId) {
    const userProfile = await dataStorage.loadUser(userId);
    if (!userProfile) return true; // Usuarios nuevos siempre necesitan análisis
    return userProfile.needsAnalysis === true;
}

/**
 * Obtiene los mensajes recientes de un usuario para análisis
 * @param {string} userId - ID del usuario
 * @param {number} limit - Número máximo de mensajes a obtener
 * @returns {Promise<Array>} - Array con mensajes recientes
 */
async function getRecentMessagesForAnalysis(userId, limit = 20) {
    const userProfile = await dataStorage.loadUser(userId);
    if (!userProfile) return [];
    
    // Filtrar solo mensajes del usuario (no los del bot)
    const userMessages = userProfile.messageHistory.filter(msg => !msg.isFromBot);
    
    // Devolver los más recientes primero, limitados al número especificado
    return userMessages.slice(-limit).map(msg => msg.content);
}

/**
 * Actualiza el perfil de personalidad de un usuario
 * @param {string} userId - ID del usuario
 * @param {Object} personalityProfile - Perfil de personalidad actualizado
 */
async function updatePersonalityProfile(userId, personalityProfile) {
    try {
        const userProfile = await dataStorage.loadUser(userId);
        if (!userProfile) return false;
        
        userProfile.personalityProfile = personalityProfile;
        userProfile.needsAnalysis = false; // Resetear el flag de análisis
        
        await dataStorage.saveUser(userId, userProfile);
        console.log(`Perfil de personalidad actualizado para usuario ${userId}`);
        return true;
    } catch (error) {
        console.error('Error al actualizar perfil de personalidad:', error);
        return false;
    }
}

/**
 * Obtiene el historial de mensajes para un usuario
 * @param {string} userId - ID del usuario
 * @param {number} limit - Número máximo de mensajes a obtener
 * @returns {Promise<Array>} - Historial de mensajes
 */
async function getMessageHistory(userId, limit = 10) {
    const userProfile = await dataStorage.loadUser(userId);
    if (!userProfile) return [];
    
    // Devolver los mensajes más recientes primero, limitados al número especificado
    return userProfile.messageHistory.slice(-limit);
}

/**
 * Verifica si un usuario existe en la base de datos
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - true si existe, false si no
 */
async function userExists(userId) {
    return await dataStorage.userExists(userId);
}

/**
 * Lista todos los usuarios en la base de datos
 * @returns {Promise<Array>} - Lista de IDs de usuario
 */
async function listUsers() {
    return await dataStorage.listUsers();
}

/**
 * Guarda una respuesta reciente del bot
 * @param {string} userId - ID del usuario
 * @param {string} respuesta - Contenido de la respuesta
 * @returns {Promise<boolean>} - true si se guardó correctamente
 */
async function saveRecentResponse(userId, respuesta) {
    try {
        const userProfile = await getUserProfile(userId);
        if (!userProfile) return false;
        
        // Inicializar array si no existe
        if (!userProfile.respuestasRecientes) {
            userProfile.respuestasRecientes = [];
        }
        
        // Añadir respuesta
        userProfile.respuestasRecientes.push(respuesta);
        
        // Limitar tamaño
        if (userProfile.respuestasRecientes.length > RECENT_RESPONSES_LIMIT) {
            userProfile.respuestasRecientes = userProfile.respuestasRecientes.slice(-RECENT_RESPONSES_LIMIT);
        }
        
        // Guardar perfil actualizado
        await dataStorage.saveUser(userId, userProfile);
        return true;
    } catch (error) {
        console.error('Error al guardar respuesta reciente:', error);
        return false;
    }
}

/**
 * Verifica si una respuesta es similar a respuestas recientes
 * @param {string} userId - ID del usuario
 * @param {string} respuesta - Respuesta a verificar
 * @returns {Promise<boolean>} - true si es similar, false si no
 */
async function esRespuestaSimilar(userId, respuesta) {
    try {
        const userProfile = await getUserProfile(userId);
        if (!userProfile || !userProfile.respuestasRecientes || userProfile.respuestasRecientes.length === 0) {
            return false;
        }
        
        // Función simple para medir similitud
        const calcularSimilitud = (texto1, texto2) => {
            // Normalizar textos
            const norm1 = texto1.toLowerCase();
            const norm2 = texto2.toLowerCase();
            
            // Calcular intersección de palabras
            const palabras1 = new Set(norm1.split(/\s+/));
            const palabras2 = new Set(norm2.split(/\s+/));
            const interseccion = [...palabras1].filter(p => palabras2.has(p));
            
            // Calcular coeficiente de Jaccard
            const union = new Set([...palabras1, ...palabras2]);
            return interseccion.length / union.size;
        };
        
        // Verificar similitud con respuestas recientes
        const UMBRAL_SIMILITUD = 0.7; // Ajustar según necesidad
        for (const respReciente of userProfile.respuestasRecientes) {
            const similitud = calcularSimilitud(respuesta, respReciente);
            if (similitud > UMBRAL_SIMILITUD) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error al verificar similitud de respuesta:', error);
        return false;
    }
}

/**
 * Actualiza los sentimientos del bot hacia un usuario
 * @param {string} userId - ID del usuario
 * @param {Object} feelings - Objeto con los sentimientos
 * @returns {Promise<boolean>} - true si se actualizó correctamente
 */
async function updateBotFeelings(userId, feelings) {
    try {
        const userProfile = await getUserProfile(userId);
        if (!userProfile) return false;
        
        // Si ya existían sentimientos, guardar el historial
        if (userProfile.sentimientosBot) {
            if (!userProfile.sentimientosBot.historial) {
                userProfile.sentimientosBot.historial = [];
            }
            
            // Añadir sentimientos actuales al historial
            userProfile.sentimientosBot.historial.push({
                tipo: userProfile.sentimientosBot.tipo,
                intensidad: userProfile.sentimientosBot.intensidad,
                timestamp: userProfile.sentimientosBot.ultima_actualizacion
            });
            
            // Limitar tamaño del historial (últimos 10)
            if (userProfile.sentimientosBot.historial.length > 10) {
                userProfile.sentimientosBot.historial = userProfile.sentimientosBot.historial.slice(-10);
            }
        }
        
        // Actualizar sentimientos
        userProfile.sentimientosBot = {
            tipo: feelings.tipo,
            intensidad: feelings.intensidad,
            razones: feelings.razones,
            evolucion: feelings.evolucion,
            ultima_actualizacion: feelings.ultima_actualizacion,
            historial: userProfile.sentimientosBot?.historial || []
        };
        
        await dataStorage.saveUser(userId, userProfile);
        console.log(`Sentimientos del bot actualizados para usuario ${userId}`);
        return true;
    } catch (error) {
        console.error('Error al actualizar sentimientos del bot:', error);
        return false;
    }
}

/**
 * Obtiene los sentimientos del bot hacia un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} - Sentimientos o null si no existen
 */
async function getBotFeelings(userId) {
    const userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.sentimientosBot) return null;
    return userProfile.sentimientosBot;
}

module.exports = {
    saveMessage,
    getUserProfile,
    userNeedsAnalysis,
    getRecentMessagesForAnalysis,
    updatePersonalityProfile,
    getMessageHistory,
    userExists,
    listUsers,
    saveRecentResponse,
    esRespuestaSimilar,
    updateBotFeelings,
    getBotFeelings
};
