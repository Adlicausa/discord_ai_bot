/**
 * Utilidades para renderizar tableros de juegos en ASCII
 * Incluye funciones para ajedrez, tres en raya, etc.
 */

/**
 * Renderiza un tablero de ajedrez en ASCII con anchura adecuada
 * @param {Array} board - Matriz de 8x8 con las piezas de ajedrez
 * @param {Object} options - Opciones adicionales de renderizado
 * @returns {string} - Representación ASCII del tablero
 */
function renderChessBoard(board, options = {}) {
  const {
    perspective = 'white', // 'white' o 'black' para invertir el tablero
    lastMove = null,       // Última jugada para resaltar (ej: 'e2e4')
    checkPosition = null,  // Posición del rey en jaque (ej: 'e1')
    highlightSquares = [], // Casillas a resaltar (ej: ['e4', 'e5'])
    unicode = true         // Usar símbolos Unicode para las piezas
  } = options;
  
  // Símbolos para las piezas (Unicode y ASCII)
  const pieceSymbols = {
    unicode: {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙', // Blancas
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟', // Negras
      ' ': ' '  // Espacio vacío
    },
    ascii: {
      'K': 'K', 'Q': 'Q', 'R': 'R', 'B': 'B', 'N': 'N', 'P': 'P', // Blancas
      'k': 'k', 'q': 'q', 'r': 'r', 'b': 'b', 'n': 'n', 'p': 'p', // Negras
      ' ': ' '  // Espacio vacío
    }
  };
  
  // Seleccionar el conjunto de símbolos
  const symbols = unicode ? pieceSymbols.unicode : pieceSymbols.ascii;
  
  // Convertir posiciones algebraicas en índices de matriz
  const algebraicToIndices = (algebraic) => {
    if (!algebraic || algebraic.length !== 2) return null;
    const col = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(algebraic[1], 10);
    return {row, col};
  };
  
  // Determinar si una casilla debe ser resaltada
  const isHighlighted = (row, col) => {
    if (!lastMove && !checkPosition && highlightSquares.length === 0) return false;
    
    // Convertir índices de matriz a posición algebraica
    const algebraic = String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
    
    // Comprobar si coincide con alguna posición resaltada
    if (highlightSquares.includes(algebraic)) return true;
    
    // Comprobar si es parte del último movimiento
    if (lastMove && lastMove.length >= 4) {
      const from = lastMove.substring(0, 2);
      const to = lastMove.substring(2, 4);
      if (algebraic === from || algebraic === to) return true;
    }
    
    // Comprobar si es la posición del rey en jaque
    if (checkPosition && algebraic === checkPosition) return true;
    
    return false;
  };
  
  // Función para obtener el contenido de una casilla (con posible resaltado)
  const getSquareContent = (row, col) => {
    const piece = board[row][col];
    const symbol = symbols[piece] || ' ';
    const highlighted = isHighlighted(row, col);
    
    return {
      symbol,
      highlighted
    };
  };
  
  // Generar el tablero
  let output = "";
  
  // Comenzar con la leyenda superior de columnas
  output += "    a   b   c   d   e   f   g   h    \n";
  
  // Borde superior
  output += "  ┌───┬───┬───┬───┬───┬───┬───┬───┐  \n";
  
  // Filas del tablero
  for (let row = 0; row < 8; row++) {
    // Índice de fila ajustado según la perspectiva
    const displayRow = perspective === 'black' ? row : 7 - row;
    const rowNumber = 8 - displayRow;
    
    // Añadir número de fila
    output += `${rowNumber} │`;
    
    // Contenido de la fila
    for (let col = 0; col < 8; col++) {
      // Índice de columna ajustado según la perspectiva
      const displayCol = perspective === 'black' ? 7 - col : col;
      
      // Obtener contenido de la casilla
      const squareContent = getSquareContent(displayRow, displayCol);
      
      // Añadir espacio para centrar la pieza
      output += ` ${squareContent.symbol} │`;
    }
    
    // Añadir número de fila al final
    output += ` ${rowNumber}\n`;
    
    // Añadir separador de fila (excepto en la última fila)
    if (row < 7) {
      output += "  ├───┼───┼───┼───┼───┼───┼───┼───┤  \n";
    } else {
      output += "  └───┴───┴───┴───┴───┴───┴───┴───┘  \n";
    }
  }
  
  // Leyenda inferior de columnas
  output += "    a   b   c   d   e   f   g   h    \n";
  
  return "```\n" + output + "```";
}

/**
 * Renderiza un tablero de tres en raya en ASCII
 * @param {Array} board - Matriz de 3x3 con el estado del juego
 * @param {Object} options - Opciones adicionales de renderizado
 * @returns {string} - Representación ASCII del tablero
 */
function renderTicTacToeBoard(board, options = {}) {
  const {
    lastMove = null,       // Última jugada para resaltar (ej: '1,1')
    winLine = null,        // Línea ganadora (ej: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}])
  } = options;
  
  // Símbolos para los jugadores
  const symbols = {
    'X': 'X',
    'O': 'O',
    ' ': ' '
  };
  
  // Determinar si una casilla es parte de la línea ganadora
  const isWinningSquare = (row, col) => {
    if (!winLine) return false;
    return winLine.some(pos => pos.row === row && pos.col === col);
  };
  
  // Determinar si una casilla es el último movimiento
  const isLastMove = (row, col) => {
    if (!lastMove) return false;
    const [lastRow, lastCol] = lastMove.split(',').map(Number);
    return row === lastRow && col === lastCol;
  };
  
  // Generar el tablero
  let output = "";
  
  // Añadir leyenda de columnas
  output += "     1   2   3  \n";
  
  // Borde superior
  output += "   ┌───┬───┬───┐\n";
  
  // Filas del tablero
  for (let row = 0; row < 3; row++) {
    // Añadir número de fila
    output += ` ${row + 1} │`;
    
    // Contenido de la fila
    for (let col = 0; col < 3; col++) {
      const symbol = symbols[board[row][col]] || ' ';
      
      // Resaltar casillas ganadoras o último movimiento
      output += ` ${symbol} │`;
    }
    
    output += "\n";
    
    // Añadir separador de fila (excepto en la última fila)
    if (row < 2) {
      output += "   ├───┼───┼───┤\n";
    } else {
      output += "   └───┴───┴───┘\n";
    }
  }
  
  return "```\n" + output + "```";
}

/**
 * Renderiza un tablero de conecta cuatro en ASCII
 * @param {Array} board - Matriz de 6x7 con el estado del juego
 * @param {Object} options - Opciones adicionales de renderizado
 * @returns {string} - Representación ASCII del tablero
 */
function renderConnect4Board(board, options = {}) {
  const {
    lastMove = null,       // Última jugada para resaltar (ej: '3')
    winLine = null,        // Línea ganadora (ej: [{row: 0, col: 0}, {row: 1, col: 1}, ...])
  } = options;
  
  // Símbolos para los jugadores
  const symbols = {
    '1': '●', // Jugador 1
    '2': '○', // Jugador 2
    ' ': ' '  // Vacío
  };
  
  // Determinar si una casilla es parte de la línea ganadora
  const isWinningSquare = (row, col) => {
    if (!winLine) return false;
    return winLine.some(pos => pos.row === row && pos.col === col);
  };
  
  // Generar el tablero
  let output = "";
  
  // Añadir leyenda de columnas
  output += "  ";
  for (let col = 1; col <= 7; col++) {
    output += ` ${col}  `;
  }
  output += "\n";
  
  // Borde superior
  output += " ┌";
  for (let col = 0; col < 7; col++) {
    output += "───";
    if (col < 6) output += "┬";
  }
  output += "┐\n";
  
  // Filas del tablero
  for (let row = 0; row < 6; row++) {
    output += " │";
    
    // Contenido de la fila
    for (let col = 0; col < 7; col++) {
      const symbol = symbols[board[row][col]] || ' ';
      
      // Resaltar casillas ganadoras
      output += ` ${symbol} │`;
    }
    
    output += "\n";
    
    // Añadir separador de fila (excepto en la última fila)
    if (row < 5) {
      output += " ├";
      for (let col = 0; col < 7; col++) {
        output += "───";
        if (col < 6) output += "┼";
      }
      output += "┤\n";
    }
  }
  
  // Borde inferior
  output += " └";
  for (let col = 0; col < 7; col++) {
    output += "───";
    if (col < 6) output += "┴";
  }
  output += "┘\n";
  
  // Añadir leyenda de columnas de nuevo
  output += "  ";
  for (let col = 1; col <= 7; col++) {
    output += ` ${col}  `;
  }
  output += "\n";
  
  return "```\n" + output + "```";
}

module.exports = {
  renderChessBoard,
  renderTicTacToeBoard,
  renderConnect4Board
};
