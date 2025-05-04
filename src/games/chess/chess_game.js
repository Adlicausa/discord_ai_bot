/**
 * Implementación del juego de ajedrez
 * Utiliza la API de IA para validar movimientos y generar jugadas
 */
const BaseGame = require('../utils/base_game');
const { renderChessBoard } = require('../utils/board_renderer');

class ChessGame extends BaseGame {
  constructor() {
    super();
    this.type = 'ajedrez';
  }

  /**
   * Inicializa el tablero de ajedrez con la posición inicial
   */
  initializeGameState() {
    // Tablero de ajedrez inicial (8x8)
    // Mayúsculas para piezas blancas, minúsculas para negras
    // R=Torre, N=Caballo, B=Alfil, Q=Dama, K=Rey, P=Peón
    this.state = {
      board: [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
      ],
      perspective: 'white', // Perspectiva del tablero (white o black)
      lastMove: null,       // Último movimiento realizado
      check: null,          // Posición del rey en jaque (o null si no hay jaque)
      possibleMoves: [],    // Movimientos posibles para el jugador actual
      castlingRights: {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true
      },
      enPassantTarget: null, // Casilla de captura al paso
      halfMoveClock: 0,      // Contador de medios movimientos (para regla de 50 movimientos)
      fullMoveNumber: 1      // Número de movimiento completo (comienza en 1 e incrementa después de cada jugada negra)
    };
  }

  /**
   * Construye un prompt para que la IA evalúe un movimiento del jugador
   * @param {string} playerId - ID del jugador
   * @param {string} moveText - Texto del movimiento
   * @returns {string} - Prompt para la API de IA
   */
  buildMovePrompt(playerId, moveText) {
    // Determinar color del jugador
    const playerColor = playerId === this.player1.id ? 'white' : 'black';
    const currentPlayerName = playerId === this.player1.id ? this.player1.name : this.player2.name;
    
    // Construir representación del tablero en FEN (Forsyth-Edwards Notation)
    const fen = this.generateFEN();
    
    // Construir historial de movimientos
    const moveHistory = this.moveHistory.map(move => 
      `${move.player === this.player1.id ? 'Blancas' : 'Negras'}: ${move.move}`
    ).join('\n');
    
    // Construir prompt para la API de IA
    return `
Eres un experto en ajedrez. Estás evaluando un movimiento en una partida de ajedrez.

Estado actual de la partida:
- FEN: ${fen}
- Turno: ${this.currentTurn === 'player1' ? 'Blancas' : 'Negras'}
- Último movimiento: ${this.state.lastMove || 'Ninguno (inicio de partida)'}

El jugador ${currentPlayerName} (${playerColor === 'white' ? 'Blancas' : 'Negras'}) quiere hacer el siguiente movimiento:
"${moveText}"

Analiza si este movimiento es legal según las reglas del ajedrez. Ten en cuenta:
- La notación puede ser algebraica (e2e4) o en lenguaje natural (e2 hacia e4).
- Verifica enroques, capturas al paso (en passant) y promociones.
- Verifica que el rey no quede o esté en jaque (si corresponde).

Responde con el siguiente formato exacto:

MOVIMIENTO_VALIDO: [true/false]
MOVIMIENTO_NORMALIZADO: [notación algebraica estándar, por ejemplo "e2e4" o "e7e8q" para promoción]
RAZON: [razón si es inválido, o descripción del movimiento si es válido]
JAQUE: [true/false]
JAQUE_MATE: [true/false]
TABLAS: [true/false]
POSICION_JAQUE: [posición del rey en jaque, por ejemplo "e1", o "ninguno"]
CAPTURA: [true/false]
PIEZA_MOVIDA: [tipo de pieza movida]
FEN_RESULTANTE: [nueva posición en formato FEN]
`;
  }

  /**
   * Analiza la respuesta de la IA para un movimiento del jugador
   * @param {string} response - Respuesta de la IA
   * @returns {Object} - Resultado normalizado del movimiento
   */
  parseMoveResponse(response) {
    try {
      // Extraer campos de la respuesta utilizando expresiones regulares
      const validMatch = response.match(/MOVIMIENTO_VALIDO:\s*(true|false)/i);
      const normalizedMatch = response.match(/MOVIMIENTO_NORMALIZADO:\s*([a-h][1-8][a-h][1-8][qrbnQRBN]?)/i);
      const reasonMatch = response.match(/RAZON:\s*(.+?)(?=\n|$)/i);
      const checkMatch = response.match(/JAQUE:\s*(true|false)/i);
      const checkmateMatch = response.match(/JAQUE_MATE:\s*(true|false)/i);
      const drawMatch = response.match(/TABLAS:\s*(true|false)/i);
      const checkPositionMatch = response.match(/POSICION_JAQUE:\s*([a-h][1-8]|ninguno)/i);
      const captureMatch = response.match(/CAPTURA:\s*(true|false)/i);
      const pieceMoved = response.match(/PIEZA_MOVIDA:\s*(.+?)(?=\n|$)/i);
      const fenMatch = response.match(/FEN_RESULTANTE:\s*(.+?)(?=\n|$)/i);
      
      // Extraer y convertir cada valor
      const valid = validMatch && validMatch[1].toLowerCase() === 'true';
      const normalizedMove = normalizedMatch ? normalizedMatch[1].toLowerCase() : null;
      const reason = reasonMatch ? reasonMatch[1].trim() : "Movimiento inválido";
      const isCheck = checkMatch && checkMatch[1].toLowerCase() === 'true';
      const isCheckmate = checkmateMatch && checkmateMatch[1].toLowerCase() === 'true';
      const isDraw = drawMatch && drawMatch[1].toLowerCase() === 'true';
      const checkPosition = checkPositionMatch ? 
        (checkPositionMatch[1].toLowerCase() === 'ninguno' ? null : checkPositionMatch[1].toLowerCase()) : 
        null;
      const isCapture = captureMatch && captureMatch[1].toLowerCase() === 'true';
      const pieceMovedText = pieceMoved ? pieceMoved[1].trim() : "";
      const fenResult = fenMatch ? fenMatch[1].trim() : null;
      
      // Determinar si el juego ha terminado
      const gameOver = isCheckmate || isDraw;
      
      // Determinar ganador si el juego ha terminado
      let winner = null;
      if (isCheckmate) {
        // El jugador actual ha puesto jaque mate
        winner = this.currentTurn;
      } else if (isDraw) {
        winner = 'draw';
      }
      
      // Construir resultado
      return {
        valid,
        normalizedMove,
        reason,
        isCheck,
        isCheckmate,
        isDraw,
        checkPosition,
        gameOver,
        winner,
        isCapture,
        pieceMovedText,
        fenResult
      };
    } catch (error) {
      console.error('Error al analizar la respuesta de la IA:', error);
      return {
        valid: false,
        reason: 'Error al analizar la respuesta.'
      };
    }
  }

  /**
   * Aplica un movimiento al estado del juego
   * @param {Object} moveResult - Resultado normalizado del movimiento
   * @param {string} playerId - ID del jugador que realizó el movimiento
   */
  applyMove(moveResult, playerId) {
    if (moveResult.valid) {
      // Actualizar el tablero a partir del FEN resultante, si está disponible
      if (moveResult.fenResult) {
        this.updateBoardFromFEN(moveResult.fenResult);
      }
      
      // Actualizar información de estado
      this.state.lastMove = moveResult.normalizedMove;
      this.state.check = moveResult.checkPosition;
      
      // Incrementar contador de movimientos completos después de cada jugada de las negras
      if (this.currentTurn === 'player2') {
        this.state.fullMoveNumber++;
      }
      
      // Si es jaque mate o tablas, el juego ha terminado
      if (moveResult.gameOver) {
        this.winner = moveResult.winner;
      }
    }
  }

  /**
   * Construye el prompt para que la IA genere un movimiento
   * @param {Array} historialIntentos - Historial de intentos fallidos (opcional)
   * @returns {string} - Prompt para la API de IA
   */
  buildAIPrompt(historialIntentos = []) {
    // Generar FEN
    const fen = this.generateFEN();
    
    // Determinar color de la IA
    const aiColor = this.player2.id === 'AI' ? (this.currentTurn === 'player2' ? 'black' : 'white') : 'unknown';
    
    // Historial de movimientos
    const moveHistory = this.moveHistory.map(move => 
      `${move.player === this.player1.id ? 'Blancas' : 'Negras'}: ${move.move}`
    ).join('\n');
    
    // Construir mensaje sobre intentos fallidos si hay alguno
    let intentosFallidosMsg = '';
    if (historialIntentos.length > 0) {
      intentosFallidosMsg = `\nINTENTOS PREVIOS FALLIDOS (estos movimientos son ILEGALES, NO los repitas):\n`;
      historialIntentos.forEach((intento, index) => {
        intentosFallidosMsg += `- Intento ${index + 1}: "${intento.moveText}" - Razón: ${intento.reason}\n`;
      });
      intentosFallidosMsg += `\nAsegúrate de generar un movimiento LEGAL que cumpla con las reglas del ajedrez.`;
    }
    
    return `
Eres un experto en ajedrez jugando una partida. Estás jugando con las ${aiColor === 'white' ? 'Blancas' : 'Negras'}.

Estado actual de la partida:
- FEN: ${fen}
- Turno: ${this.currentTurn === 'player1' ? 'Blancas' : 'Negras'}
- Último movimiento del oponente: ${this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1].move : 'Ninguno (inicio de partida)'}

Historial de movimientos:
${moveHistory || 'No hay movimientos previos'}${intentosFallidosMsg}

Genera tu próximo movimiento. Debes elegir un movimiento LEGAL según las reglas del ajedrez.
Si es posible, elige un movimiento bueno estratégicamente.
Asegúrate de que tu movimiento:
- No deje tu rey en jaque
- Respete los movimientos legales de cada pieza
- No intente mover una pieza a través de otras piezas (excepto el caballo)
- No mueva una pieza a una casilla ocupada por otra pieza del mismo color

Responde con el siguiente formato exacto:

MOVIMIENTO: [tu movimiento en notación algebraica, por ejemplo "e2e4" o "e7e8q" para promoción]
EXPLICACION_BREVE: [explicación breve de por qué elegiste este movimiento]
JAQUE: [true/false]
JAQUE_MATE: [true/false]
TABLAS: [true/false]
POSICION_JAQUE: [posición del rey en jaque, por ejemplo "e1", o "ninguno"]
CAPTURA: [true/false]
PIEZA_MOVIDA: [tipo de pieza movida]
FEN_RESULTANTE: [nueva posición en formato FEN]
`;
  }

  /**
   * Analiza la respuesta de la IA para el movimiento de la IA
   * @param {string} response - Respuesta de la IA
   * @returns {Object} - Resultado normalizado del movimiento
   */
  parseAIResponse(response) {
    try {
      // Extraer campos de la respuesta utilizando expresiones regulares
      const moveMatch = response.match(/MOVIMIENTO:\s*([a-h][1-8][a-h][1-8][qrbnQRBN]?)/i);
      const explanationMatch = response.match(/EXPLICACION_BREVE:\s*(.+?)(?=\n|$)/i);
      const checkMatch = response.match(/JAQUE:\s*(true|false)/i);
      const checkmateMatch = response.match(/JAQUE_MATE:\s*(true|false)/i);
      const drawMatch = response.match(/TABLAS:\s*(true|false)/i);
      const checkPositionMatch = response.match(/POSICION_JAQUE:\s*([a-h][1-8]|ninguno)/i);
      const captureMatch = response.match(/CAPTURA:\s*(true|false)/i);
      const pieceMoved = response.match(/PIEZA_MOVIDA:\s*(.+?)(?=\n|$)/i);
      const fenMatch = response.match(/FEN_RESULTANTE:\s*(.+?)(?=\n|$)/i);
      
      // Si no se pudo extraer el movimiento, no es válido
      if (!moveMatch) {
        return {
          valid: false,
          reason: 'La IA no generó un movimiento válido'
        };
      }
      
      // Extraer y convertir cada valor
      const moveText = moveMatch[1].toLowerCase();
      const explanation = explanationMatch ? explanationMatch[1].trim() : "Sin explicación";
      const isCheck = checkMatch && checkMatch[1].toLowerCase() === 'true';
      const isCheckmate = checkmateMatch && checkmateMatch[1].toLowerCase() === 'true';
      const isDraw = drawMatch && drawMatch[1].toLowerCase() === 'true';
      const checkPosition = checkPositionMatch ? 
        (checkPositionMatch[1].toLowerCase() === 'ninguno' ? null : checkPositionMatch[1].toLowerCase()) : 
        null;
      const isCapture = captureMatch && captureMatch[1].toLowerCase() === 'true';
      const pieceMovedText = pieceMoved ? pieceMoved[1].trim() : "";
      const fenResult = fenMatch ? fenMatch[1].trim() : null;
      
      // Determinar si el juego ha terminado
      const gameOver = isCheckmate || isDraw;
      
      // Determinar ganador si el juego ha terminado
      let winner = null;
      if (isCheckmate) {
        // La IA ha puesto jaque mate
        winner = this.currentTurn;
      } else if (isDraw) {
        winner = 'draw';
      }
      
      // Generar texto introductorio basado en el tipo de movimiento
      let messageIntro = "He movido:";
      if (isCheckmate) {
        messageIntro = "¡Jaque mate! Mi movimiento final es:";
      } else if (isCheck) {
        messageIntro = "¡Jaque! He movido:";
      } else if (isCapture) {
        messageIntro = "He capturado:";
      }
      
      // Construir resultado
      return {
        valid: true,
        moveText,
        normalizedMove: moveText,
        explanation,
        isCheck,
        isCheckmate,
        isDraw,
        checkPosition,
        gameOver,
        winner,
        isCapture,
        pieceMovedText,
        messageIntro,
        fenResult
      };
    } catch (error) {
      console.error('Error al analizar la respuesta de la IA para generar movimiento:', error);
      return {
        valid: false,
        reason: 'Error al analizar la respuesta de la IA.'
      };
    }
  }

  /**
   * Renderiza el estado actual del juego
   * @returns {Object} - Resultado del renderizado
   */
  async renderGame() {
    // Determinar el mensaje principal
    let message;
    
    // Determinar si hay mensaje especial (jaque, jaque mate, etc.)
    let statusMessage = "";
    if (this.isFinished()) {
      statusMessage = this.getEndGameMessage();
    } else if (this.state.check) {
      statusMessage = "¡Jaque al rey!";
    }
    
    // Determinar de quién es el turno actual (o si el juego ha terminado)
    const turnMessage = this.isFinished() 
      ? "Juego terminado." 
      : `Turno de ${this.currentTurn === 'player1' ? this.player1.name : this.player2.name} (${this.currentTurn === 'player1' ? 'Blancas' : 'Negras'})`;
    
    // Renderizar el tablero
    const boardASCII = renderChessBoard(this.state.board, {
      perspective: this.state.perspective,
      lastMove: this.state.lastMove,
      checkPosition: this.state.check
    });
    
    // Construir el mensaje completo
    message = `${statusMessage ? statusMessage + "\n\n" : ""}${boardASCII}\n${turnMessage}`;
    
    // Incluir historial de movimientos recientes (últimos 5)
    if (this.moveHistory.length > 0) {
      const recentMoves = this.moveHistory.slice(-5);
      const historyText = recentMoves.map((move, index) => {
        const moveNumber = Math.floor((this.moveHistory.length - recentMoves.length + index + 2) / 2);
        const isWhite = move.player === this.player1.id;
        return `${moveNumber}${isWhite ? '.' : '...'} ${move.move}`;
      }).join(' ');
      
      message += `\n\nMovimientos recientes: ${historyText}`;
    }
    
    return { message };
  }

  /**
   * Genera una representación FEN (Forsyth-Edwards Notation) de la posición actual
   * @returns {string} - Cadena FEN
   */
  generateFEN() {
    let fen = '';
    
    // 1. Posición de las piezas
    for (let row = 0; row < 8; row++) {
      let emptySquares = 0;
      
      for (let col = 0; col < 8; col++) {
        const piece = this.state.board[row][col];
        
        if (piece === ' ') {
          emptySquares++;
        } else {
          // Si había casillas vacías antes de esta pieza, añadirlas primero
          if (emptySquares > 0) {
            fen += emptySquares;
            emptySquares = 0;
          }
          fen += piece;
        }
      }
      
      // Si hay casillas vacías al final de la fila
      if (emptySquares > 0) {
        fen += emptySquares;
      }
      
      // Añadir separador de filas (excepto en la última fila)
      if (row < 7) {
        fen += '/';
      }
    }
    
    // 2. Turno actual
    fen += ' ' + (this.currentTurn === 'player1' ? 'w' : 'b');
    
    // 3. Derechos de enroque
    let castlingRights = '';
    if (this.state.castlingRights.whiteKingSide) castlingRights += 'K';
    if (this.state.castlingRights.whiteQueenSide) castlingRights += 'Q';
    if (this.state.castlingRights.blackKingSide) castlingRights += 'k';
    if (this.state.castlingRights.blackQueenSide) castlingRights += 'q';
    fen += ' ' + (castlingRights || '-');
    
    // 4. Casilla de captura al paso
    fen += ' ' + (this.state.enPassantTarget || '-');
    
    // 5. Contador de medios movimientos
    fen += ' ' + this.state.halfMoveClock;
    
    // 6. Número de movimiento completo
    fen += ' ' + this.state.fullMoveNumber;
    
    return fen;
  }

  /**
   * Actualiza el tablero a partir de una representación FEN
   * @param {string} fen - Notación FEN
   */
  updateBoardFromFEN(fen) {
    try {
      // Dividir la cadena FEN en sus componentes
      const [position, turn, castling, enPassant, halfMove, fullMove] = fen.split(' ');
      
      // Actualizar el tablero
      const rows = position.split('/');
      const newBoard = [];
      
      for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
        const row = [];
        let colIndex = 0;
        
        for (let i = 0; i < rows[rowIndex].length; i++) {
          const char = rows[rowIndex][i];
          
          if (/[1-8]/.test(char)) {
            // Es un número (casillas vacías)
            const emptyCount = parseInt(char, 10);
            for (let j = 0; j < emptyCount; j++) {
              row.push(' ');
              colIndex++;
            }
          } else {
            // Es una pieza
            row.push(char);
            colIndex++;
          }
        }
        
        newBoard.push(row);
      }
      
      // Actualizar el estado del juego
      this.state.board = newBoard;
      
      // Actualizar información adicional
      this.state.castlingRights = {
        whiteKingSide: castling.includes('K'),
        whiteQueenSide: castling.includes('Q'),
        blackKingSide: castling.includes('k'),
        blackQueenSide: castling.includes('q')
      };
      
      this.state.enPassantTarget = enPassant !== '-' ? enPassant : null;
      this.state.halfMoveClock = parseInt(halfMove, 10);
      this.state.fullMoveNumber = parseInt(fullMove, 10);
      
    } catch (error) {
      console.error('Error al actualizar el tablero desde FEN:', error);
    }
  }
}

module.exports = ChessGame;
