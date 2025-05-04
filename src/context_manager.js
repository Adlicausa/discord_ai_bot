// Administrador de contexto para el Bot de Discord con IA
const dataStorage = require('./data_storage');

/**
 * Crea un nuevo perfil de canal
 * @param {string} channelId - ID del canal
 * @param {string} channelName - Nombre del canal
 * @param {string} guildId - ID del servidor
 * @param {string} channelType - Tipo de canal (text, voice, etc.)
 * @returns {Object} - Perfil del canal
 */
function createChannelProfile(channelId, channelName, guildId, channelType) {
    return {
        channelId: channelId,
        channelName: channelName,
        guildId: guildId,
        channelType: channelType,
        topics: [],
        lastActivity: new Date().toISOString(),
        messageCount: 0,
        recentMessages: []
    };
}

/**
 * Registra actividad en un canal
 * @param {Object} channel - Objeto del canal de Discord
 * @param {Object} message - Objeto del mensaje
 * @returns {Promise<Object>} - Perfil actualizado del canal
 */
async function registerChannelActivity(channel, message) {
    try {
        const channelId = channel.id;
        const guildId = channel.guild ? channel.guild.id : 'dm';
        const channelName = channel.name || 'Mensaje Directo';
        const channelType = channel.type || 'unknown';
        
        // Cargar o crear perfil del canal
        let channelProfile = await dataStorage.loadChannel(channelId);
        if (!channelProfile) {
            console.log(`Creando nuevo perfil para canal ${channelId} (${channelName})`);
            channelProfile = createChannelProfile(channelId, channelName, guildId, channelType);
        }
        
        // Actualizar información del canal
        channelProfile.lastActivity = new Date().toISOString();
        channelProfile.messageCount++;
        
        // Añadir mensaje al historial reciente (excluir comandos)
        if (!message.content.startsWith('!')) {
            const messageData = {
                id: message.id,
                authorId: message.author.id,
                authorName: message.author.username,
                content: message.content,
                timestamp: new Date().toISOString()
            };
            
            // Mantener solo los últimos 50 mensajes
            channelProfile.recentMessages.push(messageData);
            if (channelProfile.recentMessages.length > 50) {
                channelProfile.recentMessages = channelProfile.recentMessages.slice(-50);
            }
        }
        
        // Guardar el perfil actualizado
        await dataStorage.saveChannel(channelId, channelProfile);
        
        return channelProfile;
    } catch (error) {
        console.error('Error al registrar actividad del canal:', error);
        return null;
    }
}

/**
 * Obtiene el contexto del canal para usarlo en las respuestas de la IA
 * @param {string} channelId - ID del canal
 * @returns {Promise<Object>} - Contexto del canal
 */
async function getChannelContext(channelId) {
    try {
        const channelProfile = await dataStorage.loadChannel(channelId);
        if (!channelProfile) {
            return { 
                contextAvailable: false,
                summary: "No hay información de contexto disponible para este canal."
            };
        }
        
        // Obtener los mensajes recientes (excluyendo comandos)
        const recentMessages = channelProfile.recentMessages
            .filter(msg => !msg.content.startsWith('!'))
            .slice(-10);
        
        // Crear un resumen del contexto
        let conversationSummary = "Sin conversación reciente.";
        if (recentMessages.length > 0) {
            conversationSummary = recentMessages
                .map(msg => `${msg.authorName}: ${msg.content}`)
                .join('\n');
        }
        
        return {
            contextAvailable: true,
            channelName: channelProfile.channelName,
            channelType: channelProfile.channelType,
            topics: channelProfile.topics,
            messageCount: channelProfile.messageCount,
            recentConversation: conversationSummary
        };
    } catch (error) {
        console.error('Error al obtener contexto del canal:', error);
        return { 
            contextAvailable: false,
            summary: "Error al obtener información de contexto."
        };
    }
}

/**
 * Actualiza los temas detectados en un canal
 * @param {string} channelId - ID del canal
 * @param {Array} topics - Array de temas detectados
 */
async function updateChannelTopics(channelId, topics) {
    try {
        const channelProfile = await dataStorage.loadChannel(channelId);
        if (!channelProfile) return false;
        
        // Actualizar los temas
        channelProfile.topics = topics;
        
        // Guardar el perfil actualizado
        await dataStorage.saveChannel(channelId, channelProfile);
        return true;
    } catch (error) {
        console.error('Error al actualizar temas del canal:', error);
        return false;
    }
}

/**
 * Detecta temas de conversación en un canal
 * @param {string} channelId - ID del canal
 * @returns {Promise<Array>} - Array de temas detectados
 */
async function detectChannelTopics(channelId) {
    // Esta función utilizaría la IA para analizar los mensajes recientes y detectar temas
    // Por ahora, devolvemos un array vacío. La implementación real usaría iaService
    return [];
}

/**
 * Recupera un número específico de mensajes del canal
 * @param {string} channelId - ID del canal
 * @param {number} count - Número de mensajes a recuperar (máximo 50)
 * @returns {Promise<Array>} - Array con los mensajes
 */
async function getChannelMessages(channelId, count = 20) {
    try {
        const channelProfile = await dataStorage.loadChannel(channelId);
        if (!channelProfile || !channelProfile.recentMessages) {
            return [];
        }
        
        // Limitar el número de mensajes al máximo disponible (máximo 50)
        const messageCount = Math.min(count, channelProfile.recentMessages.length);
        
        // Devolver los mensajes más recientes primero
        return channelProfile.recentMessages.slice(-messageCount);
    } catch (error) {
        console.error('Error al obtener mensajes del canal:', error);
        return [];
    }
}

module.exports = {
    registerChannelActivity,
    getChannelContext,
    updateChannelTopics,
    detectChannelTopics,
    getChannelMessages
};
