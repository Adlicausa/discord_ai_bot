// Punto de entrada principal para el Bot de Discord con IA
const { startBot } = require('./bot');

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promesa rechazada no manejada:', error);
});

// Iniciar el bot
console.log('Iniciando bot de Discord con IA...');
startBot();
