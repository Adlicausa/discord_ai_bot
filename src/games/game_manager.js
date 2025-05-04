/**
 * Gestor de juegos para el Bot de Discord
 * Maneja la inicialización, estado y control de diferentes juegos
 */
const fs = require('fs').promises;
const path = require('path');
const iaService = require('../ia_service');

// Cargar juegos específicos
const ChessGame = require('./chess/chess_game');

// Mapa de tipos de juego a sus clases implementadoras
const GAME_TYPES = {
  'ajedrez': ChessGame,
  'chess': ChessGame
};

class GameManager {
  constructor() {
    this.activeSessions = new Map(); // Mapeo de channelId -> sesión de juego
    this.dataPath = path.join(__dirname, '../../data/games');
  }

  /**
   * Inicializa el gestor de juegos
   */
  async initialize() {
    try {
      // Crear directorio de datos si no existe
      await fs.mkdir(this.dataPath, { recursive: true });
      console.log('Sistema de juegos inicializado correctamente');
      
      // Cargar juegos guardados
      await this.loadSavedGames();
    } catch (error) {
      console.error('Error al inicializar el gestor de juegos:', error);
    }
  }

  /**
   * Carga los juegos guardados previamente
   */
  async loadSavedGames() {
    try {
      const files = await fs.readdir(this.dataPath);
      const gameFiles = files.filter(file => file.endsWith('.json'));
      
      console.log(`Encontrados ${gameFiles.length} juegos guardados`);
      
      for (const file of gameFiles) {
        try {
          const channelId = path.basename(file, '.json');
          const gameData = JSON.parse(await fs.readFile(path.join(this.dataPath, file), 'utf8'));
          
          // Recrear el juego si es de un tipo conocido
          if (GAME_TYPES[gameData.type]) {
            const GameClass = GAME_TYPES[gameData.type];
            const game = new GameClass();
            await game.loadState(gameData);
            this.activeSessions.set(channelId, game);
            console.log(`Juego de ${gameData.type} restaurado para canal ${channelId}`);
          }
        } catch (gameError) {
          console.error(`Error al cargar el juego ${file}:`, gameError);
        }
      }
    } catch (error) {
      console.error('Error al cargar juegos guardados:', error);
    }
  }

  /**
   * Inicia un nuevo juego
   * @param {Object} message - Objeto del mensaje de Discord
   * @param {string} gameType - Tipo de juego (ajedrez, etc.)
   * @param {Object} opponent - Usuario oponente (o null para jugar contra la IA)
   * @returns {Object|null} - El juego creado o null si hubo un error
   */
  async startGame(message, gameType, opponent = null) {
    try {
      const channelId = message.channel.id;
      const userId = message.author.id;
      const username = message.author.username;
      
      // Verificar si ya hay un juego activo en este canal
      if (this.activeSessions.has(channelId)) {
        const currentGame = this.activeSessions.get(channelId);
        if (!currentGame.isFinished()) {
          return { error: 'already_active', game: currentGame };
        }
      }
      
      // Convertir el tipo de juego a minúsculas para normalizar
      const normalizedType = gameType.toLowerCase();
      
      // Verificar si el tipo de juego solicitado está implementado
      if (!GAME_TYPES[normalizedType]) {
        return { error: 'unknown_game' };
      }
      
      // Crear una nueva instancia del juego
      const GameClass = GAME_TYPES[normalizedType];
      const game = new GameClass();
      
      // Configurar el juego
      const playAgainstAI = opponent === null;
      const opponentId = playAgainstAI ? 'AI' : opponent.id;
      const opponentName = playAgainstAI ? 'IA' : opponent.username;
      
      // Inicializar el juego
      await game.initialize(userId, username, opponentId, opponentName, playAgainstAI);
      
      // Guardar la sesión
      this.activeSessions.set(channelId, game);
      
      // Guardar estado inicial
      await this.saveGameState(channelId, game);
      
      console.log(`Juego de ${normalizedType} iniciado en canal ${channelId} entre ${username} y ${opponentName}`);
      
      return { success: true, game };
    } catch (error) {
      console.error('Error al iniciar juego:', error);
      return { error: 'initialization_failed' };
    }
  }

  /**
   * Procesa un comando relacionado con juegos
   * @param {Object} message - Objeto del mensaje de Discord
   * @returns {Promise<boolean>} - true si se procesó como comando de juego, false en caso contrario
   */
  async handleGameCommand(message) {
    try {
      const content = message.content.replace(/<@!?(\d+)>/g, '').trim();
      const channelId = message.channel.id;
      const userId = message.author.id;
      
      // Detectar si es una solicitud de inicio de juego
      const gameStartMatch = this.detectGameStart(content);
      if (gameStartMatch) {
        const { gameType, opponentMention } = gameStartMatch;
        
        // Si se menciona a otro usuario, obtener su información
        let opponent = null;
        if (opponentMention) {
          // Extraer ID del usuario de la mención
          const mentionMatch = opponentMention.match(/<@!?(\d+)>/);
          if (mentionMatch && mentionMatch[1]) {
            const mentionedUserId = mentionMatch[1];
            
            // Ignorar si el usuario se menciona a sí mismo
            if (mentionedUserId === userId) {
              await message.reply("No puedes jugar contra ti mismo. Para jugar contra la IA, simplemente menciona el juego sin mencionar a otro usuario.");
              return true;
            }
            
            // Buscar el usuario mencionado
            opponent = message.mentions.users.find(u => u.id === mentionedUserId);
            
            // Si es una mención al bot, jugar contra la IA
            if (opponent && opponent.bot) {
              opponent = null; // Jugar contra la IA
            }
          }
        }
        
        // Iniciar juego
        const result = await this.startGame(message, gameType, opponent);
        
        if (result.error) {
          switch(result.error) {
            case 'already_active':
              await message.reply(`Ya hay un juego activo en este canal. Debes terminar ese juego antes de iniciar uno nuevo.`);
              break;
            case 'unknown_game':
              await message.reply(`Lo siento, el tipo de juego "${gameType}" no está implementado. Los juegos disponibles son: ${Object.keys(GAME_TYPES).filter(k => !k.includes(gameType)).join(', ')}`);
              break;
            default:
              await message.reply(`Lo siento, ocurrió un error al iniciar el juego.`);
          }
        } else {
          // Juego iniciado con éxito, mostrar tablero inicial
          const renderResult = await result.game.renderGame();
          await message.reply(renderResult.message);
        }
        
        return true;
      }
      
      // Verificar si hay un juego activo en este canal
      if (this.activeSessions.has(channelId)) {
        const game = this.activeSessions.get(channelId);
        
        // Verificar si es un comando para abandonar el juego
        if (this.detectSurrenderCommand(content)) {
          const surrenderResult = await game.surrender(userId);
          await message.reply(surrenderResult.message);
          
          if (surrenderResult.gameOver) {
            // Actualizar el estado del juego si ha terminado
            await this.saveGameState(channelId, game);
          }
          
          return true;
        }
        
        // Verificar si es el turno del usuario
        if (!game.isPlayerTurn(userId)) {
          // Si no es su turno, verificar si el comando parece ser una jugada
          if (this.detectMoveCommand(content, game.getType())) {
            await message.reply(`No es tu turno para jugar.`);
            return true;
          }
          
          // Si no parece ser una jugada, no lo procesamos como comando de juego
          return false;
        }
        
        // Procesar el comando como una jugada
        const moveResult = await game.processMove(userId, content);
        
        // Responder según el resultado
        await message.reply(moveResult.message);
        
        // Si la IA necesita hacer un movimiento, procesarlo
        if (moveResult.success && !moveResult.gameOver && game.isAITurn()) {
          // Indicar que el bot está "escribiendo" mientras la IA piensa
          message.channel.sendTyping();
          
          // Generar movimiento de la IA
          const aiMoveResult = await game.generateAIMove();
          
          // Enviar el resultado del movimiento de la IA
          if (aiMoveResult) {
            await message.channel.send(aiMoveResult.message);
          }
        }
        
        // Guardar el estado actualizado del juego
        await this.saveGameState(channelId, game);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error al procesar comando de juego:', error);
      await message.reply("Lo siento, ocurrió un error al procesar tu comando de juego.");
      return true;
    }
  }

  /**
   * Detecta si un mensaje es una solicitud para iniciar un juego
   * @param {string} content - Contenido del mensaje
   * @returns {Object|null} - Información del juego o null si no es una solicitud de inicio
   */
  detectGameStart(content) {
    const lowercaseContent = content.toLowerCase();
    
    // Patrones para detectar inicio de juegos
    const gameStartPatterns = [
      /\bjugar\s+(?:al\s+)?(\w+)\b/i, // "jugar ajedrez" o "jugar al ajedrez"
      /\bjuego\s+(?:de\s+)?(\w+)\b/i, // "juego de ajedrez"
      /\binicio\s+(?:de\s+)?(\w+)\b/i, // "inicio de ajedrez"
      /\bstart\s+(\w+)\b/i, // "start chess"
      /\bplay\s+(\w+)\b/i  // "play chess"
    ];
    
    // Buscar coincidencias con patrones
    for (const pattern of gameStartPatterns) {
      const match = lowercaseContent.match(pattern);
      if (match) {
        const gameType = match[1].toLowerCase();
        
        // Verificar si el tipo de juego es válido
        if (Object.keys(GAME_TYPES).some(type => type.includes(gameType) || gameType.includes(type))) {
          // Buscar si hay una mención a otro usuario
          const mentionMatch = content.match(/<@!?\d+>/g);
          const opponentMention = mentionMatch && mentionMatch.length > 1 ? mentionMatch[1] : null;
          
          return {
            gameType: gameType,
            opponentMention
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Detecta si un mensaje es un comando para rendirse/abandonar
   * @param {string} content - Contenido del mensaje
   * @returns {boolean} - true si es un comando para rendirse
   */
  detectSurrenderCommand(content) {
    const lowercaseContent = content.toLowerCase();
    const surrenderPatterns = [
      /\bme\s+rindo\b/i,
      /\bme\s+retiro\b/i,
      /\babandono\b/i,
      /\bsurrender\b/i,
      /\bforfeit\b/i,
      /\brenuncio\b/i,
      /\bdesisto\b/i,
      /\bterminar\s+juego\b/i,
      /\bcancelar\s+juego\b/i,
      // Nuevos patrones de salida
      /\bsalir\s+juego\b/i,
      /\bsalir\s+ajedrez\b/i,
      /\bsalir\b/i
    ];
    
    return surrenderPatterns.some(pattern => pattern.test(lowercaseContent));
  }

  /**
   * Detecta si un mensaje parece ser un comando de movimiento
   * @param {string} content - Contenido del mensaje
   * @param {string} gameType - Tipo de juego
   * @returns {boolean} - true si parece ser un movimiento
   */
  detectMoveCommand(content, gameType) {
    // Para ajedrez
    if (gameType === 'ajedrez' || gameType === 'chess') {
      // Notación algebraica básica (e2e4)
      if (/^[a-h][1-8][a-h][1-8]$/i.test(content.trim())) {
        return true;
      }
      
      // Notación con guión (e2-e4)
      if (/^[a-h][1-8]-[a-h][1-8]$/i.test(content.trim())) {
        return true;
      }
      
      // Notación en lenguaje natural
      if (/\b[a-h][1-8]\s+(a|hacia|to)\s+[a-h][1-8]\b/i.test(content)) {
        return true;
      }
      
      // Notaciones de piezas (Cf3, Axd5)
      if (/^[RNBQKP][a-h][1-8]$/i.test(content.trim())) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Guarda el estado actual de un juego
   * @param {string} channelId - ID del canal
   * @param {Object} game - Juego a guardar
   */
  async saveGameState(channelId, game) {
    try {
      // Crear directorio si no existe
      await fs.mkdir(this.dataPath, { recursive: true });
      
      // Guardar estado del juego
      const gameState = game.getState();
      await fs.writeFile(
        path.join(this.dataPath, `${channelId}.json`),
        JSON.stringify(gameState, null, 2),
        'utf8'
      );
      
      // Si el juego ha terminado, eliminarlo del mapa de sesiones activas
      if (game.isFinished()) {
        this.activeSessions.delete(channelId);
        console.log(`Juego en canal ${channelId} ha finalizado y se ha eliminado de sesiones activas`);
      }
    } catch (error) {
      console.error(`Error al guardar estado del juego para canal ${channelId}:`, error);
    }
  }
}

// Crear instancia global del gestor de juegos
const gameManager = new GameManager();

module.exports = gameManager;
