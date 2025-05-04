// Analizador de usuarios para el Bot de Discord con IA
const memoryManager = require('./memory_manager');
const iaService = require('./ia_service');

/**
 * Analiza un nuevo usuario o actualiza el análisis de uno existente
 * @param {string} userId - ID del usuario
 * @param {string} username - Nombre del usuario
 * @returns {Promise<Object|null>} - Perfil de personalidad actualizado o null si hay error
 */
async function analyzeUser(userId, username) {
    try {
        console.log(`Analizando usuario: ${userId} (${username})`);
        
        // Obtener mensajes recientes del usuario para análisis
        const recentMessages = await memoryManager.getRecentMessagesForAnalysis(userId, 20);
        
        if (recentMessages.length === 0) {
            console.log(`No hay suficientes mensajes para analizar al usuario ${userId}`);
            return null;
        }
        
        // Construir prompt para análisis de personalidad
        const analysisPrompt = generatePersonalityAnalysisPrompt(username, recentMessages);
        
        // Solicitar análisis a la IA
        const analysisResult = await iaService.performUserAnalysis(analysisPrompt);
        
        if (!analysisResult) {
            console.error(`Error al analizar usuario ${userId}`);
            return null;
        }
        
        // Analizar la respuesta de la IA y convertirla en un objeto de perfil de personalidad
        const personalityProfile = parseAnalysisResult(analysisResult);
        
        // Actualizar el perfil de personalidad del usuario
        await memoryManager.updatePersonalityProfile(userId, personalityProfile);
        
        console.log(`Análisis completado para usuario ${userId}`);
        return personalityProfile;
    } catch (error) {
        console.error('Error en el análisis de usuario:', error);
        return null;
    }
}

/**
 * Genera un prompt para el análisis de personalidad
 * @param {string} username - Nombre del usuario
 * @param {Array} messages - Mensajes recientes del usuario
 * @returns {string} - Prompt para la IA
 */
function generatePersonalityAnalysisPrompt(username, messages) {
    return `
Analiza los siguientes mensajes del usuario "${username}" y crea un perfil de personalidad. 
Identifica rasgos de personalidad, intereses, estilo de comunicación, nivel de formalidad y otros aspectos relevantes.
Devuelve el perfil en un formato estructurado para facilitar la personalización de respuestas.

Mensajes del usuario:
${messages.map((message, index) => `${index + 1}. "${message}"`).join('\n')}

Genera un perfil de personalidad con el siguiente formato:
- RASGOS: [lista de rasgos de personalidad observados]
- INTERESES: [lista de posibles intereses basados en sus mensajes]
- ESTILO_COMUNICACION: [descripción del estilo comunicativo]
- NIVEL_FORMALIDAD: [informal/neutral/formal]
- NOTAS_ADICIONALES: [cualquier otra observación relevante]
`;
}

/**
 * Analiza la respuesta de la IA y la convierte en un objeto de perfil de personalidad
 * @param {string} analysisResult - Texto de respuesta de la IA
 * @returns {Object} - Perfil de personalidad estructurado
 */
function parseAnalysisResult(analysisResult) {
    try {
        // Valores por defecto en caso de que el parsing falle
        const defaultProfile = {
            traits: [],
            interests: [],
            communicationStyle: "neutral",
            formalityLevel: "neutral",
            additionalNotes: ""
        };
        
        // Extraer rasgos de personalidad
        const traitsMatch = analysisResult.match(/RASGOS:(.+?)(?=INTERESES:|$)/s);
        const traits = traitsMatch 
            ? traitsMatch[1].trim().split(/,|\n/).map(item => item.trim()).filter(Boolean)
            : defaultProfile.traits;
        
        // Extraer intereses
        const interestsMatch = analysisResult.match(/INTERESES:(.+?)(?=ESTILO_COMUNICACION:|$)/s);
        const interests = interestsMatch 
            ? interestsMatch[1].trim().split(/,|\n/).map(item => item.trim()).filter(Boolean)
            : defaultProfile.interests;
        
        // Extraer estilo de comunicación
        const styleMatch = analysisResult.match(/ESTILO_COMUNICACION:(.+?)(?=NIVEL_FORMALIDAD:|$)/s);
        const communicationStyle = styleMatch 
            ? styleMatch[1].trim() 
            : defaultProfile.communicationStyle;
        
        // Extraer nivel de formalidad
        const formalityMatch = analysisResult.match(/NIVEL_FORMALIDAD:(.+?)(?=NOTAS_ADICIONALES:|$)/s);
        const formalityLevel = formalityMatch 
            ? formalityMatch[1].trim() 
            : defaultProfile.formalityLevel;
        
        // Extraer notas adicionales
        const notesMatch = analysisResult.match(/NOTAS_ADICIONALES:(.+?)$/s);
        const additionalNotes = notesMatch 
            ? notesMatch[1].trim() 
            : defaultProfile.additionalNotes;
        
        return {
            traits,
            interests,
            communicationStyle,
            formalityLevel,
            additionalNotes,
            lastAnalyzed: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error al analizar la respuesta de la IA:', error);
        return {
            traits: [],
            interests: [],
            communicationStyle: "neutral",
            formalityLevel: "neutral",
            additionalNotes: "Error al analizar la personalidad",
            lastAnalyzed: new Date().toISOString()
        };
    }
}

/**
 * Verifica y analiza a un usuario si es necesario
 * @param {string} userId - ID del usuario
 * @param {string} username - Nombre del usuario
 * @returns {Promise<boolean>} - true si se realizó análisis, false si no
 */
async function checkAndAnalyzeUserIfNeeded(userId, username) {
    try {
        // Verificar si el usuario necesita análisis
        const needsAnalysis = await memoryManager.userNeedsAnalysis(userId);
        
        if (needsAnalysis) {
            console.log(`Usuario ${userId} necesita análisis. Procediendo...`);
            const analysisResult = await analyzeUser(userId, username);
            return analysisResult !== null;
        }
        
        return false; // No se necesitó análisis
    } catch (error) {
        console.error('Error al verificar necesidad de análisis:', error);
        return false;
    }
}

/**
 * Obtiene el perfil de personalidad para un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} - Perfil de personalidad o null si no existe
 */
async function getPersonalityProfile(userId) {
    const userProfile = await memoryManager.getUserProfile(userId);
    if (!userProfile) return null;
    return userProfile.personalityProfile;
}

/**
 * Analiza los sentimientos del bot hacia un usuario específico
 * @param {string} userId - ID del usuario
 * @param {string} username - Nombre del usuario
 * @returns {Promise<Object|null>} - Sentimientos actualizados o null si hay error
 */
async function analyzeBotFeelings(userId, username) {
    try {
        console.log(`Analizando sentimientos hacia el usuario: ${userId} (${username})`);
        
        // Obtener mensajes recientes del usuario para análisis
        const recentMessages = await memoryManager.getRecentMessagesForAnalysis(userId, 10);
        
        if (recentMessages.length === 0) {
            console.log(`No hay suficientes mensajes para analizar sentimientos hacia el usuario ${userId}`);
            return null;
        }
        
        // Construir prompt para análisis de sentimientos
        const feelingsPrompt = generateFeelingsAnalysisPrompt(username, recentMessages);
        
        // Solicitar análisis a la IA
        const analysisResult = await iaService.performFeelingsAnalysis(feelingsPrompt);
        
        if (!analysisResult) {
            console.error(`Error al analizar sentimientos hacia usuario ${userId}`);
            return null;
        }
        
        // Analizar la respuesta de la IA y convertirla en un objeto de sentimientos
        const feelings = parseFeelingsResult(analysisResult);
        
        // Actualizar el perfil de sentimientos del usuario
        await memoryManager.updateBotFeelings(userId, feelings);
        
        console.log(`Análisis de sentimientos completado para usuario ${userId}`);
        return feelings;
    } catch (error) {
        console.error('Error en el análisis de sentimientos:', error);
        return null;
    }
}

/**
 * Genera un prompt para el análisis de sentimientos
 * @param {string} username - Nombre del usuario
 * @param {Array} messages - Mensajes recientes del usuario
 * @returns {string} - Prompt para la IA
 */
function generateFeelingsAnalysisPrompt(username, messages) {
    return `
Analiza los siguientes mensajes del usuario "${username}" y determina qué sentimientos debería tener yo (el bot) hacia este usuario basándome en sus interacciones.
Elige uno de los siguientes tipos de sentimientos y asigna una intensidad del 1 al 10:

- amistad
- indiferencia
- amor
- odio
- reodio (resentimiento extremo)
- ganas_de_matar (animosidad intensa)
- felicidad

Mensajes del usuario:
${messages.map((message, index) => `${index + 1}. "${message}"`).join('\n')}

Analiza el tono, contenido y la forma en que interactúa el usuario. Responde en el siguiente formato:
- TIPO_SENTIMIENTO: [tipo elegido]
- INTENSIDAD: [número del 1-10]
- RAZONES: [razones para este sentimiento]
- EVOLUCIÓN: [cómo ha cambiado desde interacciones anteriores, si aplica]
`;
}

/**
 * Analiza la respuesta de la IA y la convierte en un objeto de sentimientos
 * @param {string} analysisResult - Texto de respuesta de la IA
 * @returns {Object} - Objeto de sentimientos estructurado
 */
function parseFeelingsResult(analysisResult) {
    try {
        // Valores por defecto
        const defaultFeelings = {
            tipo: "indiferencia",
            intensidad: 5,
            razones: "",
            evolucion: "",
            ultima_actualizacion: new Date().toISOString()
        };
        
        // Extraer tipo de sentimiento
        const tipoMatch = analysisResult.match(/TIPO_SENTIMIENTO:\s*(.+?)(?=\n|$)/i);
        const tipo = tipoMatch 
            ? tipoMatch[1].trim().toLowerCase() 
            : defaultFeelings.tipo;
        
        // Extraer intensidad
        const intensidadMatch = analysisResult.match(/INTENSIDAD:\s*(\d+)/i);
        const intensidad = intensidadMatch 
            ? parseInt(intensidadMatch[1].trim(), 10) 
            : defaultFeelings.intensidad;
        
        // Extraer razones
        const razonesMatch = analysisResult.match(/RAZONES:\s*(.+?)(?=\n|EVOLUCIÓN:|$)/is);
        const razones = razonesMatch 
            ? razonesMatch[1].trim() 
            : defaultFeelings.razones;
        
        // Extraer evolución
        const evolucionMatch = analysisResult.match(/EVOLUCIÓN:\s*(.+?)(?=\n|$)/is);
        const evolucion = evolucionMatch 
            ? evolucionMatch[1].trim() 
            : defaultFeelings.evolucion;
        
        return {
            tipo,
            intensidad: Math.min(Math.max(intensidad, 1), 10), // Asegurar rango 1-10
            razones,
            evolucion,
            ultima_actualizacion: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error al analizar la respuesta de sentimientos:', error);
        return {
            tipo: "indiferencia",
            intensidad: 5,
            razones: "Error al analizar sentimientos",
            evolucion: "",
            ultima_actualizacion: new Date().toISOString()
        };
    }
}

/**
 * Verifica y analiza los sentimientos del bot hacia un usuario si es necesario
 * @param {string} userId - ID del usuario
 * @param {string} username - Nombre del usuario
 * @returns {Promise<boolean>} - true si se realizó análisis, false si no
 */
async function checkAndAnalyzeBotFeelingsIfNeeded(userId, username) {
    try {
        const userProfile = await memoryManager.getUserProfile(userId);
        
        // Si no existe el perfil, no hacemos análisis aún
        if (!userProfile) return false;
        
        // Verificar si necesitamos análisis (cada 3 interacciones)
        const needsAnalysis = userProfile.interactionCount % 3 === 0;
        
        if (needsAnalysis) {
            console.log(`Usuario ${userId} necesita análisis de sentimientos. Procediendo...`);
            const analysisResult = await analyzeBotFeelings(userId, username);
            return analysisResult !== null;
        }
        
        return false; // No se necesitó análisis
    } catch (error) {
        console.error('Error al verificar necesidad de análisis de sentimientos:', error);
        return false;
    }
}

module.exports = {
    analyzeUser,
    checkAndAnalyzeUserIfNeeded,
    getPersonalityProfile,
    analyzeBotFeelings,
    checkAndAnalyzeBotFeelingsIfNeeded
};
