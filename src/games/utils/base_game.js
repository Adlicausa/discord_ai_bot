/**
 * Clase base para todos los juegos
 * Define la interfaz común y funcionalidades básicas para juegos
 */
const iaService = require('../../ia_service');

class BaseGame {
  constructor() {
    this.type = 'base'; // Tipo de juego (a sobrescribir por las subclases)
    this.state = {}; // Estado del juego
    this.player1 = null; // Jugador 1 (iniciador)
    this.player2 = null; // Jugador 2 o IA
    this.currentTurn = null; // Jugador actual
    this.winner = null; // Ganador (si hay)
    this.moveHistory = []; // Historial de movimientos
    this.startTime = null; // Tiempo de inicio
    this.endTime = null; // Tiempo de finalización
    this.vsAI = false; // Juego contra IA
  }

  /**
   * Inicializa un nuevo juego
   * @param {string} player1Id - ID del jugador 1
   * @param {string} player1Name - Nombre del jugador 1
   * @param {string} player2Id - ID del jugador 2 (o 'AI')
   * @param {string} player2Name - Nombre del jugador 2 (o 'IA')
   * @param {boolean} vsAI - true si es contra la IA
   */
  async initialize(player1Id, player1Name, player2Id, player2Name, vsAI = false) {
    // Inicializar jugadores
    this.player1 = {
      id: player1Id,
      name: player1Name
    };
    
    this.player2 = {
      id: player2Id,
      name: player2Name
    };
    
    // Configurar juego
    this.startTime = new Date();
    this.vsAI = vsAI;
    this.currentTurn = 'player1'; // Por defecto inicia el jugador 1
    this.winner = null;
    this.moveHistory = [];
    
    // El estado específico del juego debe ser inicializado en las subclases
    this.initializeGameState();
  }

  /**
   * Inicializa el estado específico del juego
   * Este método debe ser sobrescrito por las subclases
   */
  initializeGameState() {
    throw new Error('El método initializeGameState debe ser implementado por las subclases');
  }

  /**
   * Carga un estado de juego guardado
   * @param {Object} savedState - Estado guardado del juego
   */
  async loadState(savedState) {
    if (!savedState) return;
    
    this.type = savedState.type;
    this.player1 = savedState.player1;
    this.player2 = savedState.player2;
    this.currentTurn = savedState.currentTurn;
    this.winner = savedState.winner;
    this.moveHistory = savedState.moveHistory || [];
    this.startTime = new Date(savedState.startTime);
    this.endTime = savedState.endTime ? new Date(savedState.endTime) : null;
    this.vsAI = savedState.vsAI;
    this.state = savedState.state;
  }

  /**
   * Obtiene el estado completo del juego para guardar
   * @returns {Object} - Estado del juego serializable
   */
  getState() {
    return {
      type: this.type,
      player1: this.player1,
      player2: this.player2,
      currentTurn: this.currentTurn,
      winner: this.winner,
      moveHistory: this.moveHistory,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : null,
      vsAI: this.vsAI,
      state: this.state
    };
  }

  /**
   * Procesa un movimiento a través de la API de IA
   * @param {string} playerId - ID del jugador que realiza el movimiento
   * @param {string} moveText - Texto del movimiento
   * @returns {Object} - Resultado del movimiento
   */
  async processMove(playerId, moveText) {
    // Verificar si el juego ha terminado
    if (this.isFinished()) {
      return {
        success: false,
        message: "El juego ya ha terminado. " + this.getEndGameMessage(),
        gameOver: true
      };
    }
    
    // Verificar si es el turno del jugador
    if (!this.isPlayerTurn(playerId)) {
      return {
        success: false,
        message: "No es tu turno para jugar.",
        gameOver: false
      };
    }
    
    try {
      // Preparar el mensaje para la API de IA
      const prompt = this.buildMovePrompt(playerId, moveText);
      
      // Enviar a la API de IA
      const response = await iaService.sendMessageToAI(prompt, null, null);
      
      // Procesar la respuesta de la IA
      const moveResult = this.parseMoveResponse(response);
      
      // Si el movimiento es válido, actualizar el estado del juego
      if (moveResult.valid) {
        // Registrar el movimiento en el historial
        this.moveHistory.push({
          player: playerId,
          move: moveText,
          normalizedMove: moveResult.normalizedMove,
          timestamp: new Date().toISOString()
        });
        
        // Actualizar el estado del juego
        this.applyMove(moveResult, playerId);
        
        // Cambiar el turno si el juego no ha terminado
        if (!moveResult.gameOver) {
          this.switchTurn();
        } else {
          // Si el juego ha terminado, registrar al ganador
          this.winner = moveResult.winner;
          this.endTime = new Date();
        }
        
        // Renderizar el tablero actual
        const renderResult = await this.renderGame();
        
        return {
          success: true,
          message: renderResult.message,
          gameOver: moveResult.gameOver
        };
      } else {
        // Movimiento inválido
        return {
          success: false,
          message: `Movimiento inválido: ${moveResult.reason || 'Movimiento no permitido'}`,
          gameOver: false
        };
      }
    } catch (error) {
      console.error('Error al procesar movimiento:', error);
      return {
        success: false,
        message: "Ha ocurrido un error al procesar tu movimiento. Por favor, inténtalo de nuevo.",
        gameOver: false
      };
    }
  }

  /**
   * Genera un movimiento de la IA
   * @returns {Object} - Resultado del movimiento de la IA
   */
  async generateAIMove() {
    if (!this.vsAI || !this.isAITurn() || this.isFinished()) {
      return null;
    }
    
    try {
      // Inicializar variables para bucle de intentos
      let intentos = 0;
      const MAX_INTENTOS = 3; // Máximo 3 intentos antes de mostrar error
      let moveResult = null;
      let historialIntentos = [];
      let movimientoValido = false;
      
      // Bucle para intentar hasta MAX_INTENTOS veces o hasta encontrar un movimiento válido
      while (intentos < MAX_INTENTOS && !movimientoValido) {
        intentos++;
        
        // Simular que la IA está "pensando"
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        
        // Construir el prompt para la IA (con historial de intentos si es un reintento)
        const prompt = this.buildAIPrompt(historialIntentos);
        
        // Enviar a la API de IA
        const response = await iaService.sendMessageToAI(prompt, null, null);
        
        // Procesar la respuesta de la IA
        moveResult = this.parseAIResponse(response);
        
        // Si el parseAIResponse devolvió un movimiento aparentemente válido, validarlo con el método de validación
        if (moveResult.valid) {
          // Validar el movimiento utilizando el mismo mecanismo que para jugadores humanos
          const validationResult = await this.validateAIMove(moveResult.moveText);
          
          if (validationResult.valid) {
            // El movimiento es válido según la validación
            movimientoValido = true;
            // Actualizar moveResult con los datos de validación
            moveResult = {
              ...moveResult,
              ...validationResult
            };
            console.log(`La IA generó un movimiento válido: ${moveResult.moveText}`);
          } else {
            // El movimiento propuesto por la IA es inválido
            historialIntentos.push({
              moveText: moveResult.moveText,
              reason: validationResult.reason
            });
            console.log(`Intento ${intentos}: La IA generó un movimiento inválido: ${moveResult.moveText} - Razón: ${validationResult.reason}`);
          }
        } else {
          // Si la respuesta no incluyó un movimiento válido según el formato
          historialIntentos.push({
            moveText: 'formato_inválido',
            reason: moveResult.reason
          });
          console.log(`Intento ${intentos}: La IA no generó un formato de movimiento válido: ${moveResult.reason}`);
        }
      }
      
      // Si encontramos un movimiento válido
      if (movimientoValido) {
        // Registrar el movimiento en el historial
        this.moveHistory.push({
          player: this.player2.id,
          move: moveResult.moveText,
          normalizedMove: moveResult.normalizedMove,
          timestamp: new Date().toISOString()
        });
        
        // Actualizar el estado del juego
        this.applyMove(moveResult, this.player2.id);
        
        // Cambiar el turno si el juego no ha terminado
        if (!moveResult.gameOver) {
          this.switchTurn();
        } else {
          // Si el juego ha terminado, registrar al ganador
          this.winner = moveResult.winner;
          this.endTime = new Date();
        }
        
        // Renderizar el tablero actual
        const renderResult = await this.renderGame();
        
        return {
          success: true,
          message: `${moveResult.messageIntro || 'He movido:'} ${moveResult.moveText}\n\n${renderResult.message}`,
          gameOver: moveResult.gameOver
        };
      } else {
        // Si después de MAX_INTENTOS no se encontró un movimiento válido
        console.error(`Error: La IA no pudo generar un movimiento válido después de ${MAX_INTENTOS} intentos.`);
        return {
          success: false,
          message: `No pude encontrar un movimiento válido después de varios intentos. Por favor, intenta reiniciar el juego.`,
          gameOver: false
        };
      }
    } catch (error) {
      console.error('Error al generar movimiento de IA:', error);
      return {
        success: false,
        message: "Ha ocurrido un error con el movimiento de la IA. Por favor, inténtalo de nuevo.",
        gameOver: false
      };
    }
  }
  
  /**
   * Valida un movimiento propuesto por la IA
   * @param {string} moveText - Texto del movimiento a validar
   * @returns {Promise<Object>} - Resultado de la validación
   */
  async validateAIMove(moveText) {
    try {
      // Construir un prompt para validar el movimiento
      const prompt = this.buildMovePrompt(this.player2.id, moveText);
      
      // Enviar a la API para validación
      const response = await iaService.sendMessageToAI(prompt, null, null);
      
      // Procesar la respuesta usando el mismo analizador que para movimientos de jugadores
      const validationResult = this.parseMoveResponse(response);
      
      return validationResult;
    } catch (error) {
      console.error('Error al validar movimiento de IA:', error);
      return {
        valid: false,
        reason: 'Error al validar el movimiento de IA.'
      };
    }
  }

  /**
   * Procesa una rendición o abandono
   * @param {string} playerId - ID del jugador que se rinde
   * @returns {Object} - Resultado de la rendición
   */
  async surrender(playerId) {
    // Verificar si el juego ya ha terminado
    if (this.isFinished()) {
      return {
        success: false,
        message: "El juego ya ha terminado. " + this.getEndGameMessage(),
        gameOver: true
      };
    }
    
    // Verificar si el jugador está participando en este juego
    if (playerId !== this.player1.id && playerId !== this.player2.id) {
      return {
        success: false,
        message: "No estás participando en este juego.",
        gameOver: false
      };
    }
    
    // Registrar la rendición
    this.moveHistory.push({
      player: playerId,
      move: "surrender",
      timestamp: new Date().toISOString()
    });
    
    // Determinar el ganador
    this.winner = playerId === this.player1.id ? 'player2' : 'player1';
    this.endTime = new Date();
    
    // Renderizar el estado final
    const renderResult = await this.renderGame();
    
    return {
      success: true,
      message: `${playerId === this.player1.id ? this.player1.name : this.player2.name} se ha rendido. ${this.getEndGameMessage()}\n\n${renderResult.message}`,
      gameOver: true
    };
  }

  /**
   * Determina si es el turno de un jugador específico
   * @param {string} playerId - ID del jugador a verificar
   * @returns {boolean} - true si es el turno del jugador
   */
  isPlayerTurn(playerId) {
    if (this.currentTurn === 'player1' && playerId === this.player1.id) {
      return true;
    }
    
    if (this.currentTurn === 'player2' && playerId === this.player2.id) {
      return true;
    }
    
    return false;
  }

  /**
   * Determina si es el turno de la IA
   * @returns {boolean} - true si es el turno de la IA
   */
  isAITurn() {
    return this.vsAI && this.currentTurn === 'player2';
  }

  /**
   * Cambia el turno al siguiente jugador
   */
  switchTurn() {
    this.currentTurn = this.currentTurn === 'player1' ? 'player2' : 'player1';
  }

  /**
   * Verifica si el juego ha terminado
   * @returns {boolean} - true si el juego ha terminado
   */
  isFinished() {
    return this.winner !== null;
  }

  /**
   * Obtiene el tipo de juego
   * @returns {string} - Tipo de juego
   */
  getType() {
    return this.type;
  }

  /**
   * Obtiene un mensaje descriptivo del final del juego
   * @returns {string} - Mensaje del final del juego
   */
  getEndGameMessage() {
    if (!this.isFinished()) {
      return "El juego aún está en curso.";
    }
    
    if (this.winner === 'player1') {
      return `¡${this.player1.name} ha ganado!`;
    } else if (this.winner === 'player2') {
      return `¡${this.player2.name} ha ganado!`;
    } else if (this.winner === 'draw') {
      return "¡El juego ha terminado en empate!";
    }
    
    return "El juego ha terminado.";
  }

  // ========= MÉTODOS A IMPLEMENTAR POR LAS SUBCLASES =========

  /**
   * Construye el prompt para evaluar un movimiento del jugador
   * @param {string} playerId - ID del jugador
   * @param {string} moveText - Texto del movimiento
   * @returns {string} - Prompt para la API de IA
   */
  buildMovePrompt(playerId, moveText) {
    throw new Error('El método buildMovePrompt debe ser implementado por las subclases');
  }

  /**
   * Analiza la respuesta de la API de IA para un movimiento
   * @param {string} response - Respuesta de la API
   * @returns {Object} - Resultado normalizado del movimiento
   */
  parseMoveResponse(response) {
    throw new Error('El método parseMoveResponse debe ser implementado por las subclases');
  }

  /**
   * Construye el prompt para que la IA genere un movimiento
   * @param {Array} historialIntentos - Historial de intentos fallidos (opcional)
   * @returns {string} - Prompt para la API de IA
   */
  buildAIPrompt(historialIntentos = []) {
    throw new Error('El método buildAIPrompt debe ser implementado por las subclases');
  }

  /**
   * Analiza la respuesta de la API de IA para el movimiento de la IA
   * @param {string} response - Respuesta de la API
   * @returns {Object} - Resultado normalizado del movimiento
   */
  parseAIResponse(response) {
    throw new Error('El método parseAIResponse debe ser implementado por las subclases');
  }

  /**
   * Aplica un movimiento al estado del juego
   * @param {Object} moveResult - Resultado normalizado del movimiento
   * @param {string} playerId - ID del jugador que realizó el movimiento
   */
  applyMove(moveResult, playerId) {
    throw new Error('El método applyMove debe ser implementado por las subclases');
  }

  /**
   * Renderiza el estado actual del juego en formato texto
   * @returns {Object} - Resultado del renderizado con mensaje
   */
  async renderGame() {
    throw new Error('El método renderGame debe ser implementado por las subclases');
  }
}

module.exports = BaseGame;
