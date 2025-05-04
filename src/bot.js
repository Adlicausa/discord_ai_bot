// Configuración y funcionalidades del Bot de Discord
const { Client, GatewayIntentBits, Partials, PermissionsBitField, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Importar servicios
const iaService = require('./ia_service');
const { 
    sendMessageToAI, 
    generateConversationSummary, 
    generateModResponse, 
    generateModErrorResponse, 
    reloadConfig 
} = iaService;
const memoryManager = require('./memory_manager');
const userAnalyzer = require('./user_analyzer');
const contextManager = require('./context_manager');

// Cargar configuración
const configPath = path.join(__dirname, '../config/config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Función para guardar la configuración actualizada
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Configuración guardada exitosamente');
        // Recargar configuración en otros módulos
        reloadConfig();
        return true;
    } catch (error) {
        console.error('Error al guardar la configuración:', error);
        return false;
    }
}

// Crear cliente de Discord con los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel]
});

// Función para iniciar el bot
function startBot() {
    // Evento cuando el bot está listo
    client.on('ready', () => {
        console.log(`Bot conectado como ${client.user.tag}`);
        client.user.setActivity(config.bot.status, { type: ActivityType.Playing });
        console.log('Sistema de memoria e inteligencia inicializado');
    });

    // Evento para procesar mensajes
    client.on('messageCreate', async (message) => {
        try {
            // Ignorar mensajes del propio bot
            if (message.author.bot) return;
            
            // Registrar actividad del canal para contexto
            await contextManager.registerChannelActivity(message.channel, message);
            
            // Procesar comandos que comienzan con el prefijo configurado
            if (message.content.startsWith(config.bot.prefix)) {
                await processCommand(message);
                return;
            }
            
            // Verificar si el bot fue mencionado
            const botMentioned = message.mentions.users.has(client.user.id);
            
            if (botMentioned) {
                await processMention(message);
            }
        } catch (error) {
            console.error('Error al procesar mensaje:', error);
        }
    });

    // Iniciar sesión con el token
    client.login(config.bot.token)
        .catch(error => {
            console.error('Error al iniciar sesión en Discord:', error);
        });
    
    return client;
}

/**
 * Procesa un comando dirigido al bot
 * @param {Object} message - Objeto del mensaje de Discord
 */
async function processCommand(message) {
    const args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Comando para configurar el bot
    if (command === 'configurar') {
        // Verificar si el usuario es administrador
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('Solo los administradores pueden usar este comando.');
        }
        
        if (!args.length) {
            return message.reply(`
**Comando de Configuración**

Uso: \`${config.bot.prefix}configurar [sección] [clave] [valor]\`

**Secciones disponibles:**
- bot: Configuración del bot de Discord
- ia: Configuración de la IA

**Ejemplos:**
\`${config.bot.prefix}configurar bot status "Nuevo estado"\`
\`${config.bot.prefix}configurar ia temperature 0.8\`
\`${config.bot.prefix}configurar ia system_prompt "Eres un asistente útil"\`

**Para ver la configuración actual:**
\`${config.bot.prefix}configurar ver\`
            `);
        }
        
        // Subcomando para ver la configuración actual
        if (args[0] === 'ver') {
            // Crear una copia de la configuración para ocultar información sensible
            const safeConfig = JSON.parse(JSON.stringify(config));
            safeConfig.bot.token = '[OCULTO POR SEGURIDAD]';
            safeConfig.ia.apiKey = '[OCULTO POR SEGURIDAD]';
            
            const configString = JSON.stringify(safeConfig, null, 2);
            return message.reply('Configuración actual:\n```json\n' + configString + '\n```');
        }
        
        // Verificar si se especificaron los argumentos requeridos
        if (args.length < 3) {
            return message.reply(`Argumentos insuficientes. Uso: \`${config.bot.prefix}configurar [sección] [clave] [valor]\``);
        }
        
        const section = args[0];
        const key = args[1];
        const value = args.slice(2).join(' ');
        
        // Verificar si la sección existe
        if (!config[section]) {
            return message.reply(`La sección "${section}" no existe en la configuración.`);
        }
        
        // Verificar si la clave existe en esa sección
        if (!(key in config[section])) {
            return message.reply(`La clave "${key}" no existe en la sección "${section}".`);
        }
        
        // Intentar convertir el valor al tipo correcto
        let typedValue;
        try {
            const currentValue = config[section][key];
            if (typeof currentValue === 'number') {
                typedValue = Number(value);
                if (isNaN(typedValue)) {
                    return message.reply(`El valor debe ser un número para la clave "${key}".`);
                }
            } else if (typeof currentValue === 'boolean') {
                if (value.toLowerCase() === 'true') {
                    typedValue = true;
                } else if (value.toLowerCase() === 'false') {
                    typedValue = false;
                } else {
                    return message.reply(`El valor debe ser "true" o "false" para la clave "${key}".`);
                }
            } else {
                // Para strings u otros tipos
                typedValue = value;
            }
        } catch (error) {
            return message.reply('Error al procesar el valor. Verifica que sea del tipo correcto.');
        }
        
        // No permitir cambiar directamente valores sensibles por seguridad
        if ((section === 'bot' && key === 'token') || (section === 'ia' && key === 'apiKey')) {
            return message.reply(`Por razones de seguridad, no se permite cambiar "${key}" directamente desde el chat.`);
        }
        
        // Actualizar la configuración
        const oldValue = config[section][key];
        config[section][key] = typedValue;
        
        // Guardar la configuración actualizada
        const saved = saveConfig();
        
        if (saved) {
            return message.reply(`Configuración actualizada: \`${section}.${key}\` cambiado de \`${oldValue}\` a \`${typedValue}\`.`);
        } else {
            // Revertir el cambio si hubo un error al guardar
            config[section][key] = oldValue;
            return message.reply('Error al guardar la configuración. El cambio no se aplicó.');
        }
    }
}

/**
 * Detecta si un mensaje es una solicitud de resumen
 * @param {string} content - Contenido del mensaje
 * @returns {boolean} - true si es una solicitud de resumen
 */
function detectSummaryRequest(content) {
    const lowercaseContent = content.toLowerCase();
    const summaryKeywords = [
        'resumen', 'resumir', 'resume', 'resumen de', 'resumir lo que', 'resumir la', 
        'has un resumen', 'haz un resumen', 'generar resumen', 'generar un resumen',
        'puedes resumir', 'podrías resumir', 'me puedes resumir', 'me podrías resumir'
    ];
    
    return summaryKeywords.some(keyword => lowercaseContent.includes(keyword));
}

/**
 * Extrae el número de mensajes mencionados en una solicitud de resumen
 * @param {string} content - Contenido del mensaje
 * @returns {number|null} - Número de mensajes o null si no se especifica
 */
function extractMessageCount(content) {
    // Buscar patrones como "últimos 30 mensajes", "20 mensajes", etc.
    const matches = content.match(/(\d+)\s+mensajes/i);
    if (matches && matches[1]) {
        const count = parseInt(matches[1], 10);
        // Limitar a un máximo de 50 mensajes
        return Math.min(count, 50);
    }
    return null;
}

/**
 * Detecta si un mensaje es una solicitud de banear a un usuario
 * @param {string} content - Contenido del mensaje
 * @returns {boolean} - true si es una solicitud de ban
 */
function detectBanRequest(content) {
    const lowercaseContent = content.toLowerCase();
    const banKeywords = [
        'banea', 'banear', 'ban', 'expulsa permanentemente', 'prohibe el acceso',
        'da ban a', 'quiero que banees', 'por favor banea'
    ];
    
    return banKeywords.some(keyword => lowercaseContent.includes(keyword));
}

/**
 * Detecta si un mensaje es una solicitud de expulsión (kick)
 * @param {string} content - Contenido del mensaje
 * @returns {boolean} - true si es una solicitud de expulsión
 */
function detectKickRequest(content) {
    const lowercaseContent = content.toLowerCase();
    const kickKeywords = [
        'kickea', 'expulsa', 'kick', 'saca a', 'echa a', 
        'quiero que expulses', 'por favor expulsa'
    ];
    
    return kickKeywords.some(keyword => lowercaseContent.includes(keyword));
}

/**
 * Detecta si un mensaje es una solicitud de silencio (mute)
 * @param {string} content - Contenido del mensaje
 * @returns {boolean} - true si es una solicitud de silencio
 */
function detectMuteRequest(content) {
    const lowercaseContent = content.toLowerCase();
    const muteKeywords = [
        'mutea', 'silencia', 'mute', 'quita voz a', 'remueve capacidad de hablar',
        'quiero que silencies', 'por favor silencia'
    ];
    
    return muteKeywords.some(keyword => lowercaseContent.includes(keyword));
}

/**
 * Extrae el usuario mencionado en una solicitud de moderación
 * @param {Object} message - Objeto del mensaje de Discord
 * @param {string} content - Contenido del mensaje
 * @returns {Object|null} - Usuario objetivo o null si no se encuentra
 */
function extractTargetUser(message, content) {
    // Verificar menciones en el mensaje
    if (message.mentions.users.size > 1) {
        // La primera mención es el bot, las demás podrían ser objetivos
        return Array.from(message.mentions.users.values())[1];
    }
    
    // Si no hay menciones directas, podemos intentar buscar por nombre de usuario en el futuro
    return null;
}

/**
 * Extrae la razón para una acción de moderación
 * @param {string} content - Contenido del mensaje
 * @returns {string|null} - Razón extraída o null si no se especifica
 */
function extractReason(content) {
    // Buscar frases como "razón: spam" o "porque estaba spammeando"
    const reasonMatches = content.match(/raz[oó]n:?\s+(.+?)(?:$|por\s+|durante\s+)/i) || 
                        content.match(/porque\s+(.+?)(?:$|durante\s+)/i) ||
                        content.match(/por\s+(.+?)(?:$|durante\s+)/i);
    
    return reasonMatches ? reasonMatches[1].trim() : null;
}

/**
 * Extrae la duración para un mute (en minutos)
 * @param {string} content - Contenido del mensaje
 * @returns {number|null} - Duración en minutos o null si no se especifica
 */
function extractDuration(content) {
    // Buscar patrones como "5 minutos", "1 hora", "2 horas", etc.
    const minutesMatch = content.match(/(\d+)\s+minutos?/i);
    if (minutesMatch) return parseInt(minutesMatch[1], 10);
    
    const hoursMatch = content.match(/(\d+)\s+horas?/i);
    if (hoursMatch) return parseInt(hoursMatch[1], 10) * 60;
    
    const daysMatch = content.match(/(\d+)\s+d[ií]as?/i);
    if (daysMatch) return parseInt(daysMatch[1], 10) * 60 * 24;
    
    // Valor por defecto: 1 hora (60 minutos)
    return 60;
}

/**
 * Procesa una solicitud de moderación
 * @param {Object} message - Objeto del mensaje de Discord
 * @param {string} content - Contenido del mensaje
 * @param {Object} userProfile - Perfil del usuario que solicita la moderación
 * @param {Object} channelContext - Contexto del canal
 * @param {string} type - Tipo de moderación (ban/kick/mute)
 */
async function processModeration(message, content, userProfile, channelContext, type) {
    // Verificar si el usuario tiene permisos de administrador
    const hasPermission = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    
    // Extraer el usuario objetivo
    const targetUser = extractTargetUser(message, content);
    
    // Verificar si se pudo identificar un usuario objetivo
    if (!targetUser) {
        const errorResponse = await generateModErrorResponse(
            userProfile, 
            'target_not_found', 
            type
        );
        await message.reply(errorResponse);
        
        // Guardar interacción en memoria
        await memoryManager.saveMessage(
            message.author.id,
            message.author.username,
            content,
            message.channel.id,
            false
        );
        await memoryManager.saveMessage(
            message.author.id,
            message.author.username,
            errorResponse,
            message.channel.id,
            true
        );
        return;
    }
    
    // Si no tiene permisos, generar respuesta personalizada negando la acción
    if (!hasPermission) {
        const denialResponse = await generateModErrorResponse(
            userProfile, 
            'permission_denied',
            type, 
            targetUser.username
        );
        await message.reply(denialResponse);
        
        // Guardar interacción en memoria
        await memoryManager.saveMessage(
            message.author.id, 
            message.author.username, 
            content, 
            message.channel.id, 
            false
        );
        await memoryManager.saveMessage(
            message.author.id,
            message.author.username,
            denialResponse,
            message.channel.id,
            true
        );
        return;
    }
    
    // Si tiene permisos, ejecutar la acción de moderación
    let actionSucceeded = false;
    let actionResult = '';
    
    try {
        switch (type) {
            case 'ban':
                // Extraer razón si está incluida
                const banReason = extractReason(content) || 'Razón no especificada';
                try {
                    await message.guild.members.ban(targetUser, { reason: banReason });
                    actionSucceeded = true;
                    actionResult = `Usuario ${targetUser.username} baneado. Razón: ${banReason}`;
                    console.log(actionResult); // Log adicional para debug
                } catch (banError) {
                    console.error(`Error específico al banear a ${targetUser.username}:`, banError);
                    actionSucceeded = false;
                    actionResult = `Error al banear a ${targetUser.username}: ${banError.message}`;
                }
                break;
                
            case 'kick':
                const kickReason = extractReason(content) || 'Razón no especificada';
                try {
                    // Obtener miembro del servidor
                    const kickMember = message.guild.members.cache.get(targetUser.id);
                    
                    // Verificar si el miembro existe
                    if (!kickMember) {
                        console.log(`No se pudo encontrar al miembro ${targetUser.username} (${targetUser.id}) en el servidor`);
                        // Intentar buscar directamente al miembro
                        const fetchedMember = await message.guild.members.fetch(targetUser.id);
                        if (fetchedMember) {
                            await fetchedMember.kick(kickReason);
                        } else {
                            throw new Error(`No se puede expulsar a ${targetUser.username} porque no se encuentra en el servidor`);
                        }
                    } else {
                        await kickMember.kick(kickReason);
                    }
                    
                    actionSucceeded = true;
                    actionResult = `Usuario ${targetUser.username} expulsado. Razón: ${kickReason}`;
                    console.log(actionResult); // Log adicional para debug
                } catch (kickError) {
                    console.error(`Error específico al expulsar a ${targetUser.username}:`, kickError);
                    actionSucceeded = false;
                    actionResult = `Error al expulsar a ${targetUser.username}: ${kickError.message}`;
                }
                break;
                
            case 'mute':
                // Implementar según el sistema de Discord (roles de mute o timeout)
                const muteDuration = extractDuration(content);
                const muteReason = extractReason(content) || 'Razón no especificada';
                try {
                    // Obtener miembro del servidor
                    const muteMember = message.guild.members.cache.get(targetUser.id);
                    
                    // Verificar si el miembro existe
                    if (!muteMember) {
                        console.log(`No se pudo encontrar al miembro ${targetUser.username} (${targetUser.id}) en el servidor para silenciar`);
                        // Intentar buscar directamente al miembro
                        const fetchedMember = await message.guild.members.fetch(targetUser.id);
                        if (fetchedMember) {
                            await fetchedMember.timeout(muteDuration * 60 * 1000, muteReason);
                        } else {
                            throw new Error(`No se puede silenciar a ${targetUser.username} porque no se encuentra en el servidor`);
                        }
                    } else {
                        // Discord usa timeouts en milisegundos (minutos * 60 * 1000)
                        await muteMember.timeout(muteDuration * 60 * 1000, muteReason);
                    }
                    
                    actionSucceeded = true;
                    actionResult = `Usuario ${targetUser.username} silenciado por ${muteDuration} minutos. Razón: ${muteReason}`;
                    console.log(actionResult); // Log adicional para debug
                } catch (muteError) {
                    console.error(`Error específico al silenciar a ${targetUser.username}:`, muteError);
                    actionSucceeded = false;
                    actionResult = `Error al silenciar a ${targetUser.username}: ${muteError.message}`;
                }
                break;
        }
    } catch (error) {
        console.error(`Error al ejecutar acción de moderación (${type}):`, error);
        actionSucceeded = false;
        actionResult = `Error: ${error.message}`;
    }
    
    // Generar respuesta personalizada con IA
    const moderationResponse = await generateModResponse(
        userProfile,
        actionSucceeded ? 'success' : 'error',
        type,
        targetUser.username,
        actionResult
    );
    
    // Enviar respuesta
    await message.reply(moderationResponse);
    
    // Guardar interacción en memoria
    await memoryManager.saveMessage(
        message.author.id,
        message.author.username,
        content,
        message.channel.id,
        false
    );
    await memoryManager.saveMessage(
        message.author.id,
        message.author.username,
        moderationResponse,
        message.channel.id,
        true
    );
}

/**
 * Procesa una mención al bot
 * @param {Object} message - Objeto del mensaje de Discord
 */
async function processMention(message) {
    try {
        // Indicar que el bot está "escribiendo"
        message.channel.sendTyping();
        
        // Extraer el contenido sin la mención
        const content = message.content.replace(/<@!?(\d+)>/g, '').trim();
        
        // Obtener información del usuario y canal
        const userId = message.author.id;
        const username = message.author.username;
        const channelId = message.channel.id;
        
        // 1. Verificar y analizar al usuario si es necesario
        if (await userAnalyzer.checkAndAnalyzeUserIfNeeded(userId, username)) {
            console.log(`Análisis de usuario ${username} completado`);
        }
        
        // 2. Verificar y analizar sentimientos del bot hacia el usuario si es necesario
        if (await userAnalyzer.checkAndAnalyzeBotFeelingsIfNeeded(userId, username)) {
            console.log(`Análisis de sentimientos hacia ${username} completado`);
        }
        
        // 3. Obtener perfil de usuario
        const userProfile = await memoryManager.getUserProfile(userId);
        
        // 4. Obtener contexto del canal
        const channelContext = await contextManager.getChannelContext(channelId);
        
        if (content) {
            console.log(`Procesando mensaje de ${username}: "${content}"`);
            
            // Detectar si es una solicitud de resumen
            const summaryRequest = detectSummaryRequest(content);
            if (summaryRequest) {
                message.channel.sendTyping();
                
                // Extraer el número de mensajes solicitados (por defecto 20)
                const messageCount = extractMessageCount(content) || 20;
                console.log(`Generando resumen de ${messageCount} mensajes para ${username}`);
                
                try {
                    // Obtener los mensajes del canal
                    const messages = await contextManager.getChannelMessages(channelId, messageCount);
                    
                    if (messages.length === 0) {
                        await message.reply("No hay mensajes recientes para resumir en este canal.");
                        return;
                    }
                    
                    // Generar resumen
                    const summary = await generateConversationSummary(messages, message.channel.name);
                    
                    // Responder con el resumen
                    await message.reply(`Aquí tienes un resumen de los últimos ${messages.length} mensajes:\n\n${summary}`);
                    
                    // Guardar la interacción en memoria
                    await memoryManager.saveMessage(userId, username, content, channelId, false);
                    await memoryManager.saveMessage(userId, username, summary, channelId, true);
                    
                    return; // Terminar el procesamiento aquí
                } catch (error) {
                    console.error('Error al generar resumen:', error);
                    await message.reply('Lo siento, hubo un problema al generar el resumen de la conversación.');
                    return;
                }
            }
            
            // Detectar si es una solicitud de moderación
            const banRequest = detectBanRequest(content);
            const kickRequest = detectKickRequest(content);
            const muteRequest = detectMuteRequest(content);
            
            if (banRequest || kickRequest || muteRequest) {
                message.channel.sendTyping();
                
                let moderationType;
                if (banRequest) moderationType = 'ban';
                else if (kickRequest) moderationType = 'kick';
                else moderationType = 'mute';
                
                console.log(`Procesando solicitud de moderación (${moderationType}) de ${username}`);
                
                // Procesar la solicitud de moderación
                await processModeration(message, content, userProfile, channelContext, moderationType);
                return; // Terminar el procesamiento aquí
            }
            
            // Si no es un resumen ni moderación, procesar como un mensaje normal
            try {
                // Obtener respuesta inicial
                let response = await iaService.sendMessageToAI(content, userProfile, channelContext);
                
                // Verificar si la respuesta es similar a respuestas anteriores
                let intentos = 0;
                const MAX_INTENTOS = 3;
                
                while (await memoryManager.esRespuestaSimilar(userId, response) && intentos < MAX_INTENTOS) {
                    console.log(`Respuesta similar detectada para ${username}, generando nueva respuesta (intento ${intentos + 1})...`);
                    // Añadir instrucción para evitar repetición
                    const nuevoPrompt = `${content}\n\n[IMPORTANTE: Proporciona una respuesta significativamente diferente a las anteriores]`;
                    response = await iaService.sendMessageToAI(nuevoPrompt, userProfile, channelContext);
                    intentos++;
                }
                
                // Post-procesar la respuesta para eliminar referencias al historial
                response = iaService.postProcesarRespuesta(response);
                
                // Guardar el mensaje del usuario en memoria
                await memoryManager.saveMessage(userId, username, content, channelId, false);
                
                // Enviar respuesta al canal
                await message.reply(response);
                
                // Guardar la respuesta en el historial y en respuestas recientes
                await memoryManager.saveMessage(userId, username, response, channelId, true);
                await memoryManager.saveRecentResponse(userId, response);
            } catch (error) {
                console.error('Error al procesar mensaje con IA:', error);
                await message.reply('Lo siento, tuve un problema al procesar tu mensaje.');
            }
        } else {
            // Mensaje vacío (solo mención)
            const response = '¡Hola! Puedes preguntarme lo que necesites.';
            await message.reply(response);
            
            // Guardar tanto la mención como la respuesta en memoria
            await memoryManager.saveMessage(userId, username, "(mención sin mensaje)", channelId, false);
            await memoryManager.saveMessage(userId, username, response, channelId, true);
        }
    } catch (error) {
        console.error('Error al procesar mención:', error);
        await message.reply('Ha ocurrido un error inesperado.');
    }
}

module.exports = { startBot };
